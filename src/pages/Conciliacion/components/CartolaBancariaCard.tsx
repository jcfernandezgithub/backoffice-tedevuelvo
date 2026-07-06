import { useMemo, useState } from 'react'
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
import { Loader2, Download, AlertTriangle, Building2, Wallet, Calendar } from 'lucide-react'
import { downloadCartolaXml, type CartolaData, type CartolaMovimiento } from '../services/cartolaService'

function toNumber(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  if (typeof v === 'number') return isNaN(v) ? null : v
  const s = String(v).trim().replace(/\./g, '').replace(',', '.')
  if (s === '') return null
  const n = Number(s)
  return isNaN(n) ? null : n
}

function fmtCLP(v: unknown): string {
  const n = toNumber(v)
  if (n === null || n === 0) return '—'
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(n)
}

function fmtSaldo(v: unknown): string {
  const n = toNumber(v)
  if (n === null) return '—'
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(n)
}

function fmtDate(v: unknown): string {
  if (!v) return '—'
  const s = String(v)
  // DD-MM-YYYY (formato del backend)
  const dmy = s.match(/^(\d{2})-(\d{2})-(\d{4})/)
  if (dmy) return `${dmy[1]}/${dmy[2]}/${dmy[3]}`
  // ISO YYYY-MM-DD
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`
  return s
}

export function CartolaBancariaCard() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cartola, setCartola] = useState<CartolaData | null>(null)

  const movimientos: CartolaMovimiento[] = useMemo(() => {
    const raw = cartola?.movimientos?.movimiento
    if (!raw) return []
    return Array.isArray(raw) ? raw : [raw]
  }, [cartola])

  const handleDownload = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await downloadCartolaXml()
      setCartola(res.data)
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'No se pudo obtener la cartola bancaria. Intenta nuevamente en unos minutos.',
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <CardTitle>Cartola bancaria (XML)</CardTitle>
            <CardDescription>
              Descarga automática desde el portal bancario. El proceso puede tardar hasta 30 segundos.
            </CardDescription>
          </div>
          <Button onClick={handleDownload} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Descargando cartola…
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Descargar cartola
              </>
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading && (
          <div className="flex flex-col items-center justify-center gap-3 py-12 border border-dashed rounded-md">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <div className="text-sm text-muted-foreground text-center max-w-sm">
              Iniciando sesión en el portal bancario y descargando la cartola.
              <br />
              Esto puede tardar hasta 30 segundos.
            </div>
          </div>
        )}

        {!loading && error && (
          <div className="flex items-start gap-3 rounded-md border border-destructive/40 bg-destructive/5 p-4">
            <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <div className="text-sm">
              <div className="font-medium text-destructive">No se pudo obtener la cartola</div>
              <div className="text-muted-foreground mt-1">{error}</div>
            </div>
          </div>
        )}

        {!loading && !error && cartola && (
          <>
            {/* Resumen de la cuenta */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 rounded-md border p-4 bg-muted/20">
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground uppercase tracking-wide">
                  <Building2 className="h-3.5 w-3.5" />
                  Empresa
                </div>
                <div className="font-medium text-sm">{cartola.empresa_nombre ?? '—'}</div>
              </div>
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground uppercase tracking-wide">Cuenta</div>
                <div className="font-medium text-sm">
                  {cartola.cuenta_numero ?? '—'}
                  {cartola.moneda && (
                    <span className="text-muted-foreground ml-1">({cartola.moneda})</span>
                  )}
                </div>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground uppercase tracking-wide">
                  <Calendar className="h-3.5 w-3.5" />
                  Período
                </div>
                <div className="font-medium text-sm">
                  {fmtDate(cartola.fecha_desde)} — {fmtDate(cartola.fecha_hasta)}
                </div>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground uppercase tracking-wide">
                  <Wallet className="h-3.5 w-3.5" />
                  Monto disponible
                </div>
                <div className="font-semibold text-base">{fmtSaldo(cartola.monto_disponible)}</div>
              </div>
            </div>

            {/* Movimientos */}
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
                          {fmtSaldo(m.saldo_diario)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </>
        )}

        {!loading && !error && !cartola && (
          <div className="text-center text-sm text-muted-foreground py-8 border rounded-md border-dashed">
            Presiona <span className="font-medium">"Descargar cartola"</span> para obtener los movimientos desde el banco.
          </div>
        )}
      </CardContent>
    </Card>
  )
}