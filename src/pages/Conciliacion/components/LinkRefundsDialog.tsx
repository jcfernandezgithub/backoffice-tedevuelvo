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
import { Search, X, Plus, Loader2, CheckCircle2, Lock, Info } from 'lucide-react'
import { formatCurrency } from '@/lib/formatters'
import { cartolaLinksService, type CartolaLink } from '../services/cartolaLinksService'
import { usePendingRefunds } from '../hooks/usePendingRefunds'
import type { PendingRefund } from '../types'
import { refundAdminApi } from '@/services/refundAdminApi'
import { toast } from '@/hooks/use-toast'

interface DraftMatch {
  refund: PendingRefund
  /** Devolución real editable por el usuario (es también el amountApplied al backend). */
  amount: number
}

/**
 * En conciliación manual el usuario asocia una solicitud a un movimiento
 * bancario cuyo abono suele ser muy superior a la devolución individual
 * (ej. depósito consolidado). No existe un "abono asignado" calculable, por
 * lo tanto sólo trabajamos con:
 *   - Devolución real de la solicitud (editable por el usuario)
 *   - Nueva prima total (informativo)
 */
function computeRealSummary(refund: PendingRefund) {
  const prima = Number(refund.newMonthlyPremium ?? 0)
  const cuotas = Number(refund.confirmedRemainingInstallments ?? 0)
  const primaTotal = Math.max(0, Math.round(prima * cuotas))
  const realFromRefund = Math.round(Number(refund.remainingAmount) || 0)
  return {
    prima,
    cuotas,
    primaTotal,
    realFromRefund,
    isEstimated: !!refund.isEstimated,
  }
}

const DRAFT_STORAGE_KEY = 'manual-reconciliation-draft'

interface DraftStorageEntry {
  refundId: string
  amount: number
}

function getDraftStorageKey(documentoNumero: string) {
  return `${DRAFT_STORAGE_KEY}:${documentoNumero}`
}

function saveDraftsToStorage(documentoNumero: string, drafts: DraftMatch[]) {
  try {
    const payload: DraftStorageEntry[] = drafts.map((d) => ({
      refundId: d.refund.publicId,
      amount: d.amount,
    }))
    localStorage.setItem(getDraftStorageKey(documentoNumero), JSON.stringify(payload))
  } catch {
    // localStorage no crítico; fallamos silenciosamente si no hay espacio
  }
}

function loadDraftsFromStorage(documentoNumero: string): DraftStorageEntry[] | null {
  try {
    const raw = localStorage.getItem(getDraftStorageKey(documentoNumero))
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return null
    return parsed.filter(
      (p): p is DraftStorageEntry =>
        typeof p.refundId === 'string' && typeof p.amount === 'number',
    )
  } catch {
    return null
  }
}

function clearDraftsFromStorage(documentoNumero: string) {
  try {
    localStorage.removeItem(getDraftStorageKey(documentoNumero))
  } catch {
    // ignore
  }
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

  // Al abrir el diálogo intentamos recuperar el borrador del localStorage
  // asociado al documentoNumero del movimiento. Si no existe, comenzamos
  // limpio. Esto evita perder el trabajo si el usuario cierra accidentalmente.
  useEffect(() => {
    if (open) {
      setSearch('')
      setCreditoSearch('')
      setConfirming(false)
      setReviewOpen(false)
      if (!movement?.documentoNumero) {
        setDrafts([])
        return
      }
      const stored = loadDraftsFromStorage(movement.documentoNumero)
      if (stored) {
        // Rehidratamos con los datos actuales del listado de pendientes y
        // descartamos solicitudes que ya estén confirmadas o linkeadas.
        const byId = new Map(pendingRefunds.map((r) => [r.publicId, r]))
        const linkedIds = new Set(existingLinks.map((l) => l.refundId))
        const restored = stored
          .map((entry) => {
            const refund = byId.get(entry.refundId)
            if (!refund || refund.isFullyReconciled || linkedIds.has(entry.refundId)) return null
            return { refund, amount: entry.amount } satisfies DraftMatch
          })
          .filter((d): d is DraftMatch => d !== null)
        setDrafts(restored)
      } else {
        setDrafts([])
      }

    }
  }, [open, movement?.documentoNumero, pendingRefunds, existingLinks])

  // Persistimos el borrador en cada cambio de drafts para que sobreviva a
  // cierres accidentales del diálogo, refrescos de página o navegación.
  useEffect(() => {
    if (!movement?.documentoNumero) return
    saveDraftsToStorage(movement.documentoNumero, drafts)
  }, [drafts, movement?.documentoNumero])


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
      // No limpiamos drafts: el borrador se persiste en localStorage por
      // documentoNumero para que el usuario no pierda el trabajo si cierra
      // accidentalmente el diálogo.
      setSearch('')
      setCreditoSearch('')
      setConfirming(false)
    }
    onOpenChange(next)
  }

  const discardDraft = () => {
    if (!movement?.documentoNumero) return
    clearDraftsFromStorage(movement.documentoNumero)
    setDrafts([])
    toast({
      title: 'Borrador descartado',
      description: 'Las solicitudes seleccionadas se han limpiado.',
    })
  }


  const addRefund = (r: PendingRefund) => {
    // Pre-cargamos con la devolución real de la solicitud; el usuario puede
    // editarla si necesita ajustar el monto final que se registrará.
    setDrafts((prev) => [...prev, { refund: r, amount: Math.round(r.remainingAmount) }])
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
          // En conciliación manual la devolución real es lo que el usuario
          // confirma (editable, pre-cargado con el valor de la solicitud).
          realAmount: d.amount,
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
            realAmount: d.amount,
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
      clearDraftsFromStorage(movement.documentoNumero)
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
                              {r.isEstimated ? 'Estimado' : 'Devolución real'}
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
                    const { prima, cuotas, primaTotal, isEstimated } = computeRealSummary(d.refund)
                    return (
                      <div key={d.refund.id} className="rounded-md border p-2 bg-background">
                        <div className="flex items-start gap-1">
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate text-sm leading-tight">
                              {d.refund.fullName}
                            </div>
                            <div className="text-[11px] text-muted-foreground truncate">
                              {d.refund.rut}
                              {d.refund.nroCredito ? ` · Créd. ${d.refund.nroCredito}` : ''}
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
                        {/* Devolución real (editable) */}
                        <div className="mt-2">
                          <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
                            {isEstimated ? 'Devolución estimada (editable)' : 'Devolución real (editable)'}
                          </Label>
                          <Input
                            type="number"
                            min={0}
                            value={d.amount}
                            onChange={(e) => updateAmount(d.refund.id, e.target.value)}
                            className="mt-1 h-9 w-full text-sm tabular-nums font-semibold"
                          />
                        </div>
                        {/* Nueva prima total (informativo) */}
                        <div className="mt-1.5 rounded-md border border-dashed bg-muted/30 px-2 py-1.5 text-[11px] flex items-center justify-between gap-2">
                          <span className="inline-flex items-center gap-1 text-muted-foreground">
                            <Info className="h-3 w-3" />
                            Nueva prima total
                          </span>
                          <span className="tabular-nums text-right">
                            <span className="text-muted-foreground text-[10px]">
                              {formatCurrency(prima)} × {cuotas} =
                            </span>{' '}
                            <span className="font-semibold text-foreground">
                              {formatCurrency(primaTotal)}
                            </span>
                          </span>
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
            {drafts.length > 0 && (
              <span className="ml-2 inline-flex items-center gap-1 text-xs text-muted-foreground">
                <Info className="h-3 w-3" />
                Borrador guardado automáticamente
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
            variant="outline"
            onClick={discardDraft}
            disabled={confirming || drafts.length === 0}
            className="text-destructive hover:text-destructive hover:bg-destructive/5"
          >
            <X className="h-4 w-4 mr-1" />
            Descartar borrador
          </Button>
          <Button
            onClick={openReview}
            disabled={confirming || drafts.length === 0 || overApplied}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
            title="Revisa el resumen antes de confirmar"
          >
            {confirming && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            <CheckCircle2 className="h-4 w-4 mr-1" />
            Revisar y confirmar {drafts.length > 0 ? `(${drafts.length})` : ''}
          </Button>
        </DialogFooter>

      </DialogContent>

      {/* Diálogo de revisión previo a la confirmación */}
      <Dialog open={reviewOpen} onOpenChange={(v) => !confirming && setReviewOpen(v)}>
        <DialogContent className="max-w-2xl max-h-[92vh] h-[92vh] overflow-hidden flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              Revisa antes de confirmar
            </DialogTitle>
            <DialogDescription>
              Verifica el detalle. Al confirmar, las solicitudes pasarán a{' '}
              <strong>Pago Programado</strong> y no podrán desasociarse.
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="flex-1 min-h-0 pr-1">
            {/* Resumen movimiento */}
            <div className="rounded-lg border bg-muted/40 p-3 text-sm grid grid-cols-3 gap-3">
              <div className="col-span-3 min-w-0">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Movimiento
                </div>
                <div className="font-medium truncate" title={movement.descripcion}>
                  {movement.descripcion || '—'}
                </div>
                <div className="text-[11px] text-muted-foreground font-mono">
                  Doc. {movement.documentoNumero} · {movement.fecha}
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Abono
                </div>
                <div className="font-semibold text-emerald-700 tabular-nums">
                  {formatCurrency(abono)}
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  A conciliar
                </div>
                <div className="font-semibold tabular-nums">{formatCurrency(totalApplied)}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Saldo restante
                </div>
                <div
                  className={`font-semibold tabular-nums ${
                    newAvailable > 0.5 ? 'text-amber-700' : 'text-emerald-700'
                  }`}
                >
                  {formatCurrency(newAvailable)}
                </div>
              </div>
            </div>

            {/* Detalle solicitudes */}
            <div className="rounded-lg border bg-card overflow-hidden flex flex-col">
              <div className="shrink-0 px-3 py-2 border-b bg-muted/30 text-xs uppercase tracking-wide text-muted-foreground">
                Solicitudes a confirmar ({drafts.length})
              </div>
              <div className="divide-y">
                {drafts.map((d) => {
                  const { prima, cuotas, primaTotal, isEstimated } = computeRealSummary(d.refund)
                  const nroCredito = resolveCreditNumber(d.refund)
                  return (
                    <div key={d.refund.id} className="px-3 py-2.5 text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-medium truncate">{d.refund.fullName}</div>
                          <div className="text-[11px] text-muted-foreground truncate font-mono">
                            {d.refund.rut}
                            {nroCredito ? ` · Créd. ${nroCredito}` : ''} · {d.refund.publicId}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-[10px] uppercase tracking-wide text-emerald-800">
                            {isEstimated ? 'Devolución estimada' : 'Devolución real'}
                          </div>
                          <div className="font-semibold tabular-nums text-emerald-700">
                            {formatCurrency(d.amount)}
                          </div>
                        </div>
                      </div>
                      <div className="mt-1.5 text-[11px] text-muted-foreground flex items-center gap-1">
                        <Info className="h-3 w-3" />
                        Nueva prima total: {formatCurrency(prima)} × {cuotas} ={' '}
                        <span className="font-medium text-foreground/80">
                          {formatCurrency(primaTotal)}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
              <div className="shrink-0 border-t bg-muted/30 px-3 py-2 flex items-center justify-between text-xs">
                <span className="text-muted-foreground uppercase tracking-wide text-[10px]">
                  Total devolución real ({drafts.length})
                </span>
                <span className="font-semibold tabular-nums text-emerald-700 text-sm">
                  {formatCurrency(totalApplied)}
                </span>
              </div>
            </div>
          </ScrollArea>

          <DialogFooter className="flex-col sm:flex-row gap-2 items-stretch sm:items-center">
            <Button
              variant="outline"
              onClick={() => setReviewOpen(false)}
              disabled={confirming}
            >
              Volver a editar
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={confirming}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {confirming && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              <CheckCircle2 className="h-4 w-4 mr-1" />
              Confirmar y pasar a Pago Programado
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  )
}

// helper también exportado para consumidores externos
export { toNumberSafe }
