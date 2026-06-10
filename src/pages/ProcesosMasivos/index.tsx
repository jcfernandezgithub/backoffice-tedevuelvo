import { useMemo, useRef, useState } from 'react'
import JSZip from 'jszip'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  Upload, Download, FileSpreadsheet, FileText, CheckCircle2, AlertTriangle, XCircle,
  Loader2, RefreshCw, ExternalLink, Package, FileDown, Play,
} from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import {
  parseCsv, buildExampleCsv, processSingleRow, buildSummaryCsv,
  type CsvRow, type ProcessResult, type ResultStatus,
} from './services/corteBatchService'

type Phase = 'upload' | 'review' | 'processing' | 'results'
type ResultFilter = 'all' | ResultStatus

function statusBadge(s: ResultStatus) {
  if (s === 'success') {
    return (
      <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800">
        <CheckCircle2 className="h-3 w-3 mr-1" /> Generada
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

function formatDuration(ms: number) {
  if (ms < 1000) return `${ms} ms`
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  const rs = s % 60
  return `${m}m ${rs}s`
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export default function ProcesosMasivosPage() {
  const [phase, setPhase] = useState<Phase>('upload')
  const [fileName, setFileName] = useState<string>('')
  const [csvRows, setCsvRows] = useState<CsvRow[]>([])
  const [parseError, setParseError] = useState<string>('')

  const [progressIndex, setProgressIndex] = useState(0)
  const [currentRow, setCurrentRow] = useState<CsvRow | null>(null)
  const [results, setResults] = useState<ProcessResult[]>([])
  const [filter, setFilter] = useState<ResultFilter>('all')
  const [startedAt, setStartedAt] = useState<number>(0)
  const [finishedAt, setFinishedAt] = useState<number>(0)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const totals = useMemo(() => {
    const success = results.filter(r => r.status === 'success').length
    const skipped = results.filter(r => r.status === 'skipped').length
    const error = results.filter(r => r.status === 'error').length
    return { success, skipped, error, total: results.length }
  }, [results])

  const filteredResults = useMemo(() => {
    if (filter === 'all') return results
    return results.filter(r => r.status === filter)
  }, [results, filter])

  const handleFileSelected = async (file: File) => {
    setFileName(file.name)
    setParseError('')
    const text = await file.text()
    const { rows, error } = parseCsv(text)
    if (error) {
      setParseError(error)
      setCsvRows([])
      setPhase('upload')
      return
    }
    if (rows.length === 0) {
      setParseError('El archivo no contiene filas de datos.')
      setCsvRows([])
      setPhase('upload')
      return
    }
    if (rows.length > 100) {
      setParseError(`El archivo contiene ${rows.length} filas. El máximo permitido es 100.`)
      setCsvRows([])
      setPhase('upload')
      return
    }
    setCsvRows(rows)
    setPhase('review')
  }

  const handleDownloadExample = () => {
    downloadBlob(new Blob([buildExampleCsv()], { type: 'text/csv;charset=utf-8' }), 'ejemplo_cartas_de_corte.csv')
  }

  const startProcessing = async () => {
    setPhase('processing')
    setResults([])
    setProgressIndex(0)
    setStartedAt(Date.now())
    const accumulated: ProcessResult[] = []
    for (let i = 0; i < csvRows.length; i++) {
      const row = csvRows[i]
      setCurrentRow(row)
      setProgressIndex(i)
      let res: ProcessResult
      try {
        res = await processSingleRow(row)
      } catch (err: any) {
        res = {
          lineNumber: row.lineNumber,
          publicId: row.publicId,
          nroCredito: row.nroCredito,
          nroPoliza: row.nroPoliza,
          companyName: row.companyName,
          status: 'error',
          reason: `Error inesperado: ${err?.message || 'desconocido'}`,
        }
      }
      accumulated.push(res)
      setResults([...accumulated])
    }
    setProgressIndex(csvRows.length)
    setCurrentRow(null)
    setFinishedAt(Date.now())
    setPhase('results')
    toast({
      title: 'Proceso finalizado',
      description: `${accumulated.filter(r => r.status === 'success').length} de ${accumulated.length} cartas generadas correctamente.`,
    })
  }

  const handleDownloadZip = async () => {
    const zip = new JSZip()
    const pdfs = zip.folder('cartas-de-corte')
    results
      .filter(r => r.status === 'success' && r.pdfBlob)
      .forEach(r => {
        pdfs?.file(`${r.kind || 'carta-de-corte'}-${r.publicId}.pdf`, r.pdfBlob as Blob)
      })
    zip.file('resumen.csv', buildSummaryCsv(results))
    const blob = await zip.generateAsync({ type: 'blob' })
    const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
    downloadBlob(blob, `procesos-masivos_cartas-corte_${ts}.zip`)
  }

  const handleDownloadSummary = () => {
    downloadBlob(
      new Blob([buildSummaryCsv(results)], { type: 'text/csv;charset=utf-8' }),
      'resumen_cartas_de_corte.csv',
    )
  }

  const resetAll = () => {
    setPhase('upload')
    setFileName('')
    setCsvRows([])
    setParseError('')
    setResults([])
    setProgressIndex(0)
    setCurrentRow(null)
    setStartedAt(0)
    setFinishedAt(0)
    setFilter('all')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const progressPct = csvRows.length === 0 ? 0 : Math.round((progressIndex / csvRows.length) * 100)

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <Package className="h-6 w-6 text-primary" />
          Procesos Masivos
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Generación masiva de documentos a partir de un archivo de carga.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            Generación masiva de cartas de corte
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Step indicator */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <StepDot active={phase === 'upload'} done={phase !== 'upload'} label="1. Cargar CSV" />
            <span className="flex-1 h-px bg-border" />
            <StepDot active={phase === 'review'} done={phase === 'processing' || phase === 'results'} label="2. Revisión" />
            <span className="flex-1 h-px bg-border" />
            <StepDot active={phase === 'processing'} done={phase === 'results'} label="3. Procesamiento" />
            <span className="flex-1 h-px bg-border" />
            <StepDot active={phase === 'results'} done={false} label="4. Resultado" />
          </div>

          {/* UPLOAD */}
          {phase === 'upload' && (
            <div className="space-y-4">
              <div className="rounded-lg border-2 border-dashed border-border bg-muted/30 p-8 text-center">
                <Upload className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm font-medium">Selecciona un archivo CSV</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Header esperado: <code className="font-mono">publicId,nroCredito,nroPoliza,companyName</code>
                </p>
                <p className="text-xs text-muted-foreground">Máximo 100 solicitudes por archivo.</p>
                <div className="flex gap-2 justify-center mt-4">
                  <Button onClick={() => fileInputRef.current?.click()}>
                    <Upload className="h-4 w-4 mr-2" />
                    Seleccionar archivo
                  </Button>
                  <Button variant="outline" onClick={handleDownloadExample}>
                    <FileDown className="h-4 w-4 mr-2" />
                    Descargar CSV de ejemplo
                  </Button>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) handleFileSelected(f)
                  }}
                />
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
                  <li>Los campos <code>nroCredito</code>, <code>nroPoliza</code> y <code>companyName</code> se guardarán en el snapshot de cada solicitud.</li>
                  <li>Las solicitudes que ya tengan una carta de corte cargada serán <strong>omitidas</strong> e informadas en el resumen.</li>
                  <li>El formato (Santander/Tanner/Financorp o genérico) y el tipo (desgravamen/cesantía) se determinan automáticamente desde la solicitud.</li>
                  <li>Solo se generan cartas para solicitudes con mandato firmado.</li>
                </ul>
              </div>
            </div>
          )}

          {/* REVIEW */}
          {phase === 'review' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2 text-sm">
                  <FileSpreadsheet className="h-4 w-4 text-primary" />
                  <span className="font-medium">{fileName}</span>
                  <Badge variant="secondary">{csvRows.length} {csvRows.length === 1 ? 'fila' : 'filas'}</Badge>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={resetAll}>
                    Cambiar archivo
                  </Button>
                  <Button size="sm" onClick={startProcessing}>
                    <Play className="h-4 w-4 mr-2" />
                    Procesar {csvRows.length} solicitudes
                  </Button>
                </div>
              </div>

              <div className="rounded-md border max-h-96 overflow-auto">
                <Table>
                  <TableHeader className="sticky top-0 bg-background">
                    <TableRow>
                      <TableHead className="w-16">#</TableHead>
                      <TableHead>publicId</TableHead>
                      <TableHead>Nº Crédito</TableHead>
                      <TableHead>Nº Póliza</TableHead>
                      <TableHead>Compañía</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {csvRows.map((r) => {
                      const missing = !r.publicId || !r.nroCredito || !r.nroPoliza || !r.companyName
                      return (
                        <TableRow key={r.lineNumber} className={missing ? 'bg-amber-50/60 dark:bg-amber-950/20' : ''}>
                          <TableCell className="font-mono text-xs">{r.lineNumber}</TableCell>
                          <TableCell className="font-mono text-xs">
                            {r.publicId || <span className="text-destructive">— vacío —</span>}
                          </TableCell>
                          <TableCell className="text-xs">{r.nroCredito || <span className="text-destructive">—</span>}</TableCell>
                          <TableCell className="text-xs">{r.nroPoliza || <span className="text-destructive">—</span>}</TableCell>
                          <TableCell className="text-xs">{r.companyName || <span className="text-destructive">—</span>}</TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {/* PROCESSING */}
          {phase === 'processing' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  <span className="font-medium">Procesando…</span>
                </div>
                <div className="text-sm text-muted-foreground">
                  {progressIndex} de {csvRows.length}
                </div>
              </div>
              <Progress value={progressPct} />
              {currentRow && (
                <p className="text-xs text-muted-foreground">
                  Procesando solicitud <code className="font-mono">{currentRow.publicId}</code>…
                </p>
              )}
              {results.length > 0 && (
                <div className="rounded-md border max-h-80 overflow-auto">
                  <Table>
                    <TableHeader className="sticky top-0 bg-background">
                      <TableRow>
                        <TableHead className="w-16">Línea</TableHead>
                        <TableHead>publicId</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead>Detalle</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {results.slice().reverse().slice(0, 10).map((r) => (
                        <TableRow key={r.lineNumber}>
                          <TableCell className="font-mono text-xs">{r.lineNumber}</TableCell>
                          <TableCell className="font-mono text-xs">{r.publicId}</TableCell>
                          <TableCell>{statusBadge(r.status)}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{r.reason}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          )}

          {/* RESULTS */}
          {phase === 'results' && (
            <div className="space-y-5">
              {/* KPI cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <KpiCard label="Generadas" value={totals.success} total={totals.total} variant="success" />
                <KpiCard label="Omitidas" value={totals.skipped} total={totals.total} variant="warning" />
                <KpiCard label="Con error" value={totals.error} total={totals.total} variant="danger" />
                <KpiCard label="Duración" value={formatDuration(Math.max(0, finishedAt - startedAt))} variant="info" />
              </div>

              {/* Global actions */}
              <div className="flex flex-wrap gap-2">
                <Button onClick={handleDownloadZip} disabled={totals.success === 0}>
                  <Download className="h-4 w-4 mr-2" />
                  Descargar ZIP ({totals.success} PDF{totals.success === 1 ? '' : 's'} + resumen)
                </Button>
                <Button variant="outline" onClick={handleDownloadSummary}>
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  Descargar solo resumen.csv
                </Button>
                <Button variant="ghost" onClick={resetAll}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Procesar otro archivo
                </Button>
              </div>

              {/* Filter tabs */}
              <Tabs value={filter} onValueChange={(v) => setFilter(v as ResultFilter)}>
                <TabsList>
                  <TabsTrigger value="all">Todas ({totals.total})</TabsTrigger>
                  <TabsTrigger value="success">Generadas ({totals.success})</TabsTrigger>
                  <TabsTrigger value="skipped">Omitidas ({totals.skipped})</TabsTrigger>
                  <TabsTrigger value="error">Con error ({totals.error})</TabsTrigger>
                </TabsList>
              </Tabs>

              {/* Details table */}
              <div className="rounded-md border max-h-[500px] overflow-auto">
                <Table>
                  <TableHeader className="sticky top-0 bg-background">
                    <TableRow>
                      <TableHead className="w-14">#</TableHead>
                      <TableHead>publicId</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Motivo</TableHead>
                      <TableHead className="w-16 text-right">Acción</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredResults.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-8">
                          No hay resultados para este filtro.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredResults.map((r) => (
                        <TableRow key={r.lineNumber}>
                          <TableCell className="font-mono text-xs">{r.lineNumber}</TableCell>
                          <TableCell className="font-mono text-xs">{r.publicId}</TableCell>
                          <TableCell className="text-xs">{r.fullName || '—'}</TableCell>
                          <TableCell className="text-xs">
                            {r.kind ? <Badge variant="outline" className="font-mono text-[10px]">{r.kind}</Badge> : '—'}
                          </TableCell>
                          <TableCell>{statusBadge(r.status)}</TableCell>
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
      </Card>
    </div>
  )
}

function StepDot({ active, done, label }: { active: boolean; done: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <div
        className={
          'h-2.5 w-2.5 rounded-full ' +
          (done ? 'bg-emerald-500' : active ? 'bg-primary animate-pulse' : 'bg-muted-foreground/30')
        }
      />
      <span className={active || done ? 'text-foreground font-medium' : ''}>{label}</span>
    </div>
  )
}

function KpiCard({
  label, value, total, variant,
}: {
  label: string
  value: number | string
  total?: number
  variant: 'success' | 'warning' | 'danger' | 'info'
}) {
  const styles: Record<string, string> = {
    success: 'border-emerald-300 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200 dark:border-emerald-800',
    warning: 'border-amber-300 bg-amber-50 text-amber-900 dark:bg-amber-950/30 dark:text-amber-200 dark:border-amber-800',
    danger: 'border-rose-300 bg-rose-50 text-rose-900 dark:bg-rose-950/30 dark:text-rose-200 dark:border-rose-800',
    info: 'border-sky-300 bg-sky-50 text-sky-900 dark:bg-sky-950/30 dark:text-sky-200 dark:border-sky-800',
  }
  const pct = typeof value === 'number' && total && total > 0 ? Math.round((value / total) * 100) : null
  return (
    <div className={`rounded-lg border p-4 ${styles[variant]}`}>
      <p className="text-xs font-medium uppercase tracking-wide opacity-80">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
      {pct !== null && (
        <p className="text-xs opacity-70 mt-0.5">{pct}% del total</p>
      )}
    </div>
  )
}
