import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
import { Checkbox } from '@/components/ui/checkbox'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Info,
  Loader2,
  Upload,
} from 'lucide-react'
import { formatCurrency } from '@/lib/formatters'
import { toast } from '@/hooks/use-toast'

import { usePendingRefunds } from '../hooks/usePendingRefunds'
import { cartolaLinksService } from '../services/cartolaLinksService'
import { refundAdminApi } from '@/services/refundAdminApi'
import {
  downloadCsv,
  parseCsv,
  templateCsv,
  type ProcessedRow,
} from '../services/csvReconcileService'

export interface MovementCandidate {
  documentoNumero: string
  descripcion: string
  abono: number
  fecha: string
  remaining: number
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Todos los abonos con su saldo disponible ya calculado. */
  movements: MovementCandidate[]
  onApplied?: () => void
}

type Step = 'upload' | 'preview' | 'result'

type RowState =
  | 'valid' // aprobable
  | 'not_found' // no hay solicitud
  | 'no_movement' // no hay abono con ese monto
  | 'needs_movement' // varios abonos, requiere selección
  | 'negative_real' // cálculo dio ≤ 0
  | 'format_error'
  | 'duplicated_in_csv'
  | 'reconciled'
  | 'apply_error'
  | 'status_updated_no_link'

interface Row extends ProcessedRow {
  state: RowState
  message: string
  refundId?: string
  refundPublicId?: string
  refundName?: string
  newMonthlyPremium?: number
  remainingInstallments?: number
  primaTotal?: number
  realAmount?: number
  candidateDocs: string[]
  chosenDoc?: string
  approved: boolean
  errorDetail?: string
}

const STATE_LABELS: Record<RowState, string> = {
  valid: 'Lista para conciliar',
  not_found: 'Solicitud no encontrada',
  no_movement: 'No hay abono por ese monto',
  needs_movement: 'Elegir movimiento',
  negative_real: 'Prima total supera el abono',
  format_error: 'Error de formato',
  duplicated_in_csv: 'Duplicada en CSV',
  reconciled: 'Conciliada',
  apply_error: 'Error al aplicar',
  status_updated_no_link: 'Estado actualizado sin asociar',
}

const STATE_STYLES: Record<RowState, string> = {
  valid: 'bg-sky-50 text-sky-700 border-sky-200',
  not_found: 'bg-muted text-muted-foreground border-border',
  no_movement: 'bg-orange-50 text-orange-800 border-orange-200',
  needs_movement: 'bg-amber-50 text-amber-800 border-amber-200',
  negative_real: 'bg-destructive/10 text-destructive border-destructive/30',
  format_error: 'bg-destructive/10 text-destructive border-destructive/30',
  duplicated_in_csv: 'bg-amber-50 text-amber-800 border-amber-200',
  reconciled: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  apply_error: 'bg-destructive/10 text-destructive border-destructive/30',
  status_updated_no_link: 'bg-amber-50 text-amber-900 border-amber-300',
}

function normalizeOp(v: string): string {
  return String(v ?? '').trim().toUpperCase()
}

export function IndividualCsvReconcileDialog({
  open,
  onOpenChange,
  movements,
  onApplied,
}: Props) {
  const qc = useQueryClient()
  
  const pendingQuery = usePendingRefunds()
  const inputRef = useRef<HTMLInputElement | null>(null)

  const [step, setStep] = useState<Step>('upload')
  const [file, setFile] = useState<File | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [parseError, setParseError] = useState<string | null>(null)
  const [rows, setRows] = useState<Row[]>([])
  const [processing, setProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [progressLabel, setProgressLabel] = useState('')

  useEffect(() => {
    if (open) {
      setStep('upload')
      setFile(null)
      setParseError(null)
      setRows([])
      setProcessing(false)
      setProgress(0)
      setProgressLabel('')
    }
  }, [open])

  const handleClose = (next: boolean) => {
    if (!next && processing) return
    onOpenChange(next)
  }

  // Indexes
  const refundsByOp = useMemo(() => {
    const map = new Map<string, ReturnType<typeof pendingQuery.data.at>[]>()
    for (const r of pendingQuery.data ?? []) {
      const k = normalizeOp(r.nroCredito ?? '')
      if (!k) continue
      const list = (map.get(k) ?? []) as any[]
      list.push(r)
      map.set(k, list as any)
    }
    return map
  }, [pendingQuery.data])

  const movementsByAmount = useMemo(() => {
    const map = new Map<number, MovementCandidate[]>()
    for (const m of movements) {
      const key = Math.round(m.abono)
      const list = map.get(key) ?? []
      list.push(m)
      map.set(key, list)
    }
    return map
  }, [movements])

  const buildRows = useCallback(
    (processed: ProcessedRow[]): Row[] => {
      return processed.map((p) => {
        if (p.status === 'format_error' || p.status === 'duplicated_in_csv') {
          return {
            ...p,
            state: p.status as RowState,
            message: p.detail,
            candidateDocs: [],
            approved: false,
          }
        }
        const key = normalizeOp(p.numero_operacion)
        const matches = (refundsByOp.get(key) ?? []) as any[]
        if (matches.length === 0) {
          return {
            ...p,
            state: 'not_found',
            message:
              'No hay solicitud en estado Ingresada con ese número de operación.',
            candidateDocs: [],
            approved: false,
          }
        }
        if (matches.length > 1) {
          return {
            ...p,
            state: 'not_found',
            message: `Hay ${matches.length} solicitudes con ese número de operación. Concilia manualmente.`,
            candidateDocs: [],
            approved: false,
          }
        }
        const refund = matches[0]
        const prima = Number(refund.newMonthlyPremium ?? 0)
        const cuotas = Number(refund.confirmedRemainingInstallments ?? 0)
        const primaTotal = Math.max(0, Math.round(prima * cuotas))
        const realAmount = Math.round(p.monto - primaTotal)

        // Buscar abono por monto exacto.
        const candidates = movementsByAmount.get(Math.round(p.monto)) ?? []
        const eligibles = candidates.filter((c) => c.remaining + 0.5 >= p.monto)

        if (realAmount <= 0) {
          return {
            ...p,
            state: 'negative_real',
            message: `Prima total (${formatCurrency(primaTotal)}) supera o iguala el abono (${formatCurrency(p.monto)}). No se registra.`,
            refundId: refund.id,
            refundPublicId: refund.publicId,
            refundName: refund.fullName,
            newMonthlyPremium: prima,
            remainingInstallments: cuotas,
            primaTotal,
            realAmount,
            candidateDocs: eligibles.map((c) => c.documentoNumero),
            approved: false,
          }
        }

        if (eligibles.length === 0) {
          return {
            ...p,
            state: 'no_movement',
            message: `No hay abono con monto ${formatCurrency(p.monto)} y saldo suficiente en el rango cargado.`,
            refundId: refund.id,
            refundPublicId: refund.publicId,
            refundName: refund.fullName,
            newMonthlyPremium: prima,
            remainingInstallments: cuotas,
            primaTotal,
            realAmount,
            candidateDocs: [],
            approved: false,
          }
        }

        return {
          ...p,
          state: eligibles.length > 1 ? 'needs_movement' : 'valid',
          message:
            eligibles.length > 1
              ? `Hay ${eligibles.length} abonos por ${formatCurrency(p.monto)}. Selecciona uno.`
              : 'Coincide con un abono único. Lista para conciliar.',
          refundId: refund.id,
          refundPublicId: refund.publicId,
          refundName: refund.fullName,
          newMonthlyPremium: prima,
          remainingInstallments: cuotas,
          primaTotal,
          realAmount,
          candidateDocs: eligibles.map((c) => c.documentoNumero),
          chosenDoc: eligibles.length === 1 ? eligibles[0].documentoNumero : undefined,
          approved: eligibles.length === 1,
        }
      })
    },
    [refundsByOp, movementsByAmount],
  )

  const handleFile = useCallback(
    async (f: File | null) => {
      if (!f) return
      setFile(f)
      setParseError(null)
      const result = await parseCsv(f)
      if (result.fatalError || result.headerError) {
        setParseError(result.fatalError ?? result.headerError ?? 'Archivo inválido.')
        setRows([])
        return
      }
      // Esperar refunds si están cargando
      if (pendingQuery.isLoading || !pendingQuery.data) {
        // Se recomputa al llegar los datos vía effect abajo.
        setRows(result.rows.map((r) => ({ ...r, state: 'not_found', message: 'Cargando…', candidateDocs: [], approved: false })))
      } else {
        setRows(buildRows(result.rows))
      }
      setStep('preview')
    },
    [buildRows, pendingQuery.isLoading, pendingQuery.data],
  )

  // Si el archivo se cargó antes de que llegaran los refunds, recomputar.
  useEffect(() => {
    if (step !== 'preview') return
    if (pendingQuery.isLoading || !pendingQuery.data || rows.length === 0) return
    // Solo recomputar si todavía no hay ningún row con refundId (estado inicial vacío).
    const anyMatched = rows.some((r) => r.refundId || r.state === 'valid' || r.state === 'needs_movement')
    if (!anyMatched) {
      const stripped: ProcessedRow[] = rows.map((r) => ({
        rowNumber: r.rowNumber,
        nombre_cliente: r.nombre_cliente,
        rut: r.rut,
        numero_operacion: r.numero_operacion,
        poliza: r.poliza,
        monto: r.monto,
        montoRaw: r.montoRaw,
        status: (r.state === 'format_error' || r.state === 'duplicated_in_csv') ? r.state : 'valid',
        detail: '',
      }))
      setRows(buildRows(stripped))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, pendingQuery.isLoading, pendingQuery.data])

  // Fallback: enriquecer filas "not_found" consultando el backend por número de
  // operación / póliza / RUT para distinguir "no existe" vs "existe en otro estado".
  const enrichedRef = useRef<Set<string>>(new Set())
  useEffect(() => {
    if (step !== 'preview') return
    const STATUS_LABELS: Record<string, string> = {
      submitted: 'Ingresada',
      payment_scheduled: 'Pago programado',
      paid: 'Pagada',
      rejected: 'Rechazada',
      cancelled: 'Cancelada',
      draft: 'Borrador',
      documents_received: 'Documentos recibidos',
      pending_documents: 'Pendiente documentos',
    }
    const targets = rows.filter(
      (r) => r.state === 'not_found' && r.numero_operacion && !enrichedRef.current.has(String(r.rowNumber)),
    )
    if (targets.length === 0) return
    let cancelled = false
    ;(async () => {
      const updates = new Map<number, Partial<Row>>()
      await Promise.all(
        targets.map(async (r) => {
          enrichedRef.current.add(String(r.rowNumber))
          try {
            // Busca por número de operación (q hace full-text sobre snapshot).
            const res = await refundAdminApi.search({ q: r.numero_operacion, limit: 5 })
            const items = (res.items ?? []) as any[]
            // Filtrar los que realmente tienen ese nroCredito.
            const matches = items.filter(
              (it) => normalizeOp(it?.calculationSnapshot?.nroCredito ?? '') === normalizeOp(r.numero_operacion),
            )
            if (matches.length === 0) {
              updates.set(r.rowNumber, {
                message: `No existe ninguna solicitud con nº de operación ${r.numero_operacion}. Verifica el CSV.`,
              })
              return
            }
            const first = matches[0]
            const st = String(first.status ?? '').toLowerCase()
            const label = STATUS_LABELS[st] ?? st ?? 'desconocido'
            const publicId = first.publicId ?? first.id
            const name = first.fullName ?? r.nombre_cliente
            updates.set(r.rowNumber, {
              refundPublicId: publicId,
              refundName: name,
              message:
                matches.length > 1
                  ? `Hay ${matches.length} solicitudes con ese nº de operación. Ninguna está en Ingresada — resuélvelas manualmente.`
                  : `La solicitud ${publicId} existe pero está en "${label}", no en Ingresada. Solo se pueden conciliar solicitudes Ingresadas.`,
            })
          } catch (err: any) {
            updates.set(r.rowNumber, {
              message: `No hay solicitud Ingresada con ese nº de operación (no se pudo verificar en backend: ${err?.message ?? 'error'}).`,
            })
          }
        }),
      )
      if (cancelled || updates.size === 0) return
      setRows((prev) => prev.map((r) => (updates.has(r.rowNumber) ? { ...r, ...updates.get(r.rowNumber)! } : r)))
    })()
    return () => {
      cancelled = true
    }
  }, [step, rows])

  const setChosenDoc = (rowNumber: number, doc: string) => {
    setRows((prev) =>
      prev.map((r) =>
        r.rowNumber === rowNumber
          ? { ...r, chosenDoc: doc, state: 'valid', approved: true, message: 'Movimiento seleccionado.' }
          : r,
      ),
    )
  }
  const toggleApproved = (rowNumber: number, next: boolean) => {
    setRows((prev) =>
      prev.map((r) => (r.rowNumber === rowNumber ? { ...r, approved: next } : r)),
    )
  }

  const approvableRows = rows.filter(
    (r) => (r.state === 'valid' || r.state === 'needs_movement') && !!r.chosenDoc && !!r.refundId,
  )
  const approvedRows = approvableRows.filter((r) => r.approved)

  // Validar que la suma por movimiento no supere el saldo
  const overByDoc = useMemo(() => {
    const totals = new Map<string, number>()
    for (const r of approvedRows) {
      totals.set(r.chosenDoc!, (totals.get(r.chosenDoc!) ?? 0) + r.monto)
    }
    const over: string[] = []
    for (const [doc, sum] of totals.entries()) {
      const mov = movements.find((m) => m.documentoNumero === doc)
      if (mov && sum > mov.remaining + 0.5) over.push(doc)
    }
    return over
  }, [approvedRows, movements])

  const canProcess = !processing && approvedRows.length > 0 && overByDoc.length === 0

  const runProcess = async () => {
    setProcessing(true)
    setProgress(2)
    setProgressLabel('Preparando…')
    const targets = approvedRows.slice()

    // Agrupar por movimiento para asociar
    const byDoc = new Map<string, Row[]>()
    for (const r of targets) {
      const list = byDoc.get(r.chosenDoc!) ?? []
      list.push(r)
      byDoc.set(r.chosenDoc!, list)
    }

    const linkErrorsByDoc = new Map<string, string>()
    const statusErrorByRow = new Map<number, string>()
    let processed = 0
    for (const [doc, list] of byDoc.entries()) {
      processed += 1
      setProgressLabel(`Asociando ${processed}/${byDoc.size} movimiento${byDoc.size === 1 ? '' : 's'}…`)
      setProgress(Math.round((processed / byDoc.size) * 90))
      try {
        await cartolaLinksService.applyMatches(
          doc,
          list.map((r) => ({
            publicId: r.refundPublicId!,
            amountApplied: Math.round(r.monto),
            realAmount: Math.round(r.realAmount!),
          })),
        )
        // Transición de estado a Pago Programado por solicitud
        for (const r of list) {
          try {
            await refundAdminApi.updateStatus(r.refundPublicId!, {
              status: 'payment_scheduled' as any,
              realAmount: Math.round(r.realAmount!),
              force: true,
              note: `Conciliación CSV individual movimiento ${doc}`,
            })
          } catch (err: any) {
            statusErrorByRow.set(r.rowNumber, err?.message ?? 'No se pudo cambiar el estado')
          }
        }
      } catch (err: any) {
        linkErrorsByDoc.set(doc, err?.message ?? 'No se pudo asociar al movimiento.')
      }
    }

    const targetRowNumbers = new Set(targets.map((r) => r.rowNumber))
    const nextRows: Row[] = rows.map((r) => {
      if (!targetRowNumbers.has(r.rowNumber)) return r
      const linkErr = linkErrorsByDoc.get(r.chosenDoc!)
      if (linkErr) {
        return { ...r, state: 'apply_error', message: linkErr }
      }
      const statusErr = statusErrorByRow.get(r.rowNumber)
      if (statusErr) {
        return { ...r, state: 'apply_error', message: `Abono asociado pero el estado no cambió: ${statusErr}` }
      }
      return {
        ...r,
        state: 'reconciled',
        message: `Solicitud pasada a Pago Programado con devolución ${formatCurrency(r.realAmount!)} y asociada al abono ${r.chosenDoc}.`,
      }
    })

    setRows(nextRows)
    setProgress(100)
    setProgressLabel('Listo')

    qc.invalidateQueries({ queryKey: ['cartola-reconciliation'] })
    qc.invalidateQueries({ queryKey: ['conciliacion', 'pending-refunds'] })
    qc.invalidateQueries({ queryKey: ['refund-admin-search'] })
    qc.invalidateQueries({ queryKey: ['refund'] })
    onApplied?.()

    const okCount = nextRows.filter((r) => r.state === 'reconciled').length
    const errCount = nextRows.filter((r) => r.state === 'apply_error').length
    if (okCount > 0 && errCount === 0) {
      toast({
        title: 'Conciliación aplicada',
        description: `${okCount} solicitud${okCount === 1 ? '' : 'es'} programada${okCount === 1 ? '' : 's'} para pago.`,
      })
    } else if (okCount > 0) {
      toast({
        title: 'Conciliación parcial',
        description: `${okCount} correcta${okCount === 1 ? '' : 's'} · ${errCount} con error.`,
      })
    } else {
      toast({
        title: 'No se pudo conciliar',
        description: 'Ninguna solicitud pudo procesarse.',
        variant: 'destructive',
      })
    }
    setStep('result')
    setProcessing(false)
  }


  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const f = e.dataTransfer?.files?.[0]
    if (f) handleFile(f)
  }

  const totals = useMemo(() => {
    const t = {
      total: rows.length,
      valid: 0,
      needs_movement: 0,
      not_found: 0,
      no_movement: 0,
      negative_real: 0,
      duplicated_in_csv: 0,
      format_error: 0,
      reconciled: 0,
      apply_error: 0,
      status_updated_no_link: 0,
    } as Record<RowState, number> & { total: number }
    for (const r of rows) t[r.state] = (t[r.state] ?? 0) + 1
    return t
  }, [rows])

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-[min(98vw,1280px)] h-[92vh] overflow-hidden !flex flex-col gap-4">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            Conciliación CSV para Abonos Individuales
          </DialogTitle>
          <DialogDescription>
            Sube un CSV donde el <strong>monto es el abono bancario</strong>. Buscaremos el abono coincidente y calcularemos la devolución real como <span className="font-mono">abono − (prima nueva × cuotas restantes)</span>.
          </DialogDescription>
        </DialogHeader>

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

              <div className="rounded-md border bg-card p-3 text-sm flex items-center justify-between gap-3">
                <div>
                  <div className="font-medium">Plantilla CSV</div>
                  <div className="text-xs text-muted-foreground">
                    Columnas: <code>nombre_cliente, rut, numero_operacion, poliza, monto</code> — <em>monto = abono bancario</em>.
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    downloadCsv('plantilla_conciliacion_individual.csv', templateCsv())
                  }
                >
                  <Download className="h-3.5 w-3.5 mr-1.5" />
                  Descargar
                </Button>
              </div>

              <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground flex items-start gap-2">
                <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <div>
                  El <strong>monto real de devolución</strong> que se guarda en cada solicitud es <span className="font-mono">abono − (prima nueva × cuotas restantes)</span>. Debes aprobar cada fila antes de aplicar; si el cálculo resulta ≤ 0 la fila se marca como error y no se procesa.
                </div>
              </div>
            </div>
          )}

          {step === 'preview' && (
            <div className="flex flex-col min-h-0 flex-1 gap-3">
              <div className="grid grid-cols-2 md:grid-cols-6 gap-2 text-xs">
                {[
                  ['Total filas', totals.total, 'bg-muted/40'],
                  ['Aprobables', approvableRows.length, 'bg-sky-50 text-sky-800'],
                  ['Elegir mov.', totals.needs_movement, 'bg-amber-50 text-amber-800'],
                  ['Sin solicitud', totals.not_found, 'bg-muted text-muted-foreground'],
                  ['Sin abono', totals.no_movement, 'bg-orange-50 text-orange-800'],
                  ['Errores', totals.format_error + totals.duplicated_in_csv + totals.negative_real, 'bg-destructive/10 text-destructive'],
                ].map(([label, value, cls]) => (
                  <div key={label as string} className={`rounded-md border px-2 py-1.5 ${cls as string}`}>
                    <div className="opacity-70">{label as string}</div>
                    <div className="font-semibold text-sm">{value as number}</div>
                  </div>
                ))}
              </div>

              {overByDoc.length > 0 && (
                <div className="rounded-md border border-destructive/40 bg-destructive/5 p-2 text-xs text-destructive flex items-start gap-2">
                  <AlertTriangle className="h-3.5 w-3.5 mt-0.5" />
                  La suma de montos aprobados supera el saldo del/los movimientos: {overByDoc.join(', ')}.
                </div>
              )}

              <div className="flex-1 min-h-0 rounded-md border overflow-hidden">
                <ScrollArea className="h-full">
                  <Table>
                    <TableHeader className="sticky top-0 bg-background z-10">
                      <TableRow>
                        <TableHead className="w-10"></TableHead>
                        <TableHead>Solicitud / Cliente</TableHead>
                        <TableHead className="text-right">Abono (CSV)</TableHead>
                        <TableHead className="text-right">Prima × cuotas</TableHead>
                        <TableHead className="text-right">Devolución real</TableHead>
                        <TableHead>Abono bancario</TableHead>
                        <TableHead>Estado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map((r) => {
                        const isApprovable =
                          (r.state === 'valid' || r.state === 'needs_movement') && !!r.chosenDoc
                        return (
                          <TableRow key={r.rowNumber} className="align-top">
                            <TableCell className="pt-3">
                              <Checkbox
                                checked={r.approved && isApprovable}
                                disabled={!isApprovable}
                                onCheckedChange={(v) => toggleApproved(r.rowNumber, !!v)}
                                aria-label="Aprobar"
                              />
                            </TableCell>
                            <TableCell className="text-sm">
                              <div className="font-medium">{r.refundName ?? r.nombre_cliente}</div>
                              <div className="text-xs text-muted-foreground font-mono">
                                {r.refundPublicId ?? '—'} · Op. {r.numero_operacion}
                              </div>
                              <div className="text-xs text-muted-foreground">{r.rut}</div>
                            </TableCell>
                            <TableCell className="text-right tabular-nums text-sm">
                              {formatCurrency(r.monto)}
                            </TableCell>
                            <TableCell className="text-right tabular-nums text-sm">
                              {r.newMonthlyPremium != null ? (
                                <div>
                                  <div>{formatCurrency(r.primaTotal ?? 0)}</div>
                                  <div className="text-[11px] text-muted-foreground">
                                    {formatCurrency(r.newMonthlyPremium)} × {r.remainingInstallments ?? 0}
                                  </div>
                                </div>
                              ) : (
                                '—'
                              )}
                            </TableCell>
                            <TableCell className="text-right tabular-nums text-sm">
                              {r.realAmount != null ? (
                                <span
                                  className={
                                    r.realAmount <= 0
                                      ? 'text-destructive font-semibold'
                                      : 'font-semibold text-emerald-700'
                                  }
                                >
                                  {formatCurrency(r.realAmount)}
                                </span>
                              ) : (
                                '—'
                              )}
                            </TableCell>
                            <TableCell className="text-sm min-w-[180px]">
                              {r.candidateDocs.length === 0 ? (
                                <span className="text-xs text-muted-foreground">—</span>
                              ) : r.candidateDocs.length === 1 ? (
                                <span className="text-xs font-mono">{r.candidateDocs[0]}</span>
                              ) : (
                                <Select
                                  value={r.chosenDoc ?? ''}
                                  onValueChange={(v) => setChosenDoc(r.rowNumber, v)}
                                >
                                  <SelectTrigger className="h-8 text-xs">
                                    <SelectValue placeholder="Elegir abono" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {r.candidateDocs.map((d) => {
                                      const mov = movements.find((m) => m.documentoNumero === d)
                                      return (
                                        <SelectItem key={d} value={d}>
                                          {d} · {mov ? mov.fecha : ''} · saldo{' '}
                                          {mov ? formatCurrency(mov.remaining) : ''}
                                        </SelectItem>
                                      )
                                    })}
                                  </SelectContent>
                                </Select>
                              )}
                            </TableCell>
                            <TableCell className="text-sm">
                              <Badge variant="outline" className={`text-[10px] ${STATE_STYLES[r.state]}`}>
                                {STATE_LABELS[r.state]}
                              </Badge>
                              <div className="text-[11px] text-muted-foreground mt-1 whitespace-normal break-words max-w-[240px]">
                                {r.message}
                              </div>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </div>

              {processing && (
                <div className="space-y-1">
                  <Progress value={progress} />
                  <div className="text-xs text-muted-foreground">{progressLabel}</div>
                </div>
              )}
            </div>
          )}

          {step === 'result' && (
            <div className="flex flex-col min-h-0 flex-1 gap-3">
              {rows.some((r) => r.state === 'status_updated_no_link') && (
                <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                  <div>
                    Algunas solicitudes quedaron en Pago Programado con la devolución guardada,
                    pero no se pudieron asociar al abono. Asócialas manualmente desde el diálogo
                    de conciliación del movimiento.
                  </div>
                </div>
              )}
              <div className="flex-1 min-h-0 rounded-md border overflow-hidden">
                <ScrollArea className="h-full">
                  <Table>
                    <TableHeader className="sticky top-0 bg-background z-10">
                      <TableRow>
                        <TableHead>Solicitud</TableHead>
                        <TableHead className="text-right">Devolución</TableHead>
                        <TableHead>Abono</TableHead>
                        <TableHead>Resultado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map((r) => (
                        <TableRow key={r.rowNumber} className="align-top">
                          <TableCell className="text-sm">
                            <div className="font-medium">{r.refundName ?? r.nombre_cliente}</div>
                            <div className="text-xs text-muted-foreground font-mono">
                              {r.refundPublicId ?? '—'}
                            </div>
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-sm">
                            {r.realAmount != null ? formatCurrency(r.realAmount) : '—'}
                          </TableCell>
                          <TableCell className="text-xs font-mono">{r.chosenDoc ?? '—'}</TableCell>
                          <TableCell className="text-sm">
                            <Badge variant="outline" className={`text-[10px] ${STATE_STYLES[r.state]}`}>
                              {STATE_LABELS[r.state]}
                            </Badge>
                            <div className="text-[11px] text-muted-foreground mt-1 whitespace-normal break-words max-w-[420px]">
                              {r.message}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="shrink-0">
          {step === 'upload' && (
            <Button variant="outline" onClick={() => handleClose(false)}>
              Cancelar
            </Button>
          )}
          {step === 'preview' && (
            <div className="flex items-center justify-between w-full gap-2">
              <div className="text-xs text-muted-foreground">
                {approvedRows.length} de {approvableRows.length} aprobadas
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep('upload')} disabled={processing}>
                  Volver
                </Button>
                <Button onClick={runProcess} disabled={!canProcess}>
                  {processing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Procesando…
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4 mr-2" /> Aplicar {approvedRows.length}
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
          {step === 'result' && (
            <Button onClick={() => handleClose(false)}>Cerrar</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}