import { useEffect, useMemo, useRef, useState } from 'react'
import JSZip from 'jszip'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  Upload, Download, FileSpreadsheet, Shield, XCircle,
  Loader2, RefreshCw, ExternalLink, FileDown, Play, Hash,
} from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import {
  parseCsv, buildExampleCsv, processSingleRow, buildSummaryCsv, preloadFirmas,
  type CertificadoCsvRow, type CertificadoResult,
} from '../services/certificadoBatchService'
import {
  statusBadge, formatDuration, downloadBlob, StepDot, KpiCard,
  type ResultStatus,
} from '../components/wizardUi'

type Phase = 'upload' | 'review' | 'processing' | 'results'
type ResultFilter = 'all' | ResultStatus

export default function CertificadosCoberturaWizard() {
  const [phase, setPhase] = useState<Phase>('upload')
  const [fileName, setFileName] = useState<string>('')
  const [csvRows, setCsvRows] = useState<CertificadoCsvRow[]>([])
  const [parseError, setParseError] = useState<string>('')

  const [progressIndex, setProgressIndex] = useState(0)
  const [currentRow, setCurrentRow] = useState<CertificadoCsvRow | null>(null)
  const [results, setResults] = useState<CertificadoResult[]>([])
  const [filter, setFilter] = useState<ResultFilter>('all')
  const [startedAt, setStartedAt] = useState<number>(0)
  const [finishedAt, setFinishedAt] = useState<number>(0)

  const fileInputRef = useRef<HTMLInputElement>(null)

  // Preload firma assets eagerly so first PDF doesn't pay the cost
  useEffect(() => { preloadFirmas() }, [])

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
    setFileName(file.name); setParseError('')
    const text = await file.text()
    const { rows, error } = parseCsv(text)
    if (error) { setParseError(error); setCsvRows([]); setPhase('upload'); return }
    if (rows.length === 0) {
      setParseError('El archivo no contiene filas de datos.'); setCsvRows([]); setPhase('upload'); return
    }
    if (rows.length > 100) {
      setParseError(`El archivo contiene ${rows.length} filas. El máximo permitido es 100.`)
      setCsvRows([]); setPhase('upload'); return
    }
    setCsvRows(rows); setPhase('review')
  }

  const handleDownloadExample = () => {
    downloadBlob(new Blob([buildExampleCsv()], { type: 'text/csv;charset=utf-8' }), 'ejemplo_certificados_cobertura.csv')
  }

  const startProcessing = async () => {
    setPhase('processing'); setResults([]); setProgressIndex(0); setStartedAt(Date.now())
    const accumulated: CertificadoResult[] = []
    for (let i = 0; i < csvRows.length; i++) {
      const row = csvRows[i]
      setCurrentRow(row); setProgressIndex(i)
      let res: CertificadoResult
      try {
        res = await processSingleRow(row)
      } catch (err: any) {
        res = {
          lineNumber: row.lineNumber, publicId: row.publicId,
          nroOperacion: row.nroOperacion, saldoInsoluto: row.saldoInsoluto,
          status: 'error', reason: `Error inesperado: ${err?.message || 'desconocido'}`,
        }
      }
      accumulated.push(res); setResults([...accumulated])
    }
    setProgressIndex(csvRows.length); setCurrentRow(null); setFinishedAt(Date.now()); setPhase('results')
    toast({
      title: 'Proceso finalizado',
      description: `${accumulated.filter(r => r.status === 'success').length} de ${accumulated.length} certificados generados correctamente.`,
    })
  }

  const handleDownloadZip = async () => {
    const zip = new JSZip()
    const pdfs = zip.folder('certificados-de-cobertura')
    results.filter(r => r.status === 'success' && r.pdfBlob).forEach(r => {
      const folioSuffix = r.folio ? `-folio-${r.folio}` : ''
      pdfs?.file(`certificado-cobertura-${r.publicId}${folioSuffix}.pdf`, r.pdfBlob as Blob)
    })
    zip.file('resumen.csv', buildSummaryCsv(results))
    const blob = await zip.generateAsync({ type: 'blob' })
    const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
    downloadBlob(blob, `procesos-masivos_certificados-cobertura_${ts}.zip`)
  }

  const handleDownloadSummary = () => {
    downloadBlob(
      new Blob([buildSummaryCsv(results)], { type: 'text/csv;charset=utf-8' }),
      'resumen_certificados_cobertura.csv',
    )
  }

  const resetAll = () => {
    setPhase('upload'); setFileName(''); setCsvRows([]); setParseError('')
    setResults([]); setProgressIndex(0); setCurrentRow(null)
    setStartedAt(0); setFinishedAt(0); setFilter('all')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const progressPct = csvRows.length === 0 ? 0 : Math.round((progressIndex / csvRows.length) * 100)

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Shield className="h-4 w-4 text-primary" />
          Generación masiva de certificados de cobertura
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <StepDot active={phase === 'upload'} done={phase !== 'upload'} label="1. Cargar CSV" />
          <span className="flex-1 h-px bg-border" />
          <StepDot active={phase === 'review'} done={phase === 'processing' || phase === 'results'} label="2. Revisión" />
          <span className="flex-1 h-px bg-border" />
          <StepDot active={phase === 'processing'} done={phase === 'results'} label="3. Procesamiento" />
          <span className="flex-1 h-px bg-border" />
          <StepDot active={phase === 'results'} done={false} label="4. Resultado" />
        </div>

        {phase === 'upload' && (
          <div className="space-y-4">
            <div className="rounded-lg border-2 border-dashed border-border bg-muted/30 p-8 text-center">
              <Upload className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm font-medium">Selecciona un archivo CSV</p>
              <p className="text-xs text-muted-foreground mt-1">
                15 columnas. Obligatorios: <code className="font-mono">publicId</code>, <code className="font-mono">nroOperacion</code>.
              </p>
              <p className="text-xs text-muted-foreground">Máximo 100 solicitudes por archivo.</p>
              <div className="flex gap-2 justify-center mt-4">
                <Button onClick={() => fileInputRef.current?.click()}>
                  <Upload className="h-4 w-4 mr-2" /> Seleccionar archivo
                </Button>
                <Button variant="outline" onClick={handleDownloadExample}>
                  <FileDown className="h-4 w-4 mr-2" /> Descargar CSV de ejemplo
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
                <li>Se genera un certificado <strong>Póliza 347 Desgravamen</strong> por fila, usando el formato según institución (Banco de Chile, Chevrolet SF o genérico).</li>
                <li>El <strong>folio</strong> se asigna automáticamente si la solicitud no lo tiene.</li>
                <li>Se omiten solicitudes en estado anterior a <code>docs_received</code>, sin mandato firmado, sin cuotas pendientes en el snapshot, o que ya tengan un certificado cargado.</li>
                <li>Para <strong>Chevrolet SF</strong> los campos <code>beneficiarioNombre</code> y <code>beneficiarioRut</code> son obligatorios. En Banco de Chile el beneficiario se fija en el template.</li>
                <li>Si <code>fechaInicioCobertura</code>/<code>fechaFinCobertura</code> vienen vacíos, se calculan desde la transición a "Ingresada" + cuotas pendientes.</li>
                <li>Si <code>saldoInsoluto</code> viene vacío, se toma del snapshot.</li>
              </ul>
            </div>
          </div>
        )}

        {phase === 'review' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2 text-sm">
                <FileSpreadsheet className="h-4 w-4 text-primary" />
                <span className="font-medium">{fileName}</span>
                <Badge variant="secondary">{csvRows.length} {csvRows.length === 1 ? 'fila' : 'filas'}</Badge>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={resetAll}>Cambiar archivo</Button>
                <Button size="sm" onClick={startProcessing}>
                  <Play className="h-4 w-4 mr-2" /> Procesar {csvRows.length} solicitudes
                </Button>
              </div>
            </div>

            <div className="rounded-md border max-h-96 overflow-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-background">
                  <TableRow>
                    <TableHead className="w-14">#</TableHead>
                    <TableHead>publicId</TableHead>
                    <TableHead>Nº Operación</TableHead>
                    <TableHead>Saldo Insoluto</TableHead>
                    <TableHead>Inicio</TableHead>
                    <TableHead>Fin</TableHead>
                    <TableHead>Beneficiario</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {csvRows.map((r) => {
                    const missing = !r.publicId || !r.nroOperacion
                    return (
                      <TableRow key={r.lineNumber} className={missing ? 'bg-amber-50/60 dark:bg-amber-950/20' : ''}>
                        <TableCell className="font-mono text-xs">{r.lineNumber}</TableCell>
                        <TableCell className="font-mono text-xs">
                          {r.publicId || <span className="text-destructive">— vacío —</span>}
                        </TableCell>
                        <TableCell className="text-xs">{r.nroOperacion || <span className="text-destructive">—</span>}</TableCell>
                        <TableCell className="text-xs">{r.saldoInsoluto || <span className="text-muted-foreground">snapshot</span>}</TableCell>
                        <TableCell className="text-xs">{r.fechaInicioCobertura || <span className="text-muted-foreground">auto</span>}</TableCell>
                        <TableCell className="text-xs">{r.fechaFinCobertura || <span className="text-muted-foreground">auto</span>}</TableCell>
                        <TableCell className="text-xs">
                          {r.beneficiarioNombre ? (
                            <span className="truncate inline-block max-w-[200px]">{r.beneficiarioNombre}</span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
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
                <span className="font-medium">Procesando…</span>
              </div>
              <div className="text-sm text-muted-foreground">{progressIndex} de {csvRows.length}</div>
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
                      <TableHead>Folio</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Detalle</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {results.slice().reverse().slice(0, 10).map((r) => (
                      <TableRow key={r.lineNumber}>
                        <TableCell className="font-mono text-xs">{r.lineNumber}</TableCell>
                        <TableCell className="font-mono text-xs">{r.publicId}</TableCell>
                        <TableCell className="font-mono text-xs">{r.folio || '—'}</TableCell>
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

        {phase === 'results' && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <KpiCard label="Generados" value={totals.success} total={totals.total} variant="success" />
              <KpiCard label="Omitidos" value={totals.skipped} total={totals.total} variant="warning" />
              <KpiCard label="Con error" value={totals.error} total={totals.total} variant="danger" />
              <KpiCard label="Duración" value={formatDuration(Math.max(0, finishedAt - startedAt))} variant="info" />
            </div>

            <div className="flex flex-wrap gap-2">
              <Button onClick={handleDownloadZip} disabled={totals.success === 0}>
                <Download className="h-4 w-4 mr-2" />
                Descargar ZIP ({totals.success} PDF{totals.success === 1 ? '' : 's'} + resumen)
              </Button>
              <Button variant="outline" onClick={handleDownloadSummary}>
                <FileSpreadsheet className="h-4 w-4 mr-2" /> Descargar solo resumen.csv
              </Button>
              <Button variant="ghost" onClick={resetAll}>
                <RefreshCw className="h-4 w-4 mr-2" /> Procesar otro archivo
              </Button>
            </div>

            <Tabs value={filter} onValueChange={(v) => setFilter(v as ResultFilter)}>
              <TabsList>
                <TabsTrigger value="all">Todos ({totals.total})</TabsTrigger>
                <TabsTrigger value="success">Generados ({totals.success})</TabsTrigger>
                <TabsTrigger value="skipped">Omitidos ({totals.skipped})</TabsTrigger>
                <TabsTrigger value="error">Con error ({totals.error})</TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="rounded-md border max-h-[500px] overflow-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-background">
                  <TableRow>
                    <TableHead className="w-14">#</TableHead>
                    <TableHead>publicId</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Folio</TableHead>
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
                          {r.folio ? (
                            <span className="inline-flex items-center gap-1 font-mono"><Hash className="h-3 w-3" />{r.folio}</span>
                          ) : '—'}
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
  )
}