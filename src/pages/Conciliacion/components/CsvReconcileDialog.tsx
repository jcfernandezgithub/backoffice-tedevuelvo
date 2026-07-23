import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  History,
  Loader2,
  RotateCw,
  Upload,
  X,
} from 'lucide-react'
import { AlertTriangle } from 'lucide-react'
import { formatCurrency } from '@/lib/formatters'
import { toast } from '@/hooks/use-toast'
import { useAuth } from '@/state/AuthContext'
import { usePendingRefunds } from '../hooks/usePendingRefunds'
import { cartolaLinksService } from '../services/cartolaLinksService'
import { Checkbox } from '@/components/ui/checkbox'

import {
  computeTotals,
  downloadCsv,
  loadHistory,
  matchAgainstSystem,
  parseCsv,
  rowsToCsv,
  saveHistory,
  STATUS_LABELS,
  templateCsv,
  type CsvHistoryEntry,
  type CsvRowStatus,
  type ProcessedRow,
} from '../services/csvReconcileService'
import type { CartolaMovementRef } from './LinkRefundsDialog'

/**
 * Prima total TDV que se descuenta del monto informado en el CSV para
 * obtener el monto real de devolución que se guarda en la solicitud.
 *   primaTotalTDV = newMonthlyPremium × cuotasPendientes
 *   montoReal     = max(0, montoCSV − primaTotalTDV)
 */
function primaTotalTDV(r: ProcessedRow): number {
  const prima = Number(r.matchedNewMonthlyPremium ?? 0)
  const cuotas = Number(r.matchedRemainingInstallments ?? 0)
  if (!prima || !cuotas) return 0
  return Math.round(prima * cuotas)
}

function montoRealDevolucion(r: ProcessedRow): number {
  return Math.max(0, Math.round(r.monto - primaTotalTDV(r)))
}

interface Props {
  movement: CartolaMovementRef | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onApplied?: () => void
}

type Step = 'upload' | 'preview' | 'result' | 'history'

const STATUS_STYLES: Record<CsvRowStatus, string> = {
  valid: 'bg-sky-50 text-sky-700 border-sky-200',
  reconciled: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  not_found: 'bg-muted text-muted-foreground border-border',
  duplicated_in_csv: 'bg-amber-50 text-amber-800 border-amber-200',
  duplicated_in_system: 'bg-amber-50 text-amber-800 border-amber-200',
  already_reconciled_here: 'bg-emerald-50/60 text-emerald-700 border-emerald-200',
  linked_to_other_movement: 'bg-orange-50 text-orange-800 border-orange-200',
  format_error: 'bg-destructive/10 text-destructive border-destructive/30',
  apply_error: 'bg-destructive/10 text-destructive border-destructive/30',
  status_updated_no_link: 'bg-amber-50 text-amber-900 border-amber-300',
}

export function CsvReconcileDialog({ movement, open, onOpenChange, onApplied }: Props) {
  const qc = useQueryClient()
  const { user } = useAuth()
  const pendingQuery = usePendingRefunds()

  const [step, setStep] = useState<Step>('upload')
  const [file, setFile] = useState<File | null>(null)
  const [rows, setRows] = useState<ProcessedRow[]>([])
  const [parseError, setParseError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [filterStatus, setFilterStatus] = useState<CsvRowStatus | 'all'>('all')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [history, setHistory] = useState<CsvHistoryEntry[]>([])
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (open) {
      setStep('upload')
      setFile(null)
      setRows([])
      setParseError(null)
      setProcessing(false)
      setProgress(0)
      setFilterStatus('all')
      if (movement) setHistory(loadHistory(movement.documentoNumero))
    }
  }, [open, movement?.documentoNumero])

  const handleClose = (next: boolean) => {
    if (!next && processing) return
    onOpenChange(next)
  }

  const handleFile = useCallback(async (f: File | null) => {
    if (!f) return
    setFile(f)
    setParseError(null)
    const result = await parseCsv(f)
    if (result.fatalError || result.headerError) {
      setParseError(result.fatalError ?? result.headerError ?? 'Archivo inválido.')
      setRows([])
      return
    }
    setRows(result.rows)
    setStep('preview')
  }, [])

  // Al llegar a preview, cruzar contra sistema.
  useEffect(() => {
    if (step !== 'preview' || !movement || rows.length === 0) return
    if (pendingQuery.isLoading) return
    let cancelled = false
    ;(async () => {
      try {
        const detail = await cartolaLinksService.getByMovement(movement.documentoNumero)
        if (cancelled) return
        const publicIdToDoc: Record<string, string> = {}
        for (const l of detail.links) publicIdToDoc[l.refundId] = movement.documentoNumero
        const matched = matchAgainstSystem(rows, {
          documentoNumero: movement.documentoNumero,
          refunds: pendingQuery.data ?? [],
          linksByDoc: {},
          publicIdToDoc,
        })
        if (!cancelled) setRows(matched)
      } catch (err: any) {
        if (!cancelled)
          setParseError(err?.message ?? 'No se pudieron cargar las solicitudes para el cruce.')
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, pendingQuery.isLoading, movement?.documentoNumero])

  const totals = useMemo(() => computeTotals(rows), [rows])
  const filteredRows = useMemo(
    () => (filterStatus === 'all' ? rows : rows.filter((r) => r.status === filterStatus)),
    [rows, filterStatus],
  )

  const validRows = useMemo(() => rows.filter((r) => r.status === 'valid'), [rows])
  const approvedRows = useMemo(
    () => validRows.filter((r) => r.approved !== false),
    [validRows],
  )
  const totalToApply = approvedRows.reduce((s, r) => s + r.monto, 0)
  const totalRealAmount = approvedRows.reduce((s, r) => s + montoRealDevolucion(r), 0)
  const totalPrimaTDV = approvedRows.reduce((s, r) => s + primaTotalTDV(r), 0)
  const abono = movement?.abono ?? 0
  const overApplied = totalToApply > abono + 0.5
  const hasStructuralErrors = totals.format_error > 0 || totals.duplicated_in_csv > 0
  const canProcess = !processing && approvedRows.length > 0 && !overApplied
  const allValidApproved =
    validRows.length > 0 && validRows.every((r) => r.approved !== false)

  const toggleRowApproved = (rowNumber: number, next: boolean) => {
    setRows((prev) =>
      prev.map((r) => (r.rowNumber === rowNumber ? { ...r, approved: next } : r)),
    )
  }
  const toggleAllApproved = (next: boolean) => {
    setRows((prev) =>
      prev.map((r) => (r.status === 'valid' ? { ...r, approved: next } : r)),
    )
  }

  const [progressLabel, setProgressLabel] = useState('')

  const runProcess = async () => {
    if (!movement || approvedRows.length === 0) return
    setProcessing(true)
    setProgress(2)
    setProgressLabel('Preparando…')

    const targets = approvedRows.slice()
    let linkError: string | null = null

    setProgressLabel('Asociando solicitudes al movimiento…')
    setProgress(80)
    try {
      await cartolaLinksService.applyMatches(
        movement.documentoNumero,
        targets.map((r) => ({
          publicId: r.matchedPublicId!,
          amountApplied: Math.round(r.monto),
          realAmount: montoRealDevolucion(r),
        })),
      )
    } catch (err: any) {
      linkError = err?.message ?? 'No se pudo asociar al movimiento bancario.'
    }

    const nextRows: ProcessedRow[] = rows.map((r) => {
      if (r.status !== 'valid') return r
      if (!targets.some((t) => t.rowNumber === r.rowNumber)) return r
      if (linkError) {
        return {
          ...r,
          status: 'apply_error',
          detail: linkError,
        }
      }
      return {
        ...r,
        status: 'reconciled',
        detail: `Solicitud pasada a Pago Programado con monto real ${formatCurrency(
          montoRealDevolucion(r),
        )} (abono CSV ${formatCurrency(r.monto)} − prima TDV ${formatCurrency(
          primaTotalTDV(r),
        )}) y asociada al movimiento ${movement.documentoNumero}.`,
      }
    })

    setRows(nextRows)
    setProgress(100)
    setProgressLabel('Listo')

    const okCount = nextRows.filter((r) => r.status === 'reconciled').length
    const errCount = nextRows.filter((r) => r.status === 'apply_error').length
    const overall: CsvHistoryEntry['overallStatus'] =
      errCount === 0 ? 'success' : okCount === 0 ? 'error' : 'partial'
    persistHistory(nextRows, overall)

    qc.invalidateQueries({ queryKey: ['cartola-reconciliation'] })
    qc.invalidateQueries({ queryKey: ['conciliacion', 'pending-refunds'] })
    qc.invalidateQueries({ queryKey: ['refund-admin-search'] })
    qc.invalidateQueries({ queryKey: ['refund'] })
    onApplied?.()

    if (okCount > 0 && errCount === 0) {
      toast({
        title: 'Conciliación aplicada',
        description: `${okCount} solicitud${okCount === 1 ? '' : 'es'} programada${okCount === 1 ? '' : 's'} para pago y asociada${okCount === 1 ? '' : 's'} al movimiento.`,
      })
    } else if (okCount > 0) {
      toast({
        title: 'Conciliación parcial',
        description: `${okCount} correcta${okCount === 1 ? '' : 's'} · ${errCount} con error.`,
      })
    } else {
      toast({
        title: 'No se pudo conciliar',
        description: linkError ?? 'Ninguna solicitud pudo procesarse.',
        variant: 'destructive',
      })
    }

    setStep('result')
    setProcessing(false)
  }


  const persistHistory = (finalRows: ProcessedRow[], overall: CsvHistoryEntry['overallStatus']) => {
    if (!movement || !file) return
    const t = computeTotals(finalRows)
    saveHistory({
      id: `${Date.now()}`,
      documentoNumero: movement.documentoNumero,
      fileName: file.name,
      at: new Date().toISOString(),
      user: user?.email ?? user?.nombre ?? undefined,
      totals: t,
      overallStatus: overall,
      rows: finalRows,
    })
    setHistory(loadHistory(movement.documentoNumero))
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const f = e.dataTransfer?.files?.[0]
    if (f) handleFile(f)
  }

  const retryErrorsOnly = () => {
    const errorRows = rows.filter(
      (r) => r.status === 'not_found' || r.status === 'apply_error' || r.status === 'format_error',
    )
    if (errorRows.length === 0) return
    // Volver al paso preview con esos registros y re-cruzar.
    setRows(errorRows.map((r) => ({ ...r, status: 'valid', detail: '' })))
    setStep('preview')
  }

  if (!movement) return null

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-[min(96vw,1200px)] h-[92vh] overflow-hidden flex flex-col gap-4">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            Conciliar mediante CSV
          </DialogTitle>
          <DialogDescription>
            Sube un archivo CSV con las solicitudes a asociar a este abono usando el{' '}
            <strong>número de operación</strong> como llave.
          </DialogDescription>
        </DialogHeader>

        {/* Resumen del movimiento */}
        <div className="shrink-0 rounded-lg border bg-muted/40 p-3 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <div className="md:col-span-2 min-w-0">
            <div className="text-muted-foreground text-xs">Movimiento</div>
            <div className="font-medium truncate" title={movement.descripcion}>
              {movement.descripcion || '—'}
            </div>
            <div className="text-xs text-muted-foreground">
              Doc. <span className="font-mono">{movement.documentoNumero}</span> · {movement.fecha}
            </div>
          </div>
          <div>
            <div className="text-muted-foreground text-xs">Abono</div>
            <div className="font-semibold text-emerald-700">{formatCurrency(abono)}</div>
          </div>
          <div>
            <div className="text-muted-foreground text-xs">A aplicar</div>
            <div
              className={`font-semibold ${overApplied ? 'text-destructive' : 'text-foreground'}`}
            >
              {formatCurrency(totalToApply)}
            </div>
            {overApplied && (
              <div className="text-[11px] text-destructive">Supera el abono disponible.</div>
            )}
          </div>
        </div>

        <Tabs value={step} onValueChange={(v) => setStep(v as Step)}>
          <TabsList className="grid grid-cols-4 w-full">
            <TabsTrigger value="upload">1. Archivo</TabsTrigger>
            <TabsTrigger value="preview" disabled={rows.length === 0}>
              2. Vista previa
            </TabsTrigger>
            <TabsTrigger value="result" disabled={!rows.some((r) => r.status === 'reconciled' || r.status === 'apply_error')}>
              3. Resultado
            </TabsTrigger>
            <TabsTrigger value="history">
              <History className="h-3.5 w-3.5 mr-1" /> Historial ({history.length})
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
          {step === 'upload' && (
            <div className="space-y-4">
              <div
                onDragOver={(e) => {
                  e.preventDefault()
                  setDragOver(true)
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
                onClick={() => inputRef.current?.click()}
                className={`cursor-pointer rounded-lg border-2 border-dashed p-10 text-center transition-colors ${
                  dragOver ? 'border-primary bg-primary/5' : 'border-border bg-muted/20 hover:bg-muted/40'
                }`}
              >
                <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <div className="font-medium">Arrastra tu CSV aquí o haz clic para seleccionar</div>
                <div className="text-xs text-muted-foreground mt-1">
                  Solo archivos .csv · máximo 5 MB · hasta 5.000 filas
                </div>
                <input
                  ref={inputRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
                />
              </div>

              {parseError && (
                <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
                  <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                  <div>
                    <div className="font-medium text-destructive">No se pudo procesar el archivo</div>
                    <div className="text-muted-foreground">{parseError}</div>
                  </div>
                </div>
              )}

              <div className="rounded-md border bg-card p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="font-medium">Plantilla CSV</div>
                    <div className="text-xs text-muted-foreground">
                      Columnas: <code>nombre_cliente, rut, numero_operacion, poliza, monto</code>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => downloadCsv('plantilla_conciliacion.csv', templateCsv())}
                  >
                    <Download className="h-4 w-4 mr-1" /> Descargar plantilla
                  </Button>
                </div>
              </div>
            </div>
          )}

          {step === 'preview' && (
            <div className="flex-1 min-h-0 flex flex-col gap-3">
              {pendingQuery.isLoading ? (
                <div className="flex items-center justify-center py-10 text-sm text-muted-foreground gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Cargando solicitudes para el cruce…
                </div>
              ) : (
                <>
                  <SummaryStrip totals={totals} />
                  <StatusFilter
                    totals={totals}
                    value={filterStatus}
                    onChange={setFilterStatus}
                  />
                  {overApplied && (
                    <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-2 text-xs">
                      <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                      <span>
                        La suma de los montos aprobados ({formatCurrency(totalToApply)})
                        supera el abono disponible ({formatCurrency(abono)}). Desmarca
                        alguna solicitud para poder continuar.
                      </span>
                    </div>
                  )}
                  <RowsTable
                    rows={filteredRows}
                    selectable
                    allValidApproved={allValidApproved}
                    onToggleAll={toggleAllApproved}
                    onToggleRow={toggleRowApproved}
                  />
                </>
              )}
            </div>
          )}

          {step === 'result' && (
            <div className="flex-1 min-h-0 flex flex-col gap-3">
              {totals.status_updated_no_link > 0 && (
                <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm">
                  <AlertTriangle className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
                  <div className="text-amber-900">
                    <div className="font-medium">
                      {totals.status_updated_no_link} solicitud
                      {totals.status_updated_no_link === 1 ? '' : 'es'} quedaron con estado
                      actualizado pero sin asociar al movimiento.
                    </div>
                    <div className="text-xs mt-0.5">
                      El monto real de devolución ya se guardó y el estado es Pago Programado.
                      Asócialas manualmente al movimiento desde la opción "Conciliar
                      manualmente" para completar el proceso.
                    </div>
                  </div>
                </div>
              )}
              {totals.reconciled > 0 && (
                <div className="rounded-md border bg-emerald-50 border-emerald-200 p-3 text-sm text-emerald-800">
                  <strong>{totals.reconciled}</strong> solicitud
                  {totals.reconciled === 1 ? '' : 'es'} programada
                  {totals.reconciled === 1 ? '' : 's'} para pago por un total de{' '}
                  <strong>
                    {formatCurrency(
                      rows
                        .filter((r) => r.status === 'reconciled')
                        .reduce((s, r) => s + r.monto, 0),
                    )}
                  </strong>
                  .
                </div>
              )}
              <SummaryStrip totals={totals} />
              <StatusFilter
                totals={totals}
                value={filterStatus}
                onChange={setFilterStatus}
              />
              <RowsTable rows={filteredRows} />
            </div>
          )}

          {step === 'history' && (
            <div className="flex-1 min-h-0 overflow-hidden">
              {history.length === 0 ? (
                <div className="text-sm text-muted-foreground text-center py-10">
                  No hay cargas previas para este movimiento.
                </div>
              ) : (
                <ScrollArea className="h-full">
                  <div className="space-y-2 pr-3">
                    {history.map((h) => (
                      <div key={h.id} className="rounded-md border p-3 bg-card">
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <div className="font-medium truncate">{h.fileName}</div>
                            <div className="text-xs text-muted-foreground">
                              {new Date(h.at).toLocaleString('es-CL')} · {h.user ?? 'usuario desconocido'}
                            </div>
                          </div>
                          <Badge
                            variant="outline"
                            className={
                              h.overallStatus === 'success'
                                ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                                : h.overallStatus === 'partial'
                                  ? 'border-amber-300 bg-amber-50 text-amber-800'
                                  : 'border-destructive/40 bg-destructive/5 text-destructive'
                            }
                          >
                            {h.overallStatus === 'success'
                              ? 'Éxito'
                              : h.overallStatus === 'partial'
                                ? 'Parcial'
                                : 'Con errores'}
                          </Badge>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
                          <Badge variant="secondary">Total {h.totals.total}</Badge>
                          <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Conciliadas {h.totals.reconciled}
                          </Badge>
                          <Badge variant="secondary">No encontradas {h.totals.not_found}</Badge>
                          <Badge variant="secondary">Duplicadas {h.totals.duplicated_in_csv + h.totals.duplicated_in_system}</Badge>
                          <Badge variant="secondary">Errores {h.totals.format_error + h.totals.apply_error}</Badge>
                        </div>
                        <div className="mt-2 flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() =>
                              downloadCsv(
                                `conciliacion_${h.documentoNumero}_${h.id}.csv`,
                                rowsToCsv(h.rows, (s) => STATUS_LABELS[s]),
                              )
                            }
                          >
                            <Download className="h-3.5 w-3.5 mr-1" /> Descargar resultado
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </div>
          )}
        </div>

        {processing && (
          <div className="shrink-0 space-y-1" aria-live="polite">
            <Progress value={progress} />
            <div className="text-xs text-muted-foreground text-center">
              {progressLabel || 'Aplicando conciliación…'}
            </div>
          </div>
        )}

        <DialogFooter className="shrink-0 gap-2 flex-wrap sm:justify-between">
          <div className="text-xs text-muted-foreground">
            {step === 'preview' && (
              <>
                {approvedRows.length} de {validRows.length} aprobada
                {approvedRows.length === 1 ? '' : 's'} · Suma {formatCurrency(totalToApply)} /{' '}
                Abono {formatCurrency(abono)} · Real a guardar{' '}
                <strong>{formatCurrency(totalRealAmount)}</strong>
                {hasStructuralErrors && ' · hay filas con errores estructurales'}
              </>
            )}
            {step === 'result' && (
              <>
                {totals.reconciled} de {totals.total} filas conciliadas correctamente
              </>
            )}
          </div>
          <div className="flex flex-wrap gap-2 justify-end">
            {step === 'preview' && (
              <>
                <Button variant="outline" onClick={() => setStep('upload')}>Cambiar archivo</Button>
                <Button disabled={!canProcess} onClick={() => setConfirmOpen(true)}>
                  <CheckCircle2 className="h-4 w-4 mr-1" />
                  Aplicar {approvedRows.length} y programar pago
                </Button>
              </>
            )}
            {step === 'result' && (
              <>
                <Button
                  variant="outline"
                  onClick={() =>
                    downloadCsv(
                      `conciliacion_${movement.documentoNumero}.csv`,
                      rowsToCsv(rows, (s) => STATUS_LABELS[s]),
                    )
                  }
                >
                  <Download className="h-4 w-4 mr-1" /> Descargar resultado
                </Button>
                {(totals.not_found > 0 || totals.apply_error > 0) && (
                  <Button variant="outline" onClick={retryErrorsOnly}>
                    <RotateCw className="h-4 w-4 mr-1" /> Reintentar errores
                  </Button>
                )}
                <Button onClick={() => handleClose(false)}>Cerrar</Button>
              </>
            )}
            {(step === 'upload' || step === 'history') && (
              <Button variant="outline" onClick={() => handleClose(false)}>Cerrar</Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar conciliación</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <p>
                  Se procesarán{' '}
                  <strong>
                    {approvedRows.length} solicitud{approvedRows.length === 1 ? '' : 'es'}
                  </strong>{' '}
                  contra el movimiento{' '}
                  <span className="font-mono">{movement.documentoNumero}</span>.
                </p>
                <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                  <li>
                    Cada solicitud pasará a estado <strong>Pago Programado</strong>.
                  </li>
                  <li>
                    Al <strong>monto del CSV</strong> se le descontará la{' '}
                    <strong>prima total TDV</strong> (prima mensual × cuotas
                    pendientes) y ese resultado se guardará como{' '}
                    <strong>monto real de devolución</strong> de la solicitud.
                  </li>
                  <li>
                    Se registrará una entrada en el historial de la solicitud.
                  </li>
                </ul>
                <div className="rounded-md bg-muted/60 p-2 text-xs space-y-1">
                  <div className="flex justify-between">
                    <span>Abono disponible</span>
                    <strong className="tabular-nums">{formatCurrency(abono)}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Suma abonos CSV</span>
                    <strong className="tabular-nums">{formatCurrency(totalToApply)}</strong>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>− Prima total TDV</span>
                    <span className="tabular-nums">−{formatCurrency(totalPrimaTDV)}</span>
                  </div>
                  <div className="flex justify-between border-t pt-1">
                    <span className="font-medium">Total a guardar como monto real</span>
                    <strong className="tabular-nums text-emerald-700">
                      {formatCurrency(totalRealAmount)}
                    </strong>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Esta acción no se puede deshacer automáticamente.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmOpen(false)
                runProcess()
              }}
            >
              Confirmar y programar pago
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  )
}

function SummaryStrip({ totals }: { totals: ReturnType<typeof computeTotals> }) {
  const chips: Array<{ label: string; value: number; cls: string }> = [
    { label: 'Total', value: totals.total, cls: 'bg-muted text-foreground' },
    { label: 'Conciliadas', value: totals.reconciled, cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    { label: 'Listas', value: totals.valid, cls: 'bg-sky-50 text-sky-700 border-sky-200' },
    { label: 'No encontradas', value: totals.not_found, cls: 'bg-muted' },
    { label: 'Duplicadas CSV', value: totals.duplicated_in_csv, cls: 'bg-amber-50 text-amber-800 border-amber-200' },
    { label: 'Duplicadas sistema', value: totals.duplicated_in_system, cls: 'bg-amber-50 text-amber-800 border-amber-200' },
    { label: 'Ya conciliadas', value: totals.already_reconciled_here, cls: 'bg-emerald-50/60 text-emerald-700 border-emerald-200' },
    { label: 'Otro movimiento', value: totals.linked_to_other_movement, cls: 'bg-orange-50 text-orange-800 border-orange-200' },
    { label: 'Sin asociar', value: totals.status_updated_no_link, cls: 'bg-amber-50 text-amber-900 border-amber-300' },
    { label: 'Errores', value: totals.format_error + totals.apply_error, cls: 'bg-destructive/10 text-destructive border-destructive/30' },
  ]
  return (
    <div className="flex flex-wrap gap-1.5">
      {chips.map((c) => (
        <div
          key={c.label}
          className={`rounded-md border px-2 py-1 text-xs flex items-center gap-1.5 ${c.cls}`}
        >
          <span className="font-medium">{c.value}</span>
          <span className="opacity-80">{c.label}</span>
        </div>
      ))}
    </div>
  )
}

function StatusFilter({
  totals,
  value,
  onChange,
}: {
  totals: ReturnType<typeof computeTotals>
  value: CsvRowStatus | 'all'
  onChange: (v: CsvRowStatus | 'all') => void
}) {
  type Opt = { v: CsvRowStatus | 'all'; label: string; count: number }
  const opts: Opt[] = ([
    { v: 'all', label: 'Todas', count: totals.total },
    { v: 'reconciled', label: STATUS_LABELS.reconciled, count: totals.reconciled },
    { v: 'valid', label: STATUS_LABELS.valid, count: totals.valid },
    { v: 'not_found', label: STATUS_LABELS.not_found, count: totals.not_found },
    { v: 'duplicated_in_csv', label: STATUS_LABELS.duplicated_in_csv, count: totals.duplicated_in_csv },
    { v: 'duplicated_in_system', label: STATUS_LABELS.duplicated_in_system, count: totals.duplicated_in_system },
    { v: 'already_reconciled_here', label: STATUS_LABELS.already_reconciled_here, count: totals.already_reconciled_here },
    { v: 'linked_to_other_movement', label: STATUS_LABELS.linked_to_other_movement, count: totals.linked_to_other_movement },
    { v: 'status_updated_no_link', label: STATUS_LABELS.status_updated_no_link, count: totals.status_updated_no_link },
    { v: 'format_error', label: STATUS_LABELS.format_error, count: totals.format_error },
    { v: 'apply_error', label: STATUS_LABELS.apply_error, count: totals.apply_error },
  ] as Opt[]).filter((o) => o.v === 'all' || o.count > 0)
  return (
    <div className="flex flex-wrap gap-1">
      {opts.map((o) => (
        <button
          key={o.v}
          type="button"
          onClick={() => onChange(o.v)}
          className={`text-xs rounded-full border px-2.5 py-1 transition-colors ${
            value === o.v
              ? 'bg-primary text-primary-foreground border-primary'
              : 'bg-background hover:bg-muted'
          }`}
        >
          {o.label} <span className="opacity-70">({o.count})</span>
        </button>
      ))}
    </div>
  )
}

interface RowsTableProps {
  rows: ProcessedRow[]
  selectable?: boolean
  allValidApproved?: boolean
  onToggleAll?: (next: boolean) => void
  onToggleRow?: (rowNumber: number, next: boolean) => void
}

function RowsTable({
  rows,
  selectable = false,
  allValidApproved = false,
  onToggleAll,
  onToggleRow,
}: RowsTableProps) {
  const cols = selectable ? 9 : 8
  return (
    <div className="flex-1 min-h-0 rounded-md border overflow-auto">
        <Table className="min-w-[1120px]">
          <TableHeader className="sticky top-0 bg-background z-10">
            <TableRow>
              {selectable && (
                <TableHead className="w-10">
                  <Checkbox
                    checked={allValidApproved}
                    onCheckedChange={(v) => onToggleAll?.(v === true)}
                    aria-label="Aprobar todas"
                  />
                </TableHead>
              )}
              <TableHead className="w-14">Fila</TableHead>
              <TableHead>Solicitud / Cliente CSV</TableHead>
              <TableHead>N° Operación</TableHead>
              <TableHead className="text-right">Estimado sistema</TableHead>
              <TableHead className="text-right">
                Abono CSV
              </TableHead>
              <TableHead className="text-right">
                Prima TDV
                <div className="text-[10px] font-normal text-muted-foreground">
                  prima × cuotas pend.
                </div>
              </TableHead>
              <TableHead className="text-right">
                Monto real
                <div className="text-[10px] font-normal text-muted-foreground">
                  se guardará en la solicitud
                </div>
              </TableHead>
              <TableHead>Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={cols} className="text-center text-sm text-muted-foreground py-6">
                  Sin filas para mostrar.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => {
                const est = r.matchedEstimated ?? 0
                const diff = est > 0 ? r.monto - est : 0
                const diffPct = est > 0 ? (diff / est) * 100 : 0
                const hasDiff = est > 0 && Math.abs(diff) > 0.5
                const prima = primaTotalTDV(r)
                const real = montoRealDevolucion(r)
                const primaKnown =
                  Boolean(r.matchedNewMonthlyPremium) &&
                  Boolean(r.matchedRemainingInstallments)
                return (
                  <Fragment key={r.rowNumber}>
                    <TableRow className={r.approved === false ? 'opacity-60' : undefined}>
                      {selectable && (
                        <TableCell>
                          {r.status === 'valid' ? (
                            <Checkbox
                              checked={r.approved !== false}
                              onCheckedChange={(v) => onToggleRow?.(r.rowNumber, v === true)}
                              aria-label={`Aprobar fila ${r.rowNumber}`}
                            />
                          ) : (
                            <span className="text-muted-foreground/50 text-xs">—</span>
                          )}
                        </TableCell>
                      )}
                      <TableCell className="text-xs tabular-nums">{r.rowNumber}</TableCell>
                      <TableCell className="text-sm max-w-[240px]">
                        {r.matchedPublicId ? (
                          <div className="flex flex-col">
                            <span className="font-mono text-xs text-primary">
                              {r.matchedPublicId}
                            </span>
                            <span className="truncate text-xs" title={r.matchedFullName}>
                              {r.matchedFullName || r.nombre_cliente || '—'}
                            </span>
                            {r.rut && (
                              <span className="text-[10px] font-mono text-muted-foreground">
                                {r.rut}
                              </span>
                            )}
                          </div>
                        ) : (
                          <div className="flex flex-col">
                            <span
                              className="truncate text-xs"
                              title={r.nombre_cliente}
                            >
                              {r.nombre_cliente || '—'}
                            </span>
                            {r.rut && (
                              <span className="text-[10px] font-mono text-muted-foreground">
                                {r.rut}
                              </span>
                            )}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-xs font-mono">{r.numero_operacion || '—'}</TableCell>
                      <TableCell className="text-right text-xs tabular-nums text-muted-foreground">
                        {est > 0 ? formatCurrency(est) : '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-col items-end">
                          <span className="text-sm font-medium tabular-nums">
                            {formatCurrency(r.monto)}
                          </span>
                          {hasDiff && (
                            <span
                              className={`text-[10px] tabular-nums ${
                                diff > 0 ? 'text-amber-700' : 'text-sky-700'
                              }`}
                              title="Diferencia respecto al monto estimado del sistema"
                            >
                              {diff > 0 ? '+' : ''}
                              {formatCurrency(diff)} ({diffPct > 0 ? '+' : ''}
                              {diffPct.toFixed(1)}%)
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {primaKnown ? (
                          <div className="flex flex-col items-end">
                            <span className="text-xs tabular-nums text-muted-foreground">
                              −{formatCurrency(prima)}
                            </span>
                            <span
                              className="text-[10px] text-muted-foreground tabular-nums"
                              title="Prima mensual TDV × cuotas pendientes"
                            >
                              {formatCurrency(r.matchedNewMonthlyPremium ?? 0)} ×{' '}
                              {r.matchedRemainingInstallments ?? 0}
                            </span>
                          </div>
                        ) : (
                          <span
                            className="text-[10px] text-amber-700"
                            title="No hay prima o cuotas pendientes en el snapshot; no se descuenta prima."
                          >
                            sin dato
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-col items-end">
                          <span className="text-sm font-semibold tabular-nums text-emerald-700">
                            {formatCurrency(real)}
                          </span>
                          {primaKnown && (
                            <span className="text-[10px] text-muted-foreground">
                              monto real de devolución
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <span
                          className={`inline-flex items-center whitespace-nowrap rounded-md border px-1.5 py-0.5 text-[11px] ${STATUS_STYLES[r.status]}`}
                        >
                          {STATUS_LABELS[r.status]}
                        </span>
                      </TableCell>
                    </TableRow>
                    <TableRow className={r.approved === false ? 'opacity-60 hover:bg-transparent' : 'hover:bg-transparent'}>
                      <TableCell colSpan={cols} className="bg-muted/20 px-4 py-3">
                        <div className="rounded-md border bg-background p-3">
                          <div className="mb-1 text-[10px] font-medium uppercase text-muted-foreground">
                            Detalle
                          </div>
                          <p className="text-xs leading-relaxed text-muted-foreground whitespace-normal break-words">
                            {r.detail || 'Sin detalle adicional.'}
                          </p>
                        </div>
                      </TableCell>
                    </TableRow>
                  </Fragment>
                )
              })
            )}
          </TableBody>
        </Table>
    </div>
  )
}