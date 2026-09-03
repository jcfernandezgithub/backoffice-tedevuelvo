import { useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Upload, FileSpreadsheet, XCircle, Loader2, RefreshCw, ExternalLink,
  Play, CheckCircle2, AlertTriangle, Wallet, Search,
} from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import {
  parseCargaTdvCsv, resolveRow, markRowAsPaid, buildPagosSummaryCsv, MASSIVE_PAID_NOTE,
  type CargaTdvRow, type ResolvedRow, type PaidResult,
} from '../services/pagosBatchService'
import { formatDuration, downloadBlob, StepDot, KpiCard, type ResultStatus } from '../components/wizardUi'

type Phase = 'upload' | 'validating' | 'review' | 'processing' | 'results'
type ResultFilter = 'all' | ResultStatus

const clp = (n: number) =>
  new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(n || 0)

function rowStatusBadge(row: ResolvedRow) {
  if (row.rowStatus === 'ready') {
    return (
      <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800">
        <CheckCircle2 className="h-3 w-3 mr-1" /> Pago programado
      </Badge>
    )
  }
  if (row.rowStatus === 'wrong_status') {
    return (
      <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800">
        <AlertTriangle className="h-3 w-3 mr-1" /> No elegible
      </Badge>
    )
  }
  return (
    <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-300 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800">
      <XCircle className="h-3 w-3 mr-1" /> {row.rowStatus === 'not_found' ? 'No encontrada' : 'Inválida'}
    </Badge>
  )
}

function resultBadge(s: ResultStatus) {
  if (s === 'success') {
    return (
      <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800">
        <CheckCircle2 className="h-3 w-3 mr-1" /> Pagada
      </Badge>
    )
  }
  if (s === 'skipped') {
    return (
      <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800">
        <AlertTriangle className="h-3 w-3 mr-1" /> Omitida
      </Badge>
    )
  }
  return (
    <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-300 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800">
      <XCircle className="h-3 w-3 mr-1" /> Error
    </Badge>
  )
}

export default function PagosMasivosWizard() {
  const [phase, setPhase] = useState<Phase>('upload')
  const [fileName, setFileName] = useState('')
  const [parseError, setParseError] = useState('')

  const [validateIndex, setValidateIndex] = useState(0)
  const [validateTotal, setValidateTotal] = useState(0)
  const [rows, setRows] = useState<ResolvedRow[]>([])
  const [selected, setSelected] = useState<Set<number>>(new Set())

  const [progressIndex, setProgressIndex] = useState(0)
  const [results, setResults] = useState<PaidResult[]>([])
  const [filter, setFilter] = useState<ResultFilter>('all')
  const [startedAt, setStartedAt] = useState(0)
  const [finishedAt, setFinishedAt] = useState(0)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const readyRows = useMemo(() => rows.filter(r => r.rowStatus === 'ready'), [rows])
  const selectedRows = useMemo(
    () => readyRows.filter(r => selected.has(r.lineNumber)),
    [readyRows, selected],
  )
  const selectedTotal = useMemo(
    () => selectedRows.reduce((acc, r) => acc + (r.monto || 0), 0),
    [selectedRows],
  )

  const totals = useMemo(() => ({
    success: results.filter(r => r.status === 'success').length,
    skipped: results.filter(r => r.status === 'skipped').length,
    error: results.filter(r => r.status === 'error').length,
    total: results.length,
  }), [results])

  const filteredResults = useMemo(
    () => (filter === 'all' ? results : results.filter(r => r.status === filter)),
    [results, filter],
  )

  const handleFileSelected = async (file: File) => {
    setFileName(file.name)
    setParseError('')
    const text = await file.text()
    const { rows: parsed, error } = parseCargaTdvCsv(text)
    if (error) { setParseError(error); setRows([]); setPhase('upload'); return }
    if (parsed.length === 0) {
      setParseError('El archivo no contiene filas de datos.'); setRows([]); setPhase('upload'); return
    }
    if (parsed.length > 200) {
      setParseError(`El archivo contiene ${parsed.length} filas. El máximo permitido es 200.`)
      setRows([]); setPhase('upload'); return
    }
    await validateRows(parsed)
  }

  const validateRows = async (parsed: CargaTdvRow[]) => {
    setPhase('validating')
    setValidateTotal(parsed.length)
    setValidateIndex(0)
    const resolved: ResolvedRow[] = []
    for (let i = 0; i < parsed.length; i++) {
      setValidateIndex(i)
      resolved.push(await resolveRow(parsed[i]))
      setRows([...resolved])
    }
    setValidateIndex(parsed.length)
    setSelected(new Set(resolved.filter(r => r.rowStatus === 'ready').map(r => r.lineNumber)))
    setPhase('review')
  }

  const toggleRow = (lineNumber: number) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(lineNumber)) next.delete(lineNumber)
      else next.add(lineNumber)
      return next
    })
  }

  const toggleAll = () => {
    setSelected(prev =>
      prev.size === readyRows.length ? new Set() : new Set(readyRows.map(r => r.lineNumber)),
    )
  }

  const startProcessing = async () => {
    setConfirmOpen(false)
    setPhase('processing'); setResults([]); setProgressIndex(0); setStartedAt(Date.now())
    const accumulated: PaidResult[] = []
    for (let i = 0; i < selectedRows.length; i++) {
      setProgressIndex(i)
      accumulated.push(await markRowAsPaid(selectedRows[i]))
      setResults([...accumulated])
    }
    setProgressIndex(selectedRows.length); setFinishedAt(Date.now()); setPhase('results')
    toast({
      title: 'Proceso finalizado',
      description: `${accumulated.filter(r => r.status === 'success').length} de ${accumulated.length} solicitudes pasaron a Pagada.`,
    })
  }

  const handleDownloadSummary = () => {
    downloadBlob(
      new Blob([buildPagosSummaryCsv(results)], { type: 'text/csv;charset=utf-8' }),
      'resumen_pagos_masivos.csv',
    )
  }

  const resetAll = () => {
    setPhase('upload'); setFileName(''); setParseError(''); setRows([]); setSelected(new Set())
    setResults([]); setProgressIndex(0); setStartedAt(0); setFinishedAt(0); setFilter('all')
    setValidateIndex(0); setValidateTotal(0)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const validatePct = validateTotal === 0 ? 0 : Math.round((validateIndex / validateTotal) * 100)
  const progressPct = selectedRows.length === 0 ? 0 : Math.round((progressIndex / selectedRows.length) * 100)

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Wallet className="h-4 w-4 text-primary" />
          Cambio masivo a Pagada (archivo carga_tdv)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <StepDot active={phase === 'upload'} done={phase !== 'upload'} label="1. Cargar CSV" />
          <span className="flex-1 h-px bg-border" />
          <StepDot active={phase === 'validating' || phase === 'review'} done={phase === 'processing' || phase === 'results'} label="2. Selección" />
          <span className="flex-1 h-px bg-border" />
          <StepDot active={phase === 'processing'} done={phase === 'results'} label="3. Procesamiento" />
          <span className="flex-1 h-px bg-border" />
          <StepDot active={phase === 'results'} done={false} label="4. Resultado" />
        </div>

        {phase === 'upload' && (
          <div className="space-y-4">
            <div className="rounded-lg border-2 border-dashed border-border bg-muted/30 p-8 text-center">
              <Upload className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm font-medium">Carga el archivo <code className="font-mono">carga_tdv_*.csv</code></p>
              <p className="text-xs text-muted-foreground mt-1">
                Es el CSV que se genera junto a la nómina de devoluciones.
              </p>
              <p className="text-xs text-muted-foreground">Máximo 200 solicitudes por archivo.</p>
              <div className="flex gap-2 justify-center mt-4">
                <Button onClick={() => fileInputRef.current?.click()}>
                  <Upload className="h-4 w-4 mr-2" /> Seleccionar archivo
                </Button>
              </div>
              <input ref={fileInputRef} type="file" accept=".csv,text/csv" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelected(f) }} />
            </div>

            {parseError && (
              <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive flex items-start gap-2">
                <XCircle className="h-4 w-4 mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium">No se pudo procesar el archivo</p>
                  <p className="text-xs mt-1">{parseError}</p>
                </div>
              </div>
            )}

            <div className="rounded-md bg-muted/40 p-3 text-xs text-muted-foreground space-y-1">
              <p className="font-medium text-foreground">Notas importantes</p>
              <ul className="list-disc pl-4 space-y-0.5">
                <li>Solo se pueden pagar solicitudes que estén en estado <strong>Pago programado</strong>.</li>
                <li>Cada cambio de estado queda registrado con el detalle «{MASSIVE_PAID_NOTE}».</li>
                <li>Puedes desmarcar las solicitudes que no quieras pagar antes de procesar.</li>
                <li>Las filas sin ID de solicitud no se pueden procesar: vuelve a generar la nómina desde «Agregar desde solicitudes».</li>
              </ul>
            </div>
          </div>
        )}

        {phase === 'validating' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm">
                <Search className="h-4 w-4 animate-pulse text-primary" />
                <span className="font-medium">Validando solicitudes…</span>
              </div>
              <div className="text-sm text-muted-foreground">{validateIndex} de {validateTotal}</div>
            </div>
            <Progress value={validatePct} />
            <p className="text-xs text-muted-foreground">
              Estamos consultando el estado actual de cada solicitud del archivo.
            </p>
          </div>
        )}

        {phase === 'review' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2 text-sm">
                <FileSpreadsheet className="h-4 w-4 text-primary" />
                <span className="font-medium">{fileName}</span>
                <Badge variant="secondary">{rows.length} {rows.length === 1 ? 'fila' : 'filas'}</Badge>
                <Badge variant="outline">{readyRows.length} elegibles</Badge>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={resetAll}>Cambiar archivo</Button>
                <Button size="sm" disabled={selectedRows.length === 0} onClick={() => setConfirmOpen(true)}>
                  <Play className="h-4 w-4 mr-2" />
                  Marcar como Pagadas ({selectedRows.length})
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <KpiCard label="Seleccionadas" value={selectedRows.length} total={rows.length} variant="success" />
              <KpiCard label="No elegibles" value={rows.filter(r => r.rowStatus === 'wrong_status').length} total={rows.length} variant="warning" />
              <KpiCard label="Con problema" value={rows.filter(r => r.rowStatus === 'not_found' || r.rowStatus === 'invalid').length} total={rows.length} variant="danger" />
              <KpiCard label="Monto a pagar" value={clp(selectedTotal)} variant="info" />
            </div>

            <div className="rounded-md border max-h-[460px] overflow-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-background z-10">
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={readyRows.length > 0 && selected.size === readyRows.length}
                        onCheckedChange={toggleAll}
                        disabled={readyRows.length === 0}
                        aria-label="Seleccionar todas"
                      />
                    </TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>RUT</TableHead>
                    <TableHead>Institución</TableHead>
                    <TableHead className="text-right">Monto devolución</TableHead>
                    <TableHead>Estado actual</TableHead>
                    <TableHead>Detalle</TableHead>
                    <TableHead className="w-12 text-right">Ver</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => {
                    const eligible = r.rowStatus === 'ready'
                    const isSelected = selected.has(r.lineNumber)
                    return (
                      <TableRow
                        key={r.lineNumber}
                        className={
                          !eligible
                            ? 'bg-muted/40 opacity-80'
                            : isSelected ? 'bg-primary/5 cursor-pointer' : 'cursor-pointer'
                        }
                        onClick={() => eligible && toggleRow(r.lineNumber)}
                      >
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={isSelected}
                            disabled={!eligible}
                            onCheckedChange={() => toggleRow(r.lineNumber)}
                            aria-label={`Seleccionar ${r.fullName}`}
                          />
                        </TableCell>
                        <TableCell className="text-xs">
                          <div className="font-medium">{r.fullName || r.refund?.fullName || '—'}</div>
                          {r.refundId && (
                            <div className="font-mono text-[10px] text-muted-foreground">ID {r.refundId.slice(-8)}</div>
                          )}
                        </TableCell>
                        <TableCell className="text-xs font-mono">{r.rut || '—'}</TableCell>
                        <TableCell className="text-xs">{r.institucion || r.refund?.institutionId || '—'}</TableCell>
                        <TableCell className="text-xs text-right font-medium tabular-nums">{clp(r.monto)}</TableCell>
                        <TableCell>{rowStatusBadge(r)}</TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[260px]">{r.reason}</TableCell>
                        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                          {r.refund?.publicId && (
                            <Button asChild variant="ghost" size="sm">
                              <Link to={`/refunds/${r.refund.publicId}`} target="_blank">
                                <ExternalLink className="h-3.5 w-3.5" />
                              </Link>
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        {phase === 'processing' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <span className="font-medium">Actualizando estados…</span>
              </div>
              <div className="text-sm text-muted-foreground">{progressIndex} de {selectedRows.length}</div>
            </div>
            <Progress value={progressPct} />
            {results.length > 0 && (
              <div className="rounded-md border max-h-80 overflow-auto">
                <Table>
                  <TableHeader className="sticky top-0 bg-background">
                    <TableRow>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Resultado</TableHead>
                      <TableHead>Detalle</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {results.slice().reverse().slice(0, 10).map((r) => (
                      <TableRow key={r.lineNumber}>
                        <TableCell className="text-xs">{r.fullName || '—'}</TableCell>
                        <TableCell>{resultBadge(r.status)}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{r.reason}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        )}

        {phase === 'results' && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <KpiCard label="Pagadas" value={totals.success} total={totals.total} variant="success" />
              <KpiCard label="Omitidas" value={totals.skipped} total={totals.total} variant="warning" />
              <KpiCard label="Con error" value={totals.error} total={totals.total} variant="danger" />
              <KpiCard label="Duración" value={formatDuration(Math.max(0, finishedAt - startedAt))} variant="info" />
            </div>

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={handleDownloadSummary} disabled={results.length === 0}>
                <FileSpreadsheet className="h-4 w-4 mr-2" /> Descargar resumen.csv
              </Button>
              <Button variant="ghost" onClick={resetAll}>
                <RefreshCw className="h-4 w-4 mr-2" /> Procesar otro archivo
              </Button>
            </div>

            <Tabs value={filter} onValueChange={(v) => setFilter(v as ResultFilter)}>
              <TabsList>
                <TabsTrigger value="all">Todas ({totals.total})</TabsTrigger>
                <TabsTrigger value="success">Pagadas ({totals.success})</TabsTrigger>
                <TabsTrigger value="error">Con error ({totals.error})</TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="rounded-md border max-h-[500px] overflow-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-background">
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>RUT</TableHead>
                    <TableHead className="text-right">Monto</TableHead>
                    <TableHead>Resultado</TableHead>
                    <TableHead>Detalle</TableHead>
                    <TableHead className="w-12 text-right">Ver</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredResults.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">
                        No hay resultados para este filtro.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredResults.map((r) => (
                      <TableRow key={r.lineNumber}>
                        <TableCell className="text-xs">{r.fullName || '—'}</TableCell>
                        <TableCell className="text-xs font-mono">{r.rut || '—'}</TableCell>
                        <TableCell className="text-xs text-right tabular-nums">{clp(r.monto)}</TableCell>
                        <TableCell>{resultBadge(r.status)}</TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[300px]">{r.reason}</TableCell>
                        <TableCell className="text-right">
                          {r.publicId && (
                            <Button asChild variant="ghost" size="sm">
                              <Link to={`/refunds/${r.publicId}`} target="_blank">
                                <ExternalLink className="h-3.5 w-3.5" />
                              </Link>
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </CardContent>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar cambio masivo a Pagada</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <p>
                  Se cambiarán <strong>{selectedRows.length}</strong> solicitudes desde
                  {' '}<strong>Pago programado</strong> a <strong>Pagada</strong>.
                </p>
                <p>Monto total: <strong>{clp(selectedTotal)}</strong></p>
                <p className="text-xs text-muted-foreground">
                  El historial registrará el detalle «{MASSIVE_PAID_NOTE}». Esta acción no se puede deshacer masivamente.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={startProcessing}>Confirmar y procesar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}
