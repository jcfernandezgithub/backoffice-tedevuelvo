import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Landmark, Inbox, ExternalLink, RefreshCw } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { bankInfoChangesApi, maskAccount, type BankInfoChange } from '@/services/bankInfoChangesApi'
import { BankChangeActions, BankChangeComparison } from '@/components/bankChanges/BankChangeReview'
import { useAuth } from '@/state/AuthContext'

const fmtDate = (d?: string) => (d ? new Date(d).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' }) : '—')
const fmtCLP = (n?: number) => (typeof n === 'number' ? n.toLocaleString('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }) : '—')
const LIMIT = 20

export default function CambiosBancariosPage() {
  const { user } = useAuth()
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<BankInfoChange | null>(null)

  const q = useQuery({
    queryKey: ['bank-info-changes-pending', page],
    queryFn: () => bankInfoChangesApi.listPending(page, LIMIT),
    enabled: user?.rol === 'ADMIN',
  })

  if (user?.rol !== 'ADMIN') {
    return <p className="p-6 text-muted-foreground">Esta sección es solo para administradores.</p>
  }

  const items = q.data?.data || []
  const total = q.data?.meta?.total || 0
  const pages = Math.max(1, Math.ceil(total / LIMIT))

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2"><Landmark className="h-6 w-6 text-primary" /> Cambios bancarios pendientes</h1>
          <p className="text-sm text-muted-foreground">Revisa y aprueba los cambios de cuenta solicitados por otros usuarios.</p>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => q.refetch()} disabled={q.isFetching}>
          <RefreshCw className={`h-4 w-4 ${q.isFetching ? 'animate-spin' : ''}`} /> Actualizar
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">{total} pendiente(s)</CardTitle></CardHeader>
        <CardContent>
          {q.isLoading ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Cargando…</p>
          ) : q.error ? (
            <p className="py-10 text-center text-sm text-destructive">{(q.error as Error).message}</p>
          ) : items.length === 0 ? (
            <div className="py-12 flex flex-col items-center gap-2 text-muted-foreground">
              <Inbox className="h-8 w-8" />
              <p className="text-sm">No hay cambios pendientes de aprobación.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>RUT</TableHead>
                  <TableHead>Solicitud</TableHead>
                  <TableHead>Cuenta propuesta</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead>Solicitante</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((c) => (
                  <TableRow key={c._id} className="cursor-pointer" onClick={() => setSelected(c)}>
                    <TableCell className="font-medium">{c.fullName || '—'}</TableCell>
                    <TableCell>{c.rut || '—'}</TableCell>
                    <TableCell className="font-mono text-xs">{c.refundId.slice(0, 8)}…</TableCell>
                    <TableCell>{c.newBankInfo?.bank} <span className="font-mono text-xs">{maskAccount(c.newBankInfo?.accountNumber)}</span></TableCell>
                    <TableCell className="max-w-[220px] truncate" title={c.reason}>{c.reason || '—'}</TableCell>
                    <TableCell>{c.requestedBy?.name || c.requestedBy?.email || '—'}</TableCell>
                    <TableCell className="whitespace-nowrap">{fmtDate(c.requestedAt)}</TableCell>
                    <TableCell><Button size="sm" variant="outline">Revisar</Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {pages > 1 && (
            <div className="flex items-center justify-end gap-2 pt-4">
              <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Anterior</Button>
              <span className="text-sm text-muted-foreground">Página {page} de {pages}</span>
              <Button size="sm" variant="outline" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Siguiente</Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="sm:max-w-xl">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle>{selected.fullName || 'Cambio de cuenta'}</DialogTitle>
                <DialogDescription>
                  RUT {selected.rut || '—'} · {selected.institutionId || '—'} · Monto a devolver {fmtCLP(selected.realAmount)}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <BankChangeComparison change={selected} />
                <div className="text-sm space-y-1">
                  <p><span className="text-muted-foreground">Motivo: </span>{selected.reason || '—'}</p>
                  <p><span className="text-muted-foreground">Solicitado por: </span>{selected.requestedBy?.name || selected.requestedBy?.email || '—'} · {fmtDate(selected.requestedAt)}</p>
                </div>
                <div className="flex items-center justify-between gap-2 border-t pt-3">
                  <Button asChild variant="link" size="sm" className="gap-1 px-0">
                    <Link to={`/refunds/${selected.refundId}`}><ExternalLink className="h-4 w-4" /> Ver solicitud</Link>
                  </Button>
                  <BankChangeActions change={selected} onDone={() => setSelected(null)} />
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
