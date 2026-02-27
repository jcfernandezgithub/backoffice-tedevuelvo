import { useState, useEffect, useMemo } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Loader2, Search, AlertCircle, UserCheck } from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { refundAdminApi } from '@/services/refundAdminApi'
import type { RefundRequest } from '@/types/refund'
import type { NominaRowInput } from '../logic/nomina_logic_complete'
import { cn } from '@/lib/utils'

interface Props {
  open: boolean
  onClose: () => void
  onAdd: (rows: NominaRowInput[]) => void
  existingRuts: string[]
}

function getRealAmount(r: RefundRequest): number {
  if (!r.statusHistory?.length) return r.estimatedAmountCLP || 0
  // Find the last transition to payment_scheduled with realAmount
  for (let i = r.statusHistory.length - 1; i >= 0; i--) {
    const entry = r.statusHistory[i]
    if (entry.to === 'payment_scheduled' && entry.realAmount && entry.realAmount > 0) {
      return entry.realAmount
    }
  }
  return r.estimatedAmountCLP || 0
}

/** Homologa nombres de banco del API al catálogo de la nómina */
const BANK_HOMOLOGATION: Record<string, string> = {
  'banco bci': 'BCI',
  'bci': 'BCI',
  'banco de chile': 'BANCO DE CHILE',
  'banco chile': 'BANCO DE CHILE',
  'banco estado': 'BANCO ESTADO',
  'bancoestado': 'BANCO ESTADO',
  'banco del estado': 'BANCO ESTADO',
  'banco del estado de chile': 'BANCO ESTADO',
  'scotiabank': 'SCOTIABANK CHILE',
  'scotiabank chile': 'SCOTIABANK CHILE',
  'banco santander': 'BANCO SANTANDER',
  'banco santander chile': 'BANCO SANTANDER',
  'santander': 'BANCO SANTANDER',
  'banco itau': 'BANCO ITAU',
  'banco itaú': 'BANCO ITAU',
  'itaú': 'BANCO ITAU',
  'itau': 'BANCO ITAU',
  'banco itaú chile': 'BANCO ITAU',
  'banco security': 'BANCO SECURITY',
  'security': 'BANCO SECURITY',
  'banco bice': 'BANCO BICE',
  'bice': 'BANCO BICE',
  'banco falabella': 'BANCO FALABELLA',
  'falabella': 'BANCO FALABELLA',
  'banco ripley': 'BANCO RIPLEY',
  'ripley': 'BANCO RIPLEY',
  'banco consorcio': 'BANCO CONSORCIO',
  'coopeuch': 'COOPEUCH',
  'banco internacional': 'BANCO INTERNACIONAL',
}

function homologateBank(apiBankName: string): string {
  if (!apiBankName) return ''
  const key = apiBankName.toLowerCase().trim()
  return BANK_HOMOLOGATION[key] || apiBankName.toUpperCase()
}

function mapRefundToRow(r: RefundRequest): NominaRowInput {
  return {
    rutProveedor: r.rut || '',
    nombreProveedor: r.fullName || '',
    emailAviso: r.email || '',
    bancoProveedor: homologateBank(r.bankInfo?.bank || ''),
    cuentaProveedor: r.bankInfo?.accountNumber || '',
    formaPago: 'CTACTESCOTIABANK',
    tipoDocumento: 'VARIOS',
    numeroDocumento: '',
    monto: getRealAmount(r),
    codigoSucursal: '000',
    mensajeAviso: 'Devolución Tedevuelvo',
  }
}

export function AddFromRefundsDialog({ open, onClose, onAdd, existingRuts }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [refunds, setRefunds] = useState<RefundRequest[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (!open) return
    setSelected(new Set())
    setSearch('')
    setError(null)
    fetchRefunds()
  }, [open])

  async function fetchRefunds() {
    setLoading(true)
    setError(null)
    try {
      // API max limit is 100, paginate to get all
      let allItems: RefundRequest[] = []
      let page = 1
      let hasMore = true
      while (hasMore) {
        const res = await refundAdminApi.search({
          status: 'payment_scheduled',
          hasBankInfo: 1,
          limit: 100,
          sort: 'recent',
          page,
        })
        allItems = [...allItems, ...(res.items || [])]
        hasMore = res.hasNext || false
        page++
      }
      setRefunds(allItems)
    } catch (e: any) {
      setError(e.message || 'Error al cargar solicitudes')
      setRefunds([])
    } finally {
      setLoading(false)
    }
  }

  const filtered = useMemo(() => {
    if (!search.trim()) return refunds
    const q = search.toLowerCase()
    return refunds.filter(r =>
      r.fullName?.toLowerCase().includes(q) ||
      r.rut?.toLowerCase().includes(q) ||
      r.publicId?.toLowerCase().includes(q)
    )
  }, [refunds, search])

  const alreadyAddedSet = useMemo(() => new Set(existingRuts.map(r => r.toLowerCase().replace(/\./g, ''))), [existingRuts])

  function isAlreadyAdded(r: RefundRequest) {
    return alreadyAddedSet.has((r.rut || '').toLowerCase().replace(/\./g, ''))
  }

  function getRefundId(r: RefundRequest): string {
    const anyRefund = r as RefundRequest & { _id?: string; id?: string }
    return anyRefund.id || anyRefund._id || r.publicId || `${r.rut}-${r.createdAt}`
  }

  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAll() {
    const selectable = filtered.filter(r => !isAlreadyAdded(r))
    if (selectable.every(r => selected.has(getRefundId(r)))) {
      setSelected(new Set())
    } else {
      setSelected(new Set(selectable.map(getRefundId)))
    }
  }

  function handleConfirm() {
    const rows = refunds
      .filter(r => selected.has(getRefundId(r)))
      .map(mapRefundToRow)
    onAdd(rows)
    onClose()
  }

  const selectableCount = filtered.filter(r => !isAlreadyAdded(r)).length

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCheck className="h-5 w-5" />
            Agregar desde solicitudes
          </DialogTitle>
          <DialogDescription>
            Solicitudes en <Badge variant="secondary" className="mx-1">Pago programado</Badge> con datos bancarios disponibles
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre, RUT o ID..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            Cargando solicitudes...
          </div>
        ) : error ? (
          <div className="flex items-center gap-2 py-8 justify-center text-destructive">
            <AlertCircle className="h-5 w-5" />
            <span className="text-sm">{error}</span>
            <Button size="sm" variant="outline" onClick={fetchRefunds}>Reintentar</Button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">
            <p className="font-medium">Sin solicitudes disponibles</p>
            <p className="text-sm mt-1">No hay solicitudes en Pago programado con datos bancarios{search ? ' que coincidan con la búsqueda' : ''}.</p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between text-sm text-muted-foreground px-1">
              <button
                type="button"
                className="flex items-center gap-2 hover:text-foreground transition-colors"
                onClick={toggleAll}
              >
                <Checkbox
                  checked={selectableCount > 0 && filtered.filter(r => !isAlreadyAdded(r)).every(r => selected.has(getRefundId(r)))}
                />
                Seleccionar todas ({selectableCount})
              </button>
              <span>{selected.size} seleccionada{selected.size !== 1 ? 's' : ''}</span>
            </div>

            <ScrollArea className="flex-1 min-h-0 max-h-[400px] border rounded-md">
              <div className="divide-y">
                {filtered.map(r => {
                  const added = isAlreadyAdded(r)
                  const amount = getRealAmount(r)
                  const refundId = getRefundId(r)
                  return (
                    <div
                      key={refundId}
                      className={cn(
                        'flex items-start gap-3 p-3 hover:bg-muted/50 transition-colors cursor-pointer',
                        added && 'opacity-50 cursor-not-allowed',
                        selected.has(refundId) && 'bg-primary/5'
                      )}
                      onClick={() => !added && toggleSelect(refundId)}
                    >
                      <Checkbox
                        checked={selected.has(refundId)}
                        disabled={added}
                        className="mt-0.5 pointer-events-none"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm truncate">{r.fullName}</span>
                          {added && <Badge variant="outline" className="text-[10px] shrink-0">Ya agregado</Badge>}
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground mt-0.5">
                          <span>{r.rut}</span>
                          <span>{r.publicId}</span>
                          <span>{r.bankInfo?.bank} • {r.bankInfo?.accountNumber}</span>
                        </div>
                      </div>
                      <span className="text-sm font-semibold tabular-nums whitespace-nowrap">
                        ${amount.toLocaleString('es-CL')}
                      </span>
                    </div>
                  )
                })}
              </div>
            </ScrollArea>
          </>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleConfirm} disabled={selected.size === 0}>
            Agregar {selected.size > 0 ? `(${selected.size})` : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
