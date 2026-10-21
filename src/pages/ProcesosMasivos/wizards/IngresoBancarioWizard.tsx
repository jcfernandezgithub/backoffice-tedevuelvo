import { useMemo, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Upload, Play, Download, Loader2, ExternalLink, AlertTriangle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog'
import { getInstitutionDisplayName } from '@/lib/institutionHomologation'
import { ingresoStatusLabel, parseIngresoCsv, runSequential } from '../services/ingresoBatchRules'
import { resolveIngresoRow, submitIngresoRow, readIngresoCurrentState, type IngresoRow } from '../services/ingresoBatchService'

type Result = { row: IngresoRow; state: string; detail: string }
const errorMessage = (error: unknown) => error instanceof Error ? error.message : 'No se pudo completar la operación.'
function currentResult(row: IngresoRow, updated: NonNullable<IngresoRow['refund']>): Result {
  const known = updated.status === 'submitted' || updated.status === 'docs_received'
  return {
    row: { ...row, refund: updated },
    state: updated.status === 'submitted' ? 'Ingresada' : known ? 'Documentos recibidos' : 'Por verificar',
    detail: updated.status === 'submitted'
      ? 'Estado actual confirmado: Ingresada. Esta consulta no verifica la finalización de n8n.'
      : known ? 'Cambio confirmado. Aún figura en Documentos recibidos; el paso a Ingresada está pendiente. Actualiza el resultado para verificarlo.'
      : `Estado actual: ${ingresoStatusLabel(updated.status)}. Revisar antes de repetir el envío.`,
  }
}

export default function IngresoBancarioWizard({ onBusyChange }: { onBusyChange: (busy: boolean) => void }) {
  const queryClient = useQueryClient()
  const input = useRef<HTMLInputElement>(null)
  const lock = useRef(false)
  const stop = useRef(false)
  const [phase, setPhase] = useState<'upload' | 'validating' | 'review' | 'processing' | 'results'>('upload')
  const [fileName, setFileName] = useState('')
  const [error, setError] = useState('')
  const [rows, setRows] = useState<IngresoRow[]>([])
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [results, setResults] = useState<Result[]>([])
  const [progress, setProgress] = useState(0)
  const [confirm, setConfirm] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const eligible = useMemo(() => rows.filter(row => row.reasons.length === 0), [rows])
  const selectedRows = eligible.filter(row => selected.has(row.lineNumber))
  const busy = phase === 'validating' || phase === 'processing'

  async function loadFile(file: File) {
    if (lock.current) return
    lock.current = true; onBusyChange(true); setError(''); setFileName(file.name); setRows([]); setResults([]); setProgress(0)
    try {
      const parsed = parseIngresoCsv(await file.text())
      setPhase('validating')
      const resolved: IngresoRow[] = []; const seen = new Set<string>()
      for (const row of parsed) {
        if (!row.refundId || seen.has(row.refundId)) {
          resolved.push({ ...row, reasons: [row.refundId ? 'ID duplicado en el archivo.' : 'Falta ID de solicitud.'] })
        } else {
          seen.add(row.refundId)
          try {
            const item = await resolveIngresoRow(row)
            const canonical = item.refund?.publicId
            if (canonical && canonical !== row.refundId && seen.has(canonical)) item.reasons.push('La solicitud ya aparece en otra fila.')
            if (canonical) seen.add(canonical)
            resolved.push(item)
          } catch (err) { resolved.push({ ...row, reasons: [errorMessage(err)] }) }
        }
        setProgress(Math.round(resolved.length / parsed.length * 100))
      }
      setRows(resolved); setSelected(new Set(resolved.filter(row => !row.reasons.length).map(row => row.lineNumber))); setPhase('review')
    } catch (err) { setError(errorMessage(err)); setPhase('upload') }
    finally { lock.current = false; onBusyChange(false) }
  }

  async function process() {
    if (lock.current || !selectedRows.length) return
    lock.current = true; stop.current = false; onBusyChange(true); setConfirm(false); setPhase('processing'); setProgress(0)
    const accumulated: Result[] = []
    try {
      await runSequential(selectedRows, async row => {
        if (stop.current) {
          accumulated.push({ row, state: 'No ejecutada', detail: 'Proceso detenido por el usuario.' })
          return false
        }
        try {
          const response = await submitIngresoRow(row)
          const updated = await readIngresoCurrentState(response.publicId || row.refundId)
          const known = updated.status === 'submitted' || updated.status === 'docs_received'
          accumulated.push(currentResult(row, updated))
          return known
        } catch (err) {
          accumulated.push({ row, state: 'Por verificar', detail: `${errorMessage(err)} Revisar el estado y el envío bancario antes de repetir.` })
          return false
        } finally {
          setResults([...accumulated]); setProgress(Math.round(accumulated.length / selectedRows.length * 100))
          void queryClient.invalidateQueries({ queryKey: ['refund'] })
          void queryClient.invalidateQueries({ queryKey: ['refunds'] })
        }
      }, remaining => {
        accumulated.push(...remaining.map(row => ({ row, state: 'No ejecutada', detail: 'Cola detenida; no se realizó el cambio de estado.' })))
      })
    } finally { setResults([...accumulated]); setPhase('results'); lock.current = false; onBusyChange(false) }
  }

  async function refreshResults() {
    if (lock.current) return
    lock.current = true; setRefreshing(true); onBusyChange(true); setError('')
    try {
      const refreshed: Result[] = []
      for (const result of results) {
        if (result.state === 'No ejecutada') { refreshed.push(result); continue }
        try {
          refreshed.push(currentResult(result.row, await readIngresoCurrentState(result.row.refund?.publicId || result.row.refundId)))
        } catch (err) {
          refreshed.push({ ...result, state: 'Por verificar', detail: `No se pudo actualizar el estado: ${errorMessage(err)} No se repitió el envío.` })
        }
      }
      setResults(refreshed)
    } finally { lock.current = false; setRefreshing(false); onBusyChange(false) }
  }

  function download(text: string, name: string) {
    const url = URL.createObjectURL(new Blob(['\uFEFF' + text], { type: 'text/csv;charset=utf-8' }))
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = name; anchor.click(); URL.revokeObjectURL(url)
  }
  function summary() {
    const lines = [['ID Solicitud', 'Cliente', 'Resultado', 'Detalle'], ...results.map(result => [result.row.refundId, result.row.refund?.fullName || '', result.state, result.detail])]
    download(lines.map(line => line.map(value => `"${value.replace(/"/g, '""')}"`).join(';')).join('\r\n'), 'resumen_ingreso_bancario.csv')
  }

  return <section className="space-y-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h2 className="text-lg font-semibold">Envío de Datos al Banco</h2><p className="text-sm text-muted-foreground">Documentos pendientes / Ingresado → Documentos recibidos → Ingresado</p></div>
      {!busy && <Button variant="outline" size="sm" onClick={() => download('ID Solicitud\r\n', 'plantilla_ingreso_bancario.csv')}><Download className="mr-2 h-4 w-4" />Plantilla CSV</Button>}
    </div>
    <div className="flex items-start gap-2 rounded-md border border-border bg-muted p-3 text-sm">
      <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-primary" />
      <p>Este cambio activa el envío al banco. Las llamadas se ejecutan una por una, pero la respuesta no confirma que n8n terminó; los envíos podrían solaparse.</p>
    </div>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {phase === 'upload' && <div className="border-2 border-dashed border-border rounded-md p-8 text-center space-y-3">
      <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
      <p className="font-medium">Solicitudes para envío de datos al banco</p>
      <Button onClick={() => input.current?.click()}><Upload className="mr-2 h-4 w-4" />Seleccionar CSV</Button>
    </div>}
    <input ref={input} type="file" accept=".csv,text/csv" className="hidden" onChange={event => { const file = event.target.files?.[0]; if (file) void loadFile(file); event.target.value = '' }} />
    {busy && <div className="space-y-3" aria-live="polite">
      <div className="flex justify-between items-center gap-3"><p className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />{phase === 'validating' ? 'Validando solicitudes…' : 'Procesando cambios de estado…'}</p><span>{progress}%</span></div>
      <Progress value={progress} />
      {phase === 'processing' && <Button variant="outline" onClick={() => { stop.current = true; setError('Se detendrá después de la solicitud en curso.') }}>Detener después de esta solicitud</Button>}
    </div>}
    {phase === 'review' && <>
      <div className="flex flex-wrap justify-between items-center gap-3"><div className="flex flex-wrap gap-2 items-center"><span className="font-medium break-all">{fileName}</span><Badge variant="secondary">{eligible.length} elegibles</Badge><Badge variant="outline">{rows.length - eligible.length} bloqueadas</Badge></div><div className="flex gap-2"><Button variant="outline" onClick={() => input.current?.click()}>Cambiar archivo</Button><Button disabled={!selectedRows.length} onClick={() => setConfirm(true)}><Play className="mr-2 h-4 w-4" />Procesar ({selectedRows.length})</Button></div></div>
      <div className="border rounded-md max-h-[460px] overflow-auto"><Table>
        <TableHeader className="sticky top-0 bg-background"><TableRow><TableHead><Checkbox aria-label="Seleccionar todas las elegibles" disabled={!eligible.length} checked={eligible.length > 0 && selectedRows.length === eligible.length} onCheckedChange={checked => setSelected(new Set(checked ? eligible.map(row => row.lineNumber) : []))} /></TableHead><TableHead>Cliente / Solicitud</TableHead><TableHead>RUT</TableHead><TableHead>Entidad bancaria</TableHead><TableHead>Estado actual</TableHead><TableHead>Validación</TableHead><TableHead>Ver</TableHead></TableRow></TableHeader>
        <TableBody>{rows.map(row => <TableRow key={row.lineNumber}><TableCell><Checkbox aria-label={`Seleccionar ${row.refundId}`} disabled={!!row.reasons.length} checked={selected.has(row.lineNumber)} onCheckedChange={checked => setSelected(previous => { const next = new Set(previous); if (checked) next.add(row.lineNumber); else next.delete(row.lineNumber); return next })} /></TableCell><TableCell><p className="font-medium">{row.refund?.fullName || '—'}</p><p className="text-xs text-muted-foreground break-all">{row.refundId}</p></TableCell><TableCell className="whitespace-nowrap">{row.refund?.rut || '—'}</TableCell><TableCell className="min-w-[160px]">{row.refund?.institutionId ? getInstitutionDisplayName(row.refund.institutionId) : '—'}</TableCell><TableCell>{row.refund ? ingresoStatusLabel(row.refund.status) : '—'}</TableCell><TableCell className="text-sm max-w-sm">{row.reasons.length ? row.reasons.join(' ') : 'Lista para procesar'}</TableCell><TableCell>{row.refund?.publicId && <Button asChild variant="ghost" size="icon" aria-label="Ver solicitud"><Link to={`/refunds/${row.refund.publicId}`} target="_blank"><ExternalLink className="h-4 w-4" /></Link></Button>}</TableCell></TableRow>)}</TableBody>
      </Table></div>
    </>}
    {(phase === 'results' || (phase === 'processing' && results.length > 0)) && <>
      {phase === 'results' && <div className="flex flex-wrap items-center gap-3"><h3 className="font-semibold">Resultado: {results.filter(result => ['Ingresada', 'Documentos recibidos'].includes(result.state)).length} cambios confirmados de {results.length}</h3><Button variant="outline" disabled={refreshing} onClick={() => void refreshResults()}><RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />{refreshing ? 'Consultando estados…' : 'Actualizar resultados'}</Button><Button variant="outline" disabled={refreshing} onClick={summary}><Download className="mr-2 h-4 w-4" />Descargar resumen</Button><Button variant="ghost" disabled={refreshing} onClick={() => { setPhase('upload'); setResults([]); setError('') }}>Nuevo archivo</Button></div>}
      <div className="border rounded-md max-h-[460px] overflow-auto"><Table><TableHeader className="sticky top-0 bg-background"><TableRow><TableHead>Cliente / Solicitud</TableHead><TableHead>RUT</TableHead><TableHead>Entidad bancaria</TableHead><TableHead>Resultado</TableHead><TableHead>Detalle</TableHead></TableRow></TableHeader><TableBody>{results.map(result => <TableRow key={result.row.lineNumber}><TableCell><p>{result.row.refund?.fullName || '—'}</p><p className="text-xs text-muted-foreground break-all">{result.row.refundId}</p></TableCell><TableCell className="whitespace-nowrap">{result.row.refund?.rut || '—'}</TableCell><TableCell className="min-w-[160px]">{result.row.refund?.institutionId ? getInstitutionDisplayName(result.row.refund.institutionId) : '—'}</TableCell><TableCell><Badge variant={result.state === 'Por verificar' ? 'destructive' : 'secondary'}>{result.state}</Badge></TableCell><TableCell className="text-sm max-w-md">{result.detail}</TableCell></TableRow>)}</TableBody></Table></div>
    </>}
    <AlertDialog open={confirm} onOpenChange={setConfirm}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Confirmar envío de datos al banco</AlertDialogTitle><AlertDialogDescription>Se cambiarán {selectedRows.length} solicitudes (en Documentos pendientes o Ingresado) a Documentos recibidos. Esto activa el envío bancario existente y el paso automático a Ingresado. No se garantiza que n8n termine antes del siguiente cambio. Si ocurre un error, se detendrá el resto sin reintentar.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => void process()}>Confirmar y procesar</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </section>
}