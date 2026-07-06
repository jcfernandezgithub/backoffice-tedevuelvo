import { useMemo, useState, useSyncExternalStore } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Loader2,
  RotateCw,
  AlertTriangle,
  Building2,
  Wallet,
  Calendar,
  Link2,
  CheckCircle2,
} from 'lucide-react'
import { downloadCartolaXml, type CartolaMovimiento } from './services/cartolaService'
import { cartolaLinksService } from './services/cartolaLinksService'
import {
  LinkRefundsDialog,
  type CartolaMovementRef,
} from './components/LinkRefundsDialog'

function toNumber(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  if (typeof v === 'number') return isNaN(v) ? null : v
  const s = String(v).trim().replace(/\./g, '').replace(',', '.')
  if (s === '') return null
  const n = Number(s)
  return isNaN(n) ? null : n
}

function fmtCLP(v: unknown, opts: { showZero?: boolean } = {}): string {
  const n = toNumber(v)
  if (n === null) return '—'
  if (n === 0 && !opts.showZero) return '—'
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(n)
}

function fmtDate(v: unknown): string {
  if (!v) return '—'
  const s = String(v)
  const dmy = s.match(/^(\d{2})-(\d{2})-(\d{4})/)
  if (dmy) return `${dmy[1]}/${dmy[2]}/${dmy[3]}`
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`
  return s
}

// Suscripción global al store de links para re-render reactivo.
function subscribeLinks(cb: () => void) {
  const handler = () => cb()
  window.addEventListener('cartola-links-changed', handler)
  window.addEventListener('storage', handler)
  return () => {
    window.removeEventListener('cartola-links-changed', handler)
    window.removeEventListener('storage', handler)
  }
}
function getLinksSnapshot() {
  return JSON.stringify(cartolaLinksService.all())
}

export default function ConciliacionPage() {
  const query = useQuery({
    queryKey: ['cartola', 'xml'],
    queryFn: downloadCartolaXml,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    retry: false,
  })

  const cartola = query.data?.data
  const movimientos: CartolaMovimiento[] = useMemo(() => {
    const raw = cartola?.movimientos?.movimiento
    if (!raw) return []
    return Array.isArray(raw) ? raw : [raw]
  }, [cartola])

  const errorMsg = query.error instanceof Error ? query.error.message : null

  // Reactividad al store de links
  const linksSnapshot = useSyncExternalStore(subscribeLinks, getLinksSnapshot, getLinksSnapshot)
  const linksByMov = useMemo(() => {
    try {
      return JSON.parse(linksSnapshot) as ReturnType<typeof cartolaLinksService.all>
    } catch {
      return {}
    }
  }, [linksSnapshot])

  const [dialogOpen, setDialogOpen] = useState(false)
  const [selected, setSelected] = useState<CartolaMovementRef | null>(null)

  const openLinkDialog = (m: CartolaMovimiento) => {
    const doc = String(m.documento_numero ?? '').trim()
    if (!doc) return
    setSelected({
      documentoNumero: doc,
      descripcion: String(m.descripcion ?? ''),
      abono: toNumber(m.abono) ?? 0,
      fecha: fmtDate(m.fecha_movimiento),
    })
    setDialogOpen(true)
  }

  // KPI global de conciliación de abonos
  const abonoStats = useMemo(() => {
    let totalAbonos = 0
    let abonosCount = 0
    let conciliado = 0
    let movsConciliados = 0
    for (const m of movimientos) {
      const abono = toNumber(m.abono) ?? 0
      if (abono > 0) {
        totalAbonos += abono
        abonosCount += 1
        const links = linksByMov[String(m.documento_numero ?? '')] ?? []
        const applied = links.reduce((s, l) => s + l.amountApplied, 0)
        conciliado += applied
        if (applied > 0) movsConciliados += 1
      }
    }
    return { totalAbonos, abonosCount, conciliado, movsConciliados }
  }, [movimientos, linksByMov])

  return (
    <div className="container max-w-7xl mx-auto p-4 md:p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">Conciliación bancaria</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Cartola descargada automáticamente desde el portal bancario.
          </p>
        </div>
        <Button onClick={() => query.refetch()} variant="outline" disabled={query.isFetching}>
          {query.isFetching ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Actualizando…
            </>
          ) : (
            <>
              <RotateCw className="h-4 w-4 mr-2" />
              Actualizar cartola
            </>
          )}
        </Button>
      </div>

      {/* Resumen de cuenta */}
      {cartola && !query.isFetching && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 rounded-md border p-4 bg-muted/20">
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground uppercase tracking-wide">
              <Building2 className="h-3.5 w-3.5" /> Empresa
            </div>
            <div className="font-medium text-sm">{cartola.empresa_nombre ?? '—'}</div>
          </div>
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground uppercase tracking-wide">Cuenta</div>
            <div className="font-medium text-sm">
              {cartola.cuenta_numero ?? '—'}
              {cartola.moneda && <span className="text-muted-foreground ml-1">({cartola.moneda})</span>}
            </div>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground uppercase tracking-wide">
              <Calendar className="h-3.5 w-3.5" /> Período
            </div>
            <div className="font-medium text-sm">
              {fmtDate(cartola.fecha_desde)} — {fmtDate(cartola.fecha_hasta)}
            </div>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground uppercase tracking-wide">
              <Wallet className="h-3.5 w-3.5" /> Monto disponible
            </div>
            <div className="font-semibold text-base">{fmtCLP(cartola.monto_disponible, { showZero: true })}</div>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground uppercase tracking-wide">
              <Link2 className="h-3.5 w-3.5" /> Conciliado
            </div>
            <div className="font-semibold text-base text-emerald-700">
              {fmtCLP(abonoStats.conciliado, { showZero: true })}
            </div>
            <div className="text-[11px] text-muted-foreground">
              {abonoStats.movsConciliados} de {abonoStats.abonosCount} abonos
            </div>
          </div>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Movimientos bancarios</CardTitle>
          <CardDescription>
            Cargos, abonos y saldo diario obtenidos desde el XML de la cartola.
            Cada abono puede asociarse a una o varias solicitudes en pago programado.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {query.isLoading || query.isFetching ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 border border-dashed rounded-md">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <div className="text-sm text-muted-foreground text-center max-w-sm">
                Descargando cartola desde el portal bancario.
                <br />
                Esto puede tardar hasta 30 segundos.
              </div>
            </div>
          ) : errorMsg ? (
            <div className="flex items-start gap-3 rounded-md border border-destructive/40 bg-destructive/5 p-4">
              <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
              <div className="text-sm">
                <div className="font-medium text-destructive">No se pudo obtener la cartola</div>
                <div className="text-muted-foreground mt-1">{errorMsg}</div>
              </div>
            </div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="whitespace-nowrap">Fecha</TableHead>
                    <TableHead>Descripción</TableHead>
                    <TableHead className="text-right whitespace-nowrap">Cargo</TableHead>
                    <TableHead className="text-right whitespace-nowrap">Abono</TableHead>
                    <TableHead className="text-right whitespace-nowrap">Saldo diario</TableHead>
                    <TableHead className="whitespace-nowrap">Conciliación</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {movimientos.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">
                        La cartola no contiene movimientos.
                      </TableCell>
                    </TableRow>
                  ) : (
                    movimientos.map((m, i) => {
                      const doc = String(m.documento_numero ?? '').trim()
                      const abono = toNumber(m.abono) ?? 0
                      const links = doc ? linksByMov[doc] ?? [] : []
                      const applied = links.reduce((s, l) => s + l.amountApplied, 0)
                      const remaining = Math.max(0, abono - applied)
                      const canLink = abono > 0 && !!doc
                      const isFull = canLink && remaining <= 0.5 && applied > 0
                      const isPartial = canLink && applied > 0 && !isFull
                      return (
                      <TableRow key={doc || i} className={isFull ? 'bg-emerald-50/40' : isPartial ? 'bg-amber-50/40' : undefined}>
                        <TableCell className="whitespace-nowrap text-sm">{fmtDate(m.fecha_movimiento)}</TableCell>
                        <TableCell className="text-sm">
                          <div>{m.descripcion || '—'}</div>
                          {m.documento_numero && (
                            <div className="text-xs text-muted-foreground font-mono">Doc. {m.documento_numero}</div>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-medium text-red-600 tabular-nums">
                          {fmtCLP(m.cargo)}
                        </TableCell>
                        <TableCell className="text-right font-medium text-emerald-600 tabular-nums">
                          {fmtCLP(m.abono)}
                        </TableCell>
                        <TableCell className="text-right font-medium tabular-nums">
                          {fmtCLP(m.saldo_diario, { showZero: true })}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {!canLink ? (
                            <span className="text-xs text-muted-foreground">—</span>
                          ) : (
                            <div className="flex items-center gap-2">
                              {isFull ? (
                                <Badge className="bg-emerald-600 hover:bg-emerald-600 gap-1">
                                  <CheckCircle2 className="h-3 w-3" />
                                  {links.length} solicitud{links.length === 1 ? '' : 'es'}
                                </Badge>
                              ) : isPartial ? (
                                <Badge variant="outline" className="border-amber-400 bg-amber-50 text-amber-800 gap-1">
                                  Parcial · {links.length}
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-muted-foreground">
                                  Sin conciliar
                                </Badge>
                              )}
                              <Button
                                size="sm"
                                variant={applied > 0 ? 'outline' : 'default'}
                                className="h-7 px-2 text-xs"
                                onClick={() => openLinkDialog(m)}
                              >
                                <Link2 className="h-3.5 w-3.5 mr-1" />
                                {applied > 0 ? 'Ver / editar' : 'Conciliar'}
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    )})
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <LinkRefundsDialog
        movement={selected}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </div>
  )
}
