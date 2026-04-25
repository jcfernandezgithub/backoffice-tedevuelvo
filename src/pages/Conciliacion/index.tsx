import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Skeleton } from '@/components/ui/skeleton'
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Search,
  RotateCw,
  Link2,
  EyeOff,
  Eye,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Wallet,
  ChevronRight,
} from 'lucide-react'
import { conciliacionService } from './services/conciliacionService'
import { usePendingRefunds } from './hooks/usePendingRefunds'
import { MovementStatusBadge } from './components/MovementStatusBadge'
import { MatchDialog } from './components/MatchDialog'
import { formatCurrency } from '@/lib/formatters'
import { toast } from '@/hooks/use-toast'
import type { BankMovement } from './types'

function formatDate(iso: string) {
  try {
    const d = new Date(iso)
    return d.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' })
  } catch {
    return iso
  }
}

export default function ConciliacionPage() {
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

        {/* Movements */}
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