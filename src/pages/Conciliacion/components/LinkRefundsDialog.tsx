import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Search, X, Plus, Loader2, Wand2, CheckCircle2, AlertCircle, Lock } from 'lucide-react'
import { formatCurrency } from '@/lib/formatters'
import { cartolaLinksService, type CartolaLink } from '../services/cartolaLinksService'
import { usePendingRefunds } from '../hooks/usePendingRefunds'
import type { PendingRefund } from '../types'
import { refundAdminApi } from '@/services/refundAdminApi'
import { toast } from '@/hooks/use-toast'

interface DraftMatch {
  refund: PendingRefund
  amount: number
}

/**
 * Fórmula de devolución real (idéntica a la conciliación CSV individual):
 *   realAmount = amountApplied − (newMonthlyPremium × confirmedRemainingInstallments)
 */
function computeRealAmount(refund: PendingRefund, amountApplied: number) {
  const prima = Number(refund.newMonthlyPremium ?? 0)
  const cuotas = Number(refund.confirmedRemainingInstallments ?? 0)
  const primaTotal = Math.max(0, Math.round(prima * cuotas))
  const real = Math.round((amountApplied || 0) - primaTotal)
  return { prima, cuotas, primaTotal, realAmount: real }
}

export interface CartolaMovementRef {
  documentoNumero: string
  descripcion: string
  abono: number
  fecha: string
}

interface Props {
  movement: CartolaMovementRef | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onApplied?: () => void
}

function toNumberSafe(v: unknown): number {
  const n = Number(String(v ?? '').replace(/[^0-9.-]/g, ''))
  return Number.isFinite(n) ? n : 0
}

function resolveCreditNumber(refund: any): string {
  const candidates = [
    refund?.nroCredito,
    refund?.numeroCredito,
    refund?.creditNumber,
    refund?.loanNumber,
    refund?.calculationSnapshot?.nroCredito,
    refund?.calculationSnapshot?.nroOperacion,
    refund?.calculationSnapshot?.numeroCredito,
    refund?.calculationSnapshot?.creditNumber,
    refund?.confirmedCreditData?.nroCredito,
    refund?.confirmedCreditData?.creditNumber,
  ]

  return String(candidates.find((value) => String(value ?? '').trim()) ?? '').trim()
}

export function LinkRefundsDialog({ movement, open, onOpenChange, onApplied }: Props) {
  const qc = useQueryClient()
  const pendingQuery = usePendingRefunds()
  const pendingRefunds = pendingQuery.data ?? []

  const [drafts, setDrafts] = useState<DraftMatch[]>([])
  const [search, setSearch] = useState('')
  const [creditoSearch, setCreditoSearch] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [reviewOpen, setReviewOpen] = useState(false)

  // Links ya asociados al movimiento (backend).
  const detailQuery = useQuery({
    queryKey: ['cartola-reconciliation', 'detail', movement?.documentoNumero ?? ''],
    queryFn: () => cartolaLinksService.getByMovement(movement!.documentoNumero),
    enabled: open && !!movement?.documentoNumero,
    staleTime: 15_000,
  })
  const existingLinks: CartolaLink[] = detailQuery.data?.links ?? []
  // Todos los links del backend ya representan conciliaciones aplicadas
  // (Pago Programado): el mismo endpoint `applyMatches` que usa la CSV
  // individual persiste el link y transiciona el estado en la misma llamada.
  const confirmedLinks = existingLinks

  // Reset del formulario al abrir el diálogo con otro movimiento.
  useEffect(() => {
    if (open) {
      setDrafts([])
      setSearch('')
      setCreditoSearch('')
      setConfirming(false)
      setReviewOpen(false)
    }
  }, [open, movement?.documentoNumero])

  // Mapa publicId → refund pendiente, para enriquecer los links existentes.
  const refundsByPublicId = useMemo(() => {
    const map = new Map<string, PendingRefund>()
    for (const r of pendingRefunds) map.set(r.publicId, r)
    return map
  }, [pendingRefunds])

  // Ids de solicitudes confirmadas que ya no están en el listado de
  // pendientes (porque transicionaron a Pago Programado). Debemos ir a
  // buscarlas al backend para poder mostrar nombre, RUT y realAmount.
  const missingConfirmedIds = useMemo(() => {
    return existingLinks
      .map((l) => l.refundId)
      .filter((id) => id && !refundsByPublicId.has(id))
  }, [existingLinks, refundsByPublicId])

  const confirmedRefundsQuery = useQuery({
    queryKey: ['cartola-reconciliation', 'confirmed-refunds', missingConfirmedIds],
    enabled: open && missingConfirmedIds.length > 0,
    staleTime: 30_000,
    queryFn: async () => {
      const results = await Promise.all(
        missingConfirmedIds.map(async (id) => {
          try {
            const detail = await refundAdminApi.getById(id)
            return detail ? [id, detail] as const : null
          } catch {
            return null
          }
        }),
      )
      const map = new Map<string, any>()
      for (const r of results) if (r) map.set(r[0], r[1])
      return map
    },
  })
  const confirmedRefundsMap = confirmedRefundsQuery.data ?? new Map<string, any>()

  const alreadyReconciled = useMemo(
    () => existingLinks.reduce((s, l) => s + l.amountApplied, 0),
    [existingLinks],
  )
  const totalApplied = useMemo(
    () => drafts.reduce((s, d) => s + (Number.isFinite(d.amount) ? d.amount : 0), 0),
    [drafts],
  )
  const abono = movement?.abono ?? 0
  const availableBefore = Math.max(0, abono - alreadyReconciled)
  const newAvailable = Math.max(0, availableBefore - totalApplied)
  const overApplied = totalApplied > availableBefore + 0.5
  const isFullyAllocated = availableBefore > 0 && newAvailable <= 0.5 && !overApplied

  const draftIds = new Set(drafts.map((d) => d.refund.id))
  const linkedPublicIds = new Set(existingLinks.map((l) => l.refundId))

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const cred = creditoSearch.trim().toLowerCase()
    const list = pendingRefunds
      .filter(
        (r) =>
          !r.isFullyReconciled && !draftIds.has(r.id) && !linkedPublicIds.has(r.publicId),
      )
      .filter((r) => {
        if (cred) {
          if (!String(r.nroCredito ?? '').toLowerCase().includes(cred)) return false
        }
        if (!q) return true
        return (
          r.fullName.toLowerCase().includes(q) ||
          r.rut.toLowerCase().includes(q) ||
          r.publicId.toLowerCase().includes(q) ||
          String(r.nroCredito ?? '').toLowerCase().includes(q)
        )
      })
    return list.slice(0, 50)
  }, [pendingRefunds, search, creditoSearch, drafts, existingLinks])

  const handleClose = (next: boolean) => {
    if (!next) {
      setDrafts([])
      setSearch('')
      setConfirming(false)
    }
    onOpenChange(next)
  }

  const addRefund = (r: PendingRefund) => {
    if (availableBefore - totalApplied <= 0.5) {
      toast({
        title: 'Saldo del movimiento completado',
        description: 'Ya asignaste el monto total disponible del abono.',
        variant: 'destructive',
      })
      return
    }
    const suggest = Math.min(r.remainingAmount, Math.max(0, availableBefore - totalApplied))
    setDrafts((prev) => [...prev, { refund: r, amount: Math.round(suggest) }])
  }

  const updateAmount = (refundId: string, raw: string) => {
    const n = Number(raw.replace(/[^0-9.-]/g, ''))
    setDrafts((prev) =>
      prev.map((d) =>
        d.refund.id === refundId ? { ...d, amount: Number.isFinite(n) ? n : 0 } : d,
      ),
    )
  }

  const removeDraft = (refundId: string) => {
    setDrafts((prev) => prev.filter((d) => d.refund.id !== refundId))
  }

  const fillRemainingForLast = () => {
    if (drafts.length === 0) return
    const others = drafts.slice(0, -1).reduce((s, d) => s + (d.amount || 0), 0)
    const last = drafts[drafts.length - 1]
    const target = Math.max(0, Math.round(availableBefore - others))
    setDrafts((prev) =>
      prev.map((d, i) =>
        i === prev.length - 1
          ? { ...d, amount: Math.min(target, last.refund.remainingAmount) }
          : d,
      ),
    )
  }

  const openReview = () => {
    if (!movement) return
    if (drafts.length === 0) {
      toast({
        title: 'Sin solicitudes',
        description: 'Agrega al menos una solicitud para conciliar el movimiento.',
      })
      return
    }
    if (overApplied) {
      toast({
        title: 'Monto excedido',
        description: 'El total supera el monto disponible del abono.',
        variant: 'destructive',
      })
      return
    }
    if (drafts.some((d) => d.amount <= 0)) {
      toast({
        title: 'Montos inválidos',
        description: 'Cada solicitud debe tener un monto mayor a 0.',
        variant: 'destructive',
      })
      return
    }
    const invalidReal = drafts.find(
      (d) => computeRealAmount(d.refund, d.amount).realAmount <= 0,
    )
    if (invalidReal) {
      toast({
        title: 'Devolución no válida',
        description: `La prima total de ${invalidReal.refund.fullName} supera o iguala el abono asignado. La devolución real quedaría en cero o negativa.`,
        variant: 'destructive',
      })
      return
    }
    setReviewOpen(true)
  }

  const handleConfirm = async () => {
    if (!movement) return

    try {
      setConfirming(true)
      await cartolaLinksService.applyMatches(
        movement.documentoNumero,
        drafts.map((d) => ({
          publicId: d.refund.publicId,
          amountApplied: d.amount,
          realAmount: computeRealAmount(d.refund, d.amount).realAmount,
        })),
      )

      // Transición de estado a Pago Programado (mismo patrón que la
      // conciliación CSV individual). El backend de reconciliación crea el
      // link pero NO cambia el estado, por lo que lo hacemos explícito acá.
      const statusErrors: string[] = []
      for (const d of drafts) {
        try {
          await refundAdminApi.updateStatus(d.refund.publicId, {
            status: 'payment_scheduled' as any,
            realAmount: computeRealAmount(d.refund, d.amount).realAmount,
            force: true,
            note: `Conciliación bancaria movimiento ${movement.documentoNumero}`,
          })
        } catch (err: any) {
          statusErrors.push(`${d.refund.publicId}: ${err?.message ?? 'error'}`)
        }
      }

      qc.invalidateQueries({ queryKey: ['cartola-reconciliation'] })
      qc.invalidateQueries({ queryKey: ['conciliacion', 'pending-refunds'] })
      qc.invalidateQueries({ queryKey: ['refund-admin-search'] })
      qc.invalidateQueries({ queryKey: ['refund'] })
      await detailQuery.refetch()
      const count = drafts.length
      setDrafts([])
      if (statusErrors.length === 0) {
        toast({
          title: 'Conciliación confirmada',
          description: `${count} solicitud${count === 1 ? '' : 'es'} pasada${count === 1 ? '' : 's'} a Pago Programado.`,
        })
      } else {
        toast({
          title: 'Conciliación parcial',
          description: `Se asociaron los abonos, pero ${statusErrors.length} solicitud(es) no cambiaron de estado: ${statusErrors.join(' · ')}`,
          variant: 'destructive',
        })
      }
      onApplied?.()
      setReviewOpen(false)
    } catch (err: any) {
      toast({
        title: 'No se pudo confirmar',
        description: err?.message ?? 'Error de red',
        variant: 'destructive',
      })
    } finally {
      setConfirming(false)
    }
  }

  if (!movement) return null

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-5xl max-h-[92vh] overflow-hidden flex flex-col gap-4">
        <DialogHeader>
          <DialogTitle>Conciliar movimiento bancario</DialogTitle>
          <DialogDescription>
            Asocia este abono a una o varias solicitudes en estado{' '}
            <strong>Ingresada</strong>. Puedes dividir el monto entre varias.
          </DialogDescription>
        </DialogHeader>

        {/* Resumen del movimiento */}
        <div className="shrink-0 rounded-lg border bg-muted/40 p-4 grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
          <div className="md:col-span-2 min-w-0">
            <div className="text-muted-foreground text-xs">Descripción</div>
            <div className="font-medium truncate" title={movement.descripcion}>
              {movement.descripcion || '—'}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              Doc. <span className="font-mono">{movement.documentoNumero}</span> · {movement.fecha}
            </div>
          </div>
          <div>
            <div className="text-muted-foreground text-xs">Abono</div>
            <div className="font-semibold text-emerald-700">{formatCurrency(abono)}</div>
          </div>
          <div>
            <div className="text-muted-foreground text-xs">Ya conciliado</div>
            <div className="font-medium">{formatCurrency(alreadyReconciled)}</div>
          </div>
          <div>
            <div className="text-muted-foreground text-xs">Disponible después</div>
            <div
              className={`font-semibold ${
                overApplied
                  ? 'text-destructive'
                  : newAvailable === 0
                    ? 'text-emerald-700'
                    : 'text-foreground'
              }`}
            >
              {formatCurrency(newAvailable)}
            </div>
          </div>
        </div>

        {/* Solicitudes ya confirmadas (bloqueadas) */}
        {confirmedLinks.length > 0 && (
          <div className="shrink-0 rounded-lg border bg-emerald-50/40 border-emerald-200">
            <div className="flex items-center gap-2 px-3 py-2 border-b border-emerald-200 text-xs uppercase tracking-wide text-emerald-800">
              <Lock className="h-3.5 w-3.5" />
              Confirmadas — Pago Programado ({confirmedLinks.length})
            </div>
            <div className="p-2 flex flex-col gap-2">
              {confirmedLinks.map((l) => {
                const pending = refundsByPublicId.get(l.refundId)
                const fetched = confirmedRefundsMap.get(l.refundId)
                const fullName: string | undefined =
                  pending?.fullName ?? fetched?.fullName
                const rut: string | undefined = pending?.rut ?? fetched?.rut
                const nroCredito =
                  resolveCreditNumber(pending) || resolveCreditNumber(fetched)
                const publicId: string = fetched?.publicId ?? l.refundId
                // realAmount vive como campo top-level de la solicitud.
                const realAmountRaw =
                  pending?.realAmount ??
                  fetched?.realAmount ??
                  l.realAmount ??
                  l.amountApplied
                const realAmount = Number(realAmountRaw) || 0
                const loading =
                  !pending && !fetched && confirmedRefundsQuery.isFetching
                return (
                  <div
                    key={l.id}
                    className="flex items-center gap-2 rounded-md border border-emerald-200 bg-white px-2 py-1.5 text-xs w-full"
                    title="Ya confirmada: no se puede desasociar"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                    <div className="flex flex-col leading-tight min-w-0 flex-1">
                      <span className="font-medium truncate">
                        {fullName ?? (loading ? 'Cargando…' : 'Solicitud')}
                        {rut ? (
                          <span className="text-muted-foreground font-normal">
                            {' '}· {rut}
                          </span>
                        ) : null}
                      </span>
                      <span className="text-muted-foreground font-mono truncate text-[11px]">
                        {nroCredito ? `Crédito ${nroCredito} · ` : ''}{publicId}
                      </span>
                    </div>
                    <div className="ml-auto pl-2 text-right shrink-0">
                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        Devolución real
                      </div>
                      <div className="font-semibold text-emerald-700">
                        {formatCurrency(realAmount)}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Body en 2 columnas */}
        <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-12 gap-4">
          <div className="md:col-span-7 flex flex-col min-h-0 rounded-lg border bg-card overflow-hidden">
            <div className="shrink-0 px-3 py-2 border-b bg-muted/30 flex items-center justify-between gap-2">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                Agregar solicitud
              </Label>
              {isFullyAllocated && (
                <Badge
                  variant="outline"
                  className="border-emerald-300 bg-emerald-50 text-emerald-700 text-[10px]"
                >
                  Saldo completo
                </Badge>
              )}
            </div>
            <div className="shrink-0 p-3 border-b">
              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Nombre, RUT o ID público..."
                    className="pl-9"
                  />
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={creditoSearch}
                    onChange={(e) => setCreditoSearch(e.target.value)}
                    placeholder="N° de crédito…"
                    className="pl-9"
                    inputMode="numeric"
                  />
                </div>
              </div>
            </div>
            <ScrollArea className="flex-1 min-h-0">
              {pendingQuery.isLoading ? (
                <div className="p-6 text-sm text-muted-foreground flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Cargando solicitudes en estado Ingresada…
                </div>
              ) : filtered.length === 0 ? (
                <div className="p-4 text-sm text-muted-foreground text-center">
                  No hay solicitudes pendientes que coincidan.
                </div>
              ) : (
                <div className="divide-y">
                  {filtered.map((r) => {
                    const suggested = Math.abs(r.remainingAmount - abono) < 0.5
                    const credMatch =
                      !!creditoSearch.trim() &&
                      String(r.nroCredito ?? '')
                        .toLowerCase()
                        .includes(creditoSearch.trim().toLowerCase())
                    return (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => addRefund(r)}
                        disabled={isFullyAllocated}
                        className="w-full text-left p-3 hover:bg-muted/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                      >
                        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 items-center">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="font-medium truncate text-sm">
                                {r.fullName}
                              </span>
                              {suggested && (
                                <Badge
                                  variant="outline"
                                  className="shrink-0 border-primary/40 bg-primary/5 text-primary text-[10px]"
                                >
                                  Coincide
                                </Badge>
                              )}
                              {credMatch && (
                                <Badge className="shrink-0 bg-amber-500 hover:bg-amber-500 text-white text-[10px]">
                                  Crédito
                                </Badge>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground truncate mt-0.5">
                              {r.rut} · {r.publicId}
                              {r.nroCredito ? ` · Créd. ${r.nroCredito}` : ''}
                            </div>
                          </div>
                          <div className="justify-self-end text-right shrink-0 rounded-md border bg-background px-2.5 py-1 min-w-[104px]">
                            <div className="text-[10px] uppercase tracking-wide text-muted-foreground leading-none">
                              Saldo
                            </div>
                            <div className="text-sm font-semibold tabular-nums whitespace-nowrap leading-tight mt-1">
                              {formatCurrency(r.remainingAmount)}
                            </div>
                          </div>
                        </div>
                        <div className="mt-2 flex items-center justify-between gap-2">
                          {r.reconciledAmount > 0 && (
                            <Badge variant="outline" className="text-[10px] mt-1">
                              Parcial
                            </Badge>
                          )}
                          <span className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-primary">
                            <Plus className="h-3.5 w-3.5" />
                            Agregar
                          </span>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </ScrollArea>
          </div>

          <div className="md:col-span-5 flex flex-col min-h-0 rounded-lg border bg-card overflow-hidden">
            <div className="shrink-0 flex items-center justify-between gap-2 px-3 py-2 border-b bg-muted/30">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                Seleccionadas ({drafts.length})
              </Label>
              {drafts.length > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={fillRemainingForLast}
                  title="Asignar el saldo restante a la última solicitud"
                >
                  <Wand2 className="h-3.5 w-3.5 mr-1" />
                  Ajustar saldo
                </Button>
              )}
            </div>
            {drafts.length === 0 ? (
              <div className="flex-1 flex items-center justify-center p-6 text-sm text-muted-foreground text-center">
                Aún no has agregado solicitudes.
                <br />
                Búscalas en el panel de la izquierda.
              </div>
            ) : (
              <ScrollArea className="flex-1 min-h-0">
                <div className="space-y-2 p-2 pr-3">
                  {drafts.map((d) => {
                    const over = d.amount > d.refund.remainingAmount + 0.5
                    const { prima, cuotas, primaTotal, realAmount } = computeRealAmount(
                      d.refund,
                      d.amount,
                    )
                    const realInvalid = realAmount <= 0
                    return (
                      <div key={d.refund.id} className="rounded-md border p-2 bg-background">
                        <div className="flex items-start gap-1">
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate text-sm leading-tight">
                              {d.refund.fullName}
                            </div>
                            <div className="text-[11px] text-muted-foreground truncate">
                              {d.refund.rut} · Saldo {formatCurrency(d.refund.remainingAmount)}
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 shrink-0 -mt-0.5 -mr-0.5"
                            onClick={() => removeDraft(d.refund.id)}
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                        <Input
                          type="number"
                          min={0}
                          value={d.amount}
                          onChange={(e) => updateAmount(d.refund.id, e.target.value)}
                          className={`mt-1.5 h-8 w-full text-sm tabular-nums ${
                            over ? 'border-destructive focus-visible:ring-destructive' : ''
                          }`}
                        />
                        {over && (
                          <div className="mt-1 text-[11px] text-destructive flex items-center gap-1">
                            <AlertCircle className="h-3 w-3" />
                            Excede el saldo de la solicitud
                          </div>
                        )}
                        <div
                          className={`mt-2 rounded-md border px-2 py-1.5 text-[11px] leading-tight ${
                            realInvalid
                              ? 'border-destructive/40 bg-destructive/5'
                              : 'border-emerald-200 bg-emerald-50/60'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-muted-foreground">Prima nueva × cuotas</span>
                            <span className="tabular-nums">
                              {formatCurrency(prima)} × {cuotas} ={' '}
                              <span className="font-medium">{formatCurrency(primaTotal)}</span>
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-2 mt-0.5">
                            <span
                              className={
                                realInvalid ? 'text-destructive font-medium' : 'text-emerald-800 font-medium'
                              }
                            >
                              Devolución real
                            </span>
                            <span
                              className={`tabular-nums font-semibold ${
                                realInvalid ? 'text-destructive' : 'text-emerald-700'
                              }`}
                            >
                              {formatCurrency(realAmount)}
                            </span>
                          </div>
                          {realInvalid && (
                            <div className="mt-1 text-[10px] text-destructive flex items-start gap-1">
                              <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
                              La prima total supera el abono asignado. Ajusta el monto.
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </ScrollArea>
            )}
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2 items-stretch sm:items-center">
          <div className="flex-1 text-sm">
            <span className="text-muted-foreground">Nuevos a conciliar: </span>
            <span
              className={`font-semibold ${overApplied ? 'text-destructive' : 'text-foreground'}`}
            >
              {formatCurrency(totalApplied)}
            </span>
            {overApplied && (
              <span className="ml-2 text-xs text-destructive">
                Excede el disponible del abono
              </span>
            )}
          </div>
          <Button
            variant="outline"
            onClick={() => handleClose(false)}
            disabled={confirming}
          >
            Cerrar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={confirming || drafts.length === 0 || overApplied}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
            title="Concilia las solicitudes y las pasa a Pago Programado"
          >
            {confirming && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            <CheckCircle2 className="h-4 w-4 mr-1" />
            Confirmar conciliación {drafts.length > 0 ? `(${drafts.length})` : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// helper también exportado para consumidores externos
export { toNumberSafe }
