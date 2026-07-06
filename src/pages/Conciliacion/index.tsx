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
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState<'all' | 'pending' | 'partial' | 'reconciled' | 'ignored'>('pending')
  const [selected, setSelected] = useState<BankMovement | null>(null)
  const [matchOpen, setMatchOpen] = useState(false)
  const [linkToDelete, setLinkToDelete] = useState<{ id: string; refundPublicId: string; amount: number } | null>(null)

  const movementsQuery = useQuery({
    queryKey: ['conciliacion', 'movements'],
    queryFn: async () => conciliacionService.listMovements(),
    staleTime: 10_000,
  })

  const linksQuery = useQuery({
    queryKey: ['conciliacion', 'links'],
    queryFn: async () => conciliacionService.listLinks(),
    staleTime: 10_000,
  })

  const pendingRefundsQuery = usePendingRefunds()

  const movements = movementsQuery.data ?? []
  const links = linksQuery.data ?? []

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return movements
      .filter((m) => (tab === 'all' ? true : m.status === tab))
      .filter((m) => {
        if (!q) return true
        return (
          m.description.toLowerCase().includes(q) ||
          (m.reference ?? '').toLowerCase().includes(q) ||
          (m.counterpartName ?? '').toLowerCase().includes(q)
        )
      })
  }, [movements, search, tab])

  const stats = useMemo(() => {
    const deposits = movements.filter((m) => m.type === 'deposit')
    const totalDeposits = deposits.reduce((s, m) => s + m.amount, 0)
    const totalReconciled = deposits.reduce((s, m) => s + (m.amount - m.remaining), 0)
    const pendingAmount = deposits
      .filter((m) => m.status !== 'ignored')
      .reduce((s, m) => s + m.remaining, 0)
    const counts = {
      pending: movements.filter((m) => m.status === 'pending').length,
      partial: movements.filter((m) => m.status === 'partial').length,
      reconciled: movements.filter((m) => m.status === 'reconciled').length,
      ignored: movements.filter((m) => m.status === 'ignored').length,
    }
    return { totalDeposits, totalReconciled, pendingAmount, counts }
  }, [movements])

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['conciliacion'] })
  }

  const handleRefresh = () => {
    conciliacionService.refreshFromBank()
    invalidate()
    toast({
      title: 'Movimientos actualizados',
      description: 'Se sincronizó la cuenta corriente (mock).',
    })
  }

  const openMatch = (m: BankMovement) => {
    setSelected(m)
    setMatchOpen(true)
  }

  const toggleIgnored = (m: BankMovement) => {
    const next = m.status === 'ignored' ? false : true
    conciliacionService.setIgnored(m.id, next)
    invalidate()
    toast({
      title: next ? 'Movimiento ignorado' : 'Movimiento reactivado',
      description: m.description,
    })
  }

  const confirmRemoveLink = () => {
    if (!linkToDelete) return
    conciliacionService.removeLink(linkToDelete.id)
    setLinkToDelete(null)
    invalidate()
    toast({ title: 'Asociación eliminada', description: `Se liberó ${formatCurrency(linkToDelete.amount)} del saldo.` })
  }

  return (
    <TooltipProvider>
      <div className="container max-w-7xl mx-auto p-4 md:p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">Conciliación bancaria</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Asocia los depósitos recibidos en la cuenta corriente con las solicitudes en pago programado.
            </p>
          </div>
          <Button onClick={handleRefresh} variant="outline">
            <RotateCw className="h-4 w-4 mr-2" />
            Sincronizar banco
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <ArrowDownToLine className="h-4 w-4 text-emerald-600" />
                Total depósitos
              </CardDescription>
              <CardTitle className="text-2xl">{formatCurrency(stats.totalDeposits)}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                Conciliado
              </CardDescription>
              <CardTitle className="text-2xl">{formatCurrency(stats.totalReconciled)}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-amber-600" />
                Por conciliar
              </CardDescription>
              <CardTitle className="text-2xl">{formatCurrency(stats.pendingAmount)}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <Wallet className="h-4 w-4 text-blue-600" />
                Solicitudes pendientes pago
              </CardDescription>
              <CardTitle className="text-2xl">
                {pendingRefundsQuery.isLoading ? <Skeleton className="h-7 w-16" /> : (pendingRefundsQuery.data?.filter((r) => !r.isFullyReconciled).length ?? 0)}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>

        {/* Cartola bancaria real (XML) */}
        <CartolaBancariaCard />

        {/* Movements (mock / conciliación manual) */}
        <Card>
          <CardHeader>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div>
                <CardTitle>Movimientos bancarios</CardTitle>
                <CardDescription>Cuenta corriente · últimos movimientos</CardDescription>
              </div>
              <div className="relative w-full md:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar por descripción o referencia"
                  className="pl-9"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
              <TabsList className="mb-4">
                <TabsTrigger value="pending">Pendientes ({stats.counts.pending})</TabsTrigger>
                <TabsTrigger value="partial">Parciales ({stats.counts.partial})</TabsTrigger>
                <TabsTrigger value="reconciled">Conciliados ({stats.counts.reconciled})</TabsTrigger>
                <TabsTrigger value="ignored">Ignorados ({stats.counts.ignored})</TabsTrigger>
                <TabsTrigger value="all">Todos ({movements.length})</TabsTrigger>
              </TabsList>

              <TabsContent value={tab} className="mt-0">
                {movementsQuery.isLoading ? (
                  <div className="space-y-2">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <Skeleton key={i} className="h-16 w-full" />
                    ))}
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="text-center text-sm text-muted-foreground py-12 border rounded-md border-dashed">
                    No hay movimientos que coincidan con los filtros.
                  </div>
                ) : (
                  <div className="rounded-md border overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Fecha</TableHead>
                          <TableHead>Descripción</TableHead>
                          <TableHead>Referencia</TableHead>
                          <TableHead className="text-right">Monto</TableHead>
                          <TableHead className="text-right">Saldo</TableHead>
                          <TableHead>Estado</TableHead>
                          <TableHead className="text-right">Acciones</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filtered.map((m) => {
                          const isDeposit = m.type === 'deposit'
                          const movLinks = links.filter((l) => l.movementId === m.id)
                          return (
                            <>
                              <TableRow key={m.id} className="align-top">
                                <TableCell className="whitespace-nowrap text-sm">{formatDate(m.date)}</TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-2">
                                    {isDeposit ? (
                                      <ArrowDownToLine className="h-4 w-4 text-emerald-600 shrink-0" />
                                    ) : (
                                      <ArrowUpFromLine className="h-4 w-4 text-muted-foreground shrink-0" />
                                    )}
                                    <div>
                                      <div className="font-medium">{m.description}</div>
                                      {m.counterpartName && (
                                        <div className="text-xs text-muted-foreground">{m.counterpartName}</div>
                                      )}
                                    </div>
                                  </div>
                                </TableCell>
                                <TableCell className="text-xs text-muted-foreground">{m.reference ?? '—'}</TableCell>
                                <TableCell className={`text-right font-medium ${isDeposit ? 'text-emerald-700' : 'text-muted-foreground'}`}>
                                  {formatCurrency(m.amount)}
                                </TableCell>
                                <TableCell className="text-right font-medium">
                                  {isDeposit ? formatCurrency(m.remaining) : '—'}
                                </TableCell>
                                <TableCell>
                                  <MovementStatusBadge status={m.status} />
                                </TableCell>
                                <TableCell className="text-right">
                                  <div className="flex justify-end gap-1">
                                    {isDeposit && m.status !== 'ignored' && m.remaining > 0.5 && (
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Button size="sm" onClick={() => openMatch(m)}>
                                            <Link2 className="h-4 w-4 mr-1" />
                                            Conciliar
                                          </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>Asociar a solicitudes</TooltipContent>
                                      </Tooltip>
                                    )}
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button size="icon" variant="ghost" onClick={() => toggleIgnored(m)}>
                                          {m.status === 'ignored' ? (
                                            <Eye className="h-4 w-4" />
                                          ) : (
                                            <EyeOff className="h-4 w-4" />
                                          )}
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        {m.status === 'ignored' ? 'Reactivar' : 'Ignorar movimiento'}
                                      </TooltipContent>
                                    </Tooltip>
                                  </div>
                                </TableCell>
                              </TableRow>
                              {movLinks.length > 0 && (
                                <TableRow className="bg-muted/30">
                                  <TableCell colSpan={7} className="py-2">
                                    <div className="pl-7 space-y-1">
                                      <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
                                        Solicitudes asociadas
                                      </div>
                                      {movLinks.map((l) => (
                                        <div
                                          key={l.id}
                                          className="flex items-center justify-between rounded-md bg-card border px-3 py-2"
                                        >
                                          <div className="flex items-center gap-2 min-w-0">
                                            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                                            <div className="min-w-0">
                                              <div className="text-sm font-medium truncate">
                                                {l.refundClientName}
                                              </div>
                                              <div className="text-xs text-muted-foreground truncate">
                                                {l.refundClientRut} • {l.refundPublicId}
                                              </div>
                                            </div>
                                          </div>
                                          <div className="flex items-center gap-3">
                                            <span className="text-sm font-semibold">
                                              {formatCurrency(l.amountApplied)}
                                            </span>
                                            <Button
                                              size="icon"
                                              variant="ghost"
                                              onClick={() =>
                                                setLinkToDelete({
                                                  id: l.id,
                                                  refundPublicId: l.refundPublicId,
                                                  amount: l.amountApplied,
                                                })
                                              }
                                            >
                                              <Trash2 className="h-4 w-4 text-destructive" />
                                            </Button>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </TableCell>
                                </TableRow>
                              )}
                            </>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <MatchDialog
          movement={selected}
          pendingRefunds={pendingRefundsQuery.data ?? []}
          open={matchOpen}
          onOpenChange={setMatchOpen}
          onApplied={invalidate}
        />

        <AlertDialog open={!!linkToDelete} onOpenChange={(o) => !o && setLinkToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Eliminar asociación?</AlertDialogTitle>
              <AlertDialogDescription>
                Se liberará el monto del saldo del movimiento y se desconciliará la solicitud{' '}
                <strong>{linkToDelete?.refundPublicId}</strong>. Esta acción no afecta el estado de la solicitud.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={confirmRemoveLink}>Eliminar</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </TooltipProvider>
  )
}