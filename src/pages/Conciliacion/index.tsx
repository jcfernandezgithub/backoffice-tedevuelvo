import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Loader2, RotateCw, AlertTriangle, Building2, Wallet, Calendar } from 'lucide-react'
import { downloadCartolaXml, type CartolaMovimiento } from './services/cartolaService'

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
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 rounded-md border p-4 bg-muted/20">
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
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Movimientos bancarios</CardTitle>
          <CardDescription>
            Cargos, abonos y saldo diario obtenidos desde el XML de la cartola.
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
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {movimientos.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-8">
                        La cartola no contiene movimientos.
                      </TableCell>
                    </TableRow>
                  ) : (
                    movimientos.map((m, i) => (
                      <TableRow key={i}>
                        <TableCell className="whitespace-nowrap text-sm">{fmtDate(m.fecha_movimiento)}</TableCell>
                        <TableCell className="text-sm">
                          <div>{m.descripcion || '—'}</div>
                          {m.documento_numero && (
                            <div className="text-xs text-muted-foreground">Doc. {m.documento_numero}</div>
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
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// Legacy mock conciliación (reemplazada por cartola real)
function _LegacyConciliacion() {
