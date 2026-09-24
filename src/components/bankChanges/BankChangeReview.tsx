import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowRight, Check, X, Ban } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { toast } from '@/hooks/use-toast'
import { useAuth } from '@/state/AuthContext'
import {
  bankInfoChangesApi,
  invalidateBankChanges,
  type BankInfoChange,
  BankChangeError,
} from '@/services/bankInfoChangesApi'
import type { BankInfo } from '@/types/refund'

export function BankInfoBlock({ title, info, tone }: { title: string; info: BankInfo | null | undefined; tone: 'old' | 'new' }) {
  const cls = tone === 'new' ? 'border-primary/40 bg-primary/5' : 'border-border bg-muted/40'
  return (
    <div className={`rounded-lg border p-3 space-y-1.5 ${cls}`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      {info ? (
        <>
          <p className="text-sm font-medium">{info.bank || '—'}</p>
          <p className="text-sm text-muted-foreground">{info.accountType || '—'}</p>
          <p className="text-sm font-mono">{info.accountNumber || '—'}</p>
        </>
      ) : (
        <p className="text-sm italic text-muted-foreground">Sin cuenta registrada</p>
      )}
    </div>
  )
}

export function BankChangeComparison({ change }: { change: BankInfoChange }) {
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
      <BankInfoBlock title="Cuenta vigente" info={change.previousBankInfo} tone="old" />
      <ArrowRight className="h-4 w-4 text-muted-foreground" />
      <BankInfoBlock title="Cuenta propuesta" info={change.newBankInfo} tone="new" />
    </div>
  )
}

export function isOwnChange(change: BankInfoChange, user: { id?: string; email?: string } | null) {
  if (!user) return false
  const by = change.requestedBy
  return !!by && ((!!by.userId && by.userId === user.id) || (!!by.email && by.email.toLowerCase() === user.email?.toLowerCase()))
}

function handleError(e: unknown, qc: ReturnType<typeof useQueryClient>, refundId: string) {
  const err = e as BankChangeError
  toast({ title: 'No se pudo completar', description: err.message, variant: 'destructive' })
  if (err.code && ['CHANGE_NOT_PENDING', 'STALE_CHANGE', 'INVALID_STATUS'].includes(err.code)) {
    invalidateBankChanges(qc, refundId)
  }
}

/** Acciones sobre un cambio PENDING: aprobar / rechazar (ADMIN) y cancelar (solicitante o ADMIN). */
export function BankChangeActions({ change, onDone }: { change: BankInfoChange; onDone?: () => void }) {
  const { user } = useAuth()
  const qc = useQueryClient()
  const [mode, setMode] = useState<'idle' | 'approve' | 'reject'>('idle')
  const [comment, setComment] = useState('')
  const isAdmin = user?.rol === 'ADMIN'
  const own = isOwnChange(change, user)

  const done = (title: string) => {
    toast({ title })
    invalidateBankChanges(qc, change.refundId)
    setMode('idle')
    setComment('')
    onDone?.()
  }

  const approve = useMutation({
    mutationFn: () => bankInfoChangesApi.approve(change._id, comment.trim() || undefined),
    onSuccess: () => done('Cambio aprobado. Datos bancarios actualizados.'),
    onError: (e) => handleError(e, qc, change.refundId),
  })
  const reject = useMutation({
    mutationFn: () => bankInfoChangesApi.reject(change._id, comment.trim()),
    onSuccess: () => done('Cambio rechazado'),
    onError: (e) => handleError(e, qc, change.refundId),
  })
  const cancel = useMutation({
    mutationFn: () => bankInfoChangesApi.cancel(change._id),
    onSuccess: () => done('Propuesta cancelada'),
    onError: (e) => handleError(e, qc, change.refundId),
  })

  const busy = approve.isPending || reject.isPending || cancel.isPending
  if (change.status !== 'PENDING') return null

  if (mode !== 'idle') {
    const isReject = mode === 'reject'
    return (
      <div className="space-y-2 rounded-lg border p-3">
        <Label className="text-xs">
          {isReject ? 'Motivo del rechazo (obligatorio)' : 'Comentario (opcional)'}
        </Label>
        <Textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          maxLength={2000}
          rows={2}
          placeholder={isReject ? 'Ej: La cuenta propuesta no corresponde al titular' : 'Ej: Datos verificados con el cliente por teléfono'}
        />
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" disabled={busy} onClick={() => { setMode('idle'); setComment('') }}>Volver</Button>
          {isReject ? (
            <Button variant="destructive" size="sm" disabled={busy || comment.trim().length === 0} onClick={() => reject.mutate()}>
              {reject.isPending ? 'Rechazando…' : 'Confirmar rechazo'}
            </Button>
          ) : (
            <Button size="sm" disabled={busy} onClick={() => approve.mutate()}>
              {approve.isPending ? 'Aprobando…' : 'Confirmar aprobación'}
            </Button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {(own || isAdmin) && (
        <Button variant="ghost" size="sm" className="gap-1.5" disabled={busy} onClick={() => cancel.mutate()}>
          <Ban className="h-4 w-4" /> {cancel.isPending ? 'Cancelando…' : 'Cancelar propuesta'}
        </Button>
      )}
      {isAdmin && (
        <>
          <Button variant="outline" size="sm" className="gap-1.5" disabled={busy} onClick={() => setMode('reject')}>
            <X className="h-4 w-4" /> Rechazar
          </Button>
          <Button
            size="sm"
            className="gap-1.5"
            disabled={busy || own}
            title={own ? 'Debe aprobarla otro administrador' : undefined}
            onClick={() => setMode('approve')}
          >
            <Check className="h-4 w-4" /> Aprobar
          </Button>
        </>
      )}
      {isAdmin && own && (
        <p className="w-full text-right text-xs text-muted-foreground">Tú creaste esta propuesta: debe aprobarla otro administrador.</p>
      )}
    </div>
  )
}
