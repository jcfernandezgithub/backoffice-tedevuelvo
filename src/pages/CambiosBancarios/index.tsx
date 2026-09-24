import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Landmark, Inbox, ExternalLink, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import {
  bankInfoChangesApi,
  maskAccount,
  BANK_CHANGE_STATUS_LABELS,
  type BankInfoChange,
  type BankChangeStatus,
} from '@/services/bankInfoChangesApi'
import { BankChangeActions, BankChangeComparison } from '@/components/bankChanges/BankChangeReview'
import { useAuth } from '@/state/AuthContext'

const fmtDate = (d?: string) => (d ? new Date(d).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' }) : '—')
const fmtCLP = (n?: number) => (typeof n === 'number' ? n.toLocaleString('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }) : '—')
const LIMIT = 20

type Tab = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELED'
const TABS: { key: Tab; label: string; empty: string }[] = [
  { key: 'PENDING', label: 'Pendientes', empty: 'No hay cambios pendientes de aprobación.' },
  { key: 'APPROVED', label: 'Aprobadas', empty: 'Aún no hay cambios aprobados.' },
  { key: 'REJECTED', label: 'Rechazadas', empty: 'Aún no hay cambios rechazados.' },
  { key: 'CANCELED', label: 'Canceladas', empty: 'Aún no hay propuestas canceladas.' },
]

const STATUS_BADGE: Partial<Record<BankChangeStatus, string>> = {
  PENDING: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400',
  APPROVED: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400',
  REJECTED: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400',
  CANCELED: 'bg-muted text-muted-foreground',
}

const initials = (name?: string) =>
  (name || '?')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('')

const bankInitials = (bank?: string) =>
  (bank || '?')
    .split(' ')
    .filter((w) => w.length > 2 || /^[A-ZÁÉÍÓÚ]/.test(w))
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('')

export default function CambiosBancariosPage() {
  const { user } = useAuth()
  const [tab, setTab] = useState<Tab>('PENDING')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<BankInfoChange | null>(null)

  const q = useQuery({
    queryKey: ['bank-info-changes-pending', tab, page],
    queryFn: () => bankInfoChangesApi.list(tab, page, LIMIT),
    enabled: user?.rol === 'ADMIN',
  })

  if (user?.rol !== 'ADMIN') {
    return <p className="p-6 text-muted-foreground">Esta sección es solo para administradores.</p>
  }

  const items = q.data?.data || []
  const total = q.data?.meta?.total || 0
  const pages = Math.max(1, Math.ceil(total / LIMIT))
  const from = total === 0 ? 0 : (page - 1) * LIMIT + 1
  const to = Math.min(page * LIMIT, total)
  const activeTab = TABS.find((t) => t.key === tab)!

  const changeTab = (t: Tab) => {
    setTab(t)
    setPage(1)
  }

  return (
    <div className="mx-auto w-full max-w-5xl">
      <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
        {/* Header */}
        <header className="flex flex-wrap items-center justify-between gap-4 border-b px-8 py-6">
          <div className="flex items-center gap-4">
            <div className="rounded-lg bg-primary/10 p-2.5">
              <Landmark className="h-6 w-6 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-bold text-foreground">Cambios bancarios</h1>
                {tab === 'PENDING' && total > 0 && (
                  <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                    {total} pendiente{total === 1 ? '' : 's'}
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Revisa y aprueba las cuentas propuestas para transferir la devolución al cliente.
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" className="gap-2" onClick={() => q.refetch()} disabled={q.isFetching}>
            <RefreshCw className={`h-4 w-4 ${q.isFetching ? 'animate-spin' : ''}`} /> Actualizar
          </Button>
        </header>

        {/* Pestañas */}
        <div className="flex items-center gap-6 border-b bg-muted/40 px-8">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => changeTab(t.key)}
              className={`-mb-px border-b-2 pb-3 pt-3 text-sm transition-colors ${
                tab === t.key
                  ? 'border-primary font-semibold text-primary'
                  : 'border-transparent font-medium text-muted-foreground hover:text-foreground'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Body */}
        {q.isLoading ? (
          <p className="py-16 text-center text-sm text-muted-foreground">Cargando…</p>
        ) : q.error ? (
          <p className="py-16 text-center text-sm text-destructive">{(q.error as Error).message}</p>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-20 text-muted-foreground">
            <div className="rounded-full bg-muted p-4">
              <Inbox className="h-8 w-8" />
            </div>
            <p className="text-sm font-medium">{activeTab.empty}</p>
            {tab === 'PENDING' && (
              <p className="text-xs">Cuando un usuario solicite un cambio de cuenta, aparecerá aquí.</p>
            )}
          </div>
        ) : (
          <div className="divide-y">
            {items.map((c) => (
              <div
                key={c._id}
                className="group flex cursor-pointer items-center justify-between gap-4 px-8 py-6 transition-colors hover:bg-primary/5"
                onClick={() => setSelected(c)}
              >
                <div className="grid flex-1 grid-cols-12 items-center gap-6">
                  {/* Cliente */}
                  <div className="col-span-12 md:col-span-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border bg-muted text-sm font-semibold text-muted-foreground">
                        {initials(c.fullName)}
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-foreground">{c.fullName || '—'}</div>
                        <div className="font-mono text-xs text-muted-foreground">{c.rut || '—'}</div>
                      </div>
                    </div>
                  </div>

                  {/* Cuenta propuesta */}
                  <div className="col-span-6 md:col-span-4">
                    <div className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Cuenta propuesta para la devolución
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-primary">
                        <span className="text-[8px] font-bold text-primary-foreground">{bankInitials(c.newBankInfo?.bank)}</span>
                      </div>
                      <div className="truncate text-sm font-medium text-foreground">
                        {c.newBankInfo?.bank || '—'}{' '}
                        <span className="font-mono text-muted-foreground">{maskAccount(c.newBankInfo?.accountNumber)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Motivo + solicitante */}
                  <div className="col-span-6 flex items-center justify-between gap-4 md:col-span-5">
                    <div className="min-w-0">
                      <div className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">Motivo</div>
                      <p className="max-w-[220px] truncate text-sm text-muted-foreground" title={c.reason}>
                        {c.reason || '—'}
                      </p>
                    </div>
                    <div className="shrink-0 text-right text-xs">
                      <div className="mb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Solicitado por</div>
                      <div className="font-medium text-foreground">{c.requestedBy?.name || c.requestedBy?.email || '—'}</div>
                      <div className="text-muted-foreground">{fmtDate(c.requestedAt)}</div>
                      {tab !== 'PENDING' && c.reviewedAt && (
                        <div className="mt-2 border-t border-dashed pt-1.5">
                          <div className="mb-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                            {c.status === 'APPROVED' ? 'Aprobado por' : 'Rechazado por'}
                          </div>
                          <div className="font-medium text-foreground">{c.reviewedBy?.name || c.reviewedBy?.email || '—'}</div>
                          <div className="text-muted-foreground">{fmtDate(c.reviewedAt)}</div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Acción / estado */}
                <div className="ml-4 shrink-0">
                  {tab === 'PENDING' ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-primary/30 bg-primary/5 font-semibold text-primary hover:bg-primary hover:text-primary-foreground"
                      onClick={(e) => {
                        e.stopPropagation()
                        setSelected(c)
                      }}
                    >
                      Revisar
                    </Button>
                  ) : (
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_BADGE[c.status] || 'bg-muted text-muted-foreground'}`}>
                      {BANK_CHANGE_STATUS_LABELS[c.status] || c.status}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Footer / paginación */}
        {!q.isLoading && !q.error && items.length > 0 && (
          <footer className="flex items-center justify-between border-t bg-muted/40 px-8 py-4">
            <span className="text-xs text-muted-foreground">
              Mostrando {from}-{to} de {total} {activeTab.label.toLowerCase()}
            </span>
            <div className="flex items-center gap-1">
              <Button size="icon" variant="ghost" className="h-8 w-8" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="px-2 text-xs text-muted-foreground">
                {page} / {pages}
              </span>
              <Button size="icon" variant="ghost" className="h-8 w-8" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </footer>
        )}
      </div>

      {/* Diálogo de revisión */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="sm:max-w-xl">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {selected.fullName || 'Cambio de cuenta'}
                  {selected.status !== 'PENDING' && (
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_BADGE[selected.status] || 'bg-muted text-muted-foreground'}`}>
                      {BANK_CHANGE_STATUS_LABELS[selected.status] || selected.status}
                    </span>
                  )}
                </DialogTitle>
                <DialogDescription>
                  RUT {selected.rut || '—'} · {selected.institutionId || '—'} · Monto a devolver {fmtCLP(selected.realAmount)}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <BankChangeComparison change={selected} />
                <div className="space-y-3 text-sm">
                  <p><span className="text-muted-foreground">Motivo: </span>{selected.reason || '—'}</p>
                  <div className={`grid gap-3 ${selected.reviewedAt ? 'sm:grid-cols-2' : ''}`}>
                    <div className="rounded-lg border bg-muted/40 p-3">
                      <div className="mb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Solicitado por</div>
                      <div className="font-medium text-foreground">{selected.requestedBy?.name || selected.requestedBy?.email || '—'}</div>
                      <div className="text-xs text-muted-foreground">{fmtDate(selected.requestedAt)}</div>
                    </div>
                    {selected.reviewedAt && (
                      <div className="rounded-lg border bg-muted/40 p-3">
                        <div className="mb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                          {selected.status === 'APPROVED' ? 'Aprobado por' : selected.status === 'REJECTED' ? 'Rechazado por' : 'Revisado por'}
                        </div>
                        <div className="font-medium text-foreground">{selected.reviewedBy?.name || selected.reviewedBy?.email || '—'}</div>
                        <div className="text-xs text-muted-foreground">{fmtDate(selected.reviewedAt)}</div>
                      </div>
                    )}
                  </div>
                  {selected.reviewComment && (
                    <p><span className="text-muted-foreground">Comentario de revisión: </span>{selected.reviewComment}</p>
                  )}
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
