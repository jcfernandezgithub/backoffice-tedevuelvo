import { useMemo, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Search, X, Plus, Loader2 } from 'lucide-react'
import { formatCurrency } from '@/lib/formatters'
import { conciliacionService } from '../services/conciliacionService'
import type { BankMovement, PendingRefund } from '../types'
import { toast } from '@/hooks/use-toast'

interface DraftMatch {
  refund: PendingRefund
  amount: number
}

interface Props {
  movement: BankMovement | null
  pendingRefunds: PendingRefund[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onApplied: () => void
}

export function MatchDialog({ movement, pendingRefunds, open, onOpenChange, onApplied }: Props) {
  const [drafts, setDrafts] = useState<DraftMatch[]>([])
  const [search, setSearch] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const totalApplied = useMemo(
    () => drafts.reduce((s, d) => s + (Number.isFinite(d.amount) ? d.amount : 0), 0),
    [drafts],
  )
  const movementRemaining = movement?.remaining ?? 0
  const newRemaining = Math.max(0, movementRemaining - totalApplied)
  const overApplied = totalApplied > movementRemaining + 0.5

  const draftIds = new Set(drafts.map((d) => d.refund.id))
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return pendingRefunds
      .filter((r) => !r.isFullyReconciled && !draftIds.has(r.id))
      .filter((r) => {
        if (!q) return true
        return (
          r.fullName.toLowerCase().includes(q) ||
          r.rut.toLowerCase().includes(q) ||
          r.publicId.toLowerCase().includes(q)
        )
      })
      .slice(0, 50)
  }, [pendingRefunds, search, drafts])

  const reset = () => {
    setDrafts([])
    setSearch('')
    setSubmitting(false)
  }

  const handleClose = (next: boolean) => {
    if (!next) reset()
    onOpenChange(next)
  }

  const addRefund = (r: PendingRefund) => {
    const remaining = movementRemaining - totalApplied
    const suggest = Math.min(r.remainingAmount, Math.max(0, remaining))
    setDrafts((prev) => [...prev, { refund: r, amount: Math.round(suggest) }])
  }

  const updateAmount = (refundId: string, raw: string) => {
    const n = Number(raw.replace(/[^0-9.-]/g, ''))
    setDrafts((prev) =>
      prev.map((d) => (d.refund.id === refundId ? { ...d, amount: Number.isFinite(n) ? n : 0 } : d)),
    )
  }

  const removeDraft = (refundId: string) => {
    setDrafts((prev) => prev.filter((d) => d.refund.id !== refundId))
  }

  const handleApply = async () => {
    if (!movement) return
    if (drafts.length === 0) {
      toast({ title: 'Sin solicitudes', description: 'Agrega al menos una solicitud para conciliar.' })
      return
    }
    if (overApplied) {
      toast({ title: 'Monto excedido', description: 'El total supera el saldo del movimiento.', variant: 'destructive' })
      return
    }
    if (drafts.some((d) => d.amount <= 0)) {
      toast({ title: 'Montos inválidos', description: 'Cada solicitud debe tener un monto mayor a 0.', variant: 'destructive' })
      return
    }
    try {
      setSubmitting(true)
      conciliacionService.applyMatches(
        movement.id,
        drafts.map((d) => ({
          refundId: d.refund.id,
          refundPublicId: d.refund.publicId,
          refundClientName: d.refund.fullName,
          refundClientRut: d.refund.rut,
          amountApplied: d.amount,
        })),
      )
      toast({
        title: 'Conciliación aplicada',
        description: `${drafts.length} solicitud${drafts.length === 1 ? '' : 'es'} asociada${drafts.length === 1 ? '' : 's'} al movimiento.`,
      })
      onApplied()
      handleClose(false)
    } catch (err: any) {
      toast({ title: 'Error', description: err?.message ?? 'No se pudo aplicar.', variant: 'destructive' })
    } finally {
      setSubmitting(false)
    }
  }

  if (!movement) return null

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col gap-4">
        <DialogHeader>
          <DialogTitle>Conciliar movimiento</DialogTitle>
          <DialogDescription>
            Asocia este depósito a una o varias solicitudes en estado <strong>Pago programado</strong>.
            Puedes dividir el monto entre varias solicitudes.
          </DialogDescription>
        </DialogHeader>

        <div className="shrink-0 rounded-lg border bg-muted/40 p-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <div className="text-muted-foreground text-xs">Movimiento</div>
            <div className="font-medium truncate">{movement.description}</div>
          </div>
          <div>
            <div className="text-muted-foreground text-xs">Monto original</div>
            <div className="font-medium">{formatCurrency(movement.amount)}</div>
          </div>
          <div>
            <div className="text-muted-foreground text-xs">Saldo actual</div>
            <div className="font-medium text-amber-700">{formatCurrency(movement.remaining)}</div>
          </div>
          <div>
            <div className="text-muted-foreground text-xs">Saldo después</div>
            <div className={`font-semibold ${overApplied ? 'text-destructive' : newRemaining === 0 ? 'text-emerald-700' : 'text-foreground'}`}>
              {formatCurrency(newRemaining)}
            </div>
          </div>
        </div>

        {/* Drafts (scrollable) */}
        <div className="flex-1 min-h-0 flex flex-col space-y-2">
          <Label className="shrink-0 text-xs uppercase tracking-wide text-muted-foreground">
            Solicitudes seleccionadas ({drafts.length})
          </Label>
          {drafts.length === 0 ? (
            <div className="shrink-0 rounded-md border border-dashed p-4 text-sm text-muted-foreground text-center">
              Aún no has agregado solicitudes.
            </div>
          ) : (
            <ScrollArea className="flex-1 min-h-0 rounded-md border">
              <div className="space-y-2 p-2">
                {drafts.map((d) => (
                  <div key={d.refund.id} className="flex items-center gap-2 rounded-md border p-3 bg-card">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{d.refund.fullName}</div>
                      <div className="text-xs text-muted-foreground">
                        {d.refund.rut} • {d.refund.publicId} • Saldo a pagar {formatCurrency(d.refund.remainingAmount)}
                      </div>
                    </div>
                    <Input
                      type="number"
                      min={0}
                      value={d.amount}
                      onChange={(e) => updateAmount(d.refund.id, e.target.value)}
                      className="w-36"
                    />
                    <Button variant="ghost" size="icon" onClick={() => removeDraft(d.refund.id)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>

        <Separator className="shrink-0" />

        {/* Search + list (fixed height, always visible) */}
        <div className="shrink-0 space-y-2 flex flex-col">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">
            Agregar solicitud
          </Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre, RUT o ID público..."
              className="pl-9"
            />
          </div>
          <ScrollArea className="h-48 rounded-md border">
            {filtered.length === 0 ? (
              <div className="p-4 text-sm text-muted-foreground text-center">
                No hay solicitudes pendientes que coincidan.
              </div>
            ) : (
              <div className="divide-y">
                {filtered.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => addRefund(r)}
                    className="w-full text-left p-3 hover:bg-muted/50 transition-colors flex items-center gap-3"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{r.fullName}</div>
                      <div className="text-xs text-muted-foreground">
                        {r.rut} • {r.publicId}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium">{formatCurrency(r.remainingAmount)}</div>
                      {r.reconciledAmount > 0 && (
                        <Badge variant="outline" className="text-[10px] mt-1">Parcial</Badge>
                      )}
                    </div>
                    <Plus className="h-4 w-4 text-muted-foreground" />
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>

        <DialogFooter>
          <div className="flex-1 text-sm">
            <span className="text-muted-foreground">Total a aplicar: </span>
            <span className={`font-semibold ${overApplied ? 'text-destructive' : 'text-foreground'}`}>
              {formatCurrency(totalApplied)}
            </span>
            {overApplied && (
              <span className="ml-2 text-xs text-destructive">Excede el saldo del movimiento</span>
            )}
          </div>
          <Button variant="outline" onClick={() => handleClose(false)} disabled={submitting}>
            Cancelar
          </Button>
          <Button onClick={handleApply} disabled={submitting || drafts.length === 0 || overApplied}>
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Aplicar conciliación
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}