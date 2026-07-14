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
import { Search, X, Plus, Loader2, Wand2, Trash2, CheckCircle2, AlertCircle } from 'lucide-react'
import { formatCurrency } from '@/lib/formatters'
import { cartolaLinksService, type CartolaLink } from '../services/cartolaLinksService'
import { usePendingRefunds } from '../hooks/usePendingRefunds'
import type { PendingRefund } from '../types'
import { toast } from '@/hooks/use-toast'

interface DraftMatch {
  refund: PendingRefund
  amount: number
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

export function LinkRefundsDialog({ movement, open, onOpenChange, onApplied }: Props) {
  const qc = useQueryClient()
  const pendingQuery = usePendingRefunds()
  const pendingRefunds = pendingQuery.data ?? []

  const [drafts, setDrafts] = useState<DraftMatch[]>([])
  const [search, setSearch] = useState('')
  const [creditoSearch, setCreditoSearch] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Links ya asociados al movimiento (backend).
  const detailQuery = useQuery({
    queryKey: ['cartola-reconciliation', 'detail', movement?.documentoNumero ?? ''],
    queryFn: () => cartolaLinksService.getByMovement(movement!.documentoNumero),
    enabled: open && !!movement?.documentoNumero,
    staleTime: 15_000,
  })
  const existingLinks: CartolaLink[] = detailQuery.data?.links ?? []

  // Reset del formulario al abrir el diálogo con otro movimiento.
  useEffect(() => {
    if (open) {
      setDrafts([])
      setSearch('')
      setCreditoSearch('')
    }
  }, [open, movement?.documentoNumero])

  // Mapa publicId → refund pendiente, para enriquecer los links existentes.
  const refundsByPublicId = useMemo(() => {
    const map = new Map<string, PendingRefund>()
    for (const r of pendingRefunds) map.set(r.publicId, r)
    return map
  }, [pendingRefunds])

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
      setSubmitting(false)
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

  const removeExistingLink = async (linkId: string) => {
    if (!movement) return
    try {
      await cartolaLinksService.removeLink(linkId)
      await detailQuery.refetch()
      qc.invalidateQueries({ queryKey: ['cartola-reconciliation'] })
      onApplied?.()
      toast({ title: 'Asociación eliminada' })
    } catch (err: any) {
      toast({
        title: 'No se pudo eliminar',
        description: err?.message ?? 'Error de red',
        variant: 'destructive',
      })
    }
  }

  const handleApply = async () => {
    if (!movement) return
    if (drafts.length === 0) {
      toast({
        title: 'Sin solicitudes',
        description: 'Agrega al menos una solicitud para conciliar.',
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
    try {
      setSubmitting(true)
      await cartolaLinksService.applyMatches(
        movement.documentoNumero,
        drafts.map((d) => ({ publicId: d.refund.publicId, amountApplied: d.amount })),
      )
      qc.invalidateQueries({ queryKey: ['cartola-reconciliation'] })
      toast({
        title: 'Conciliación aplicada',
        description: `${drafts.length} solicitud${drafts.length === 1 ? '' : 'es'} asociada${drafts.length === 1 ? '' : 's'} al movimiento.`,
      })
      onApplied?.()
      handleClose(false)
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err?.message ?? 'No se pudo aplicar.',
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
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

        {/* Solicitudes ya vinculadas */}
        {existingLinks.length > 0 && (
          <div className="shrink-0 rounded-lg border bg-emerald-50/40 border-emerald-200">
            <div className="flex items-center gap-2 px-3 py-2 border-b border-emerald-200 text-xs uppercase tracking-wide text-emerald-800">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Ya asociadas ({existingLinks.length})
            </div>
            <div className="p-2 flex flex-wrap gap-2">
              {existingLinks.map((l) => (
                <div
                  key={l.id}
                  className="flex items-center gap-2 rounded-md border bg-background px-2 py-1 text-xs"
                >
                  <div className="flex flex-col leading-tight">
                    <span
                      className="font-medium truncate max-w-[180px]"
                      title={refundsByPublicId.get(l.refundId)?.fullName ?? l.refundId}
                    >
                      {refundsByPublicId.get(l.refundId)?.fullName ?? l.refundId}
                    </span>
                    <span className="text-muted-foreground">
                      {l.refundId} · {formatCurrency(l.amountApplied)}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-destructive"
                    onClick={() => removeExistingLink(l.id)}
                    title="Quitar asociación"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
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
                <div className="divide-y pr-3">
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
                        className="w-full text-left py-2.5 pl-3 pr-2 hover:bg-muted/50 transition-colors flex items-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate text-sm flex items-center gap-2">
                            {r.fullName}
                            {suggested && (
                              <Badge
                                variant="outline"
                                className="border-primary/40 bg-primary/5 text-primary text-[10px]"
                              >
                                Coincide
                              </Badge>
                            )}
                            {credMatch && (
                              <Badge className="bg-amber-500 hover:bg-amber-500 text-white text-[10px]">
                                Crédito {r.nroCredito}
                              </Badge>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground truncate">
                            {r.rut} · {r.publicId}
                            {r.nroCredito ? ` · Créd. ${r.nroCredito}` : ''}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-sm font-medium tabular-nums whitespace-nowrap">
                            {formatCurrency(r.remainingAmount)}
                          </div>
                          {r.reconciledAmount > 0 && (
                            <Badge variant="outline" className="text-[10px] mt-1">
                              Parcial
                            </Badge>
                          )}
                        </div>
                        <span
                          aria-hidden
                          className="shrink-0 inline-flex items-center justify-center h-7 w-7 rounded-full bg-primary text-primary-foreground"
                        >
                          <Plus className="h-4 w-4" />
                        </span>
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
                      </div>
                    )
                  })}
                </div>
              </ScrollArea>
            )}
          </div>
        </div>

        <DialogFooter>
          <div className="flex-1 text-sm">
            <span className="text-muted-foreground">Total a aplicar: </span>
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
          <Button variant="outline" onClick={() => handleClose(false)} disabled={submitting}>
            Cancelar
          </Button>
          <Button
            onClick={handleApply}
            disabled={submitting || drafts.length === 0 || overApplied}
          >
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Aplicar conciliación
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// helper también exportado para consumidores externos
export { toNumberSafe }
