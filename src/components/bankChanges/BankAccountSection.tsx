import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Landmark, CheckCircle, Clock, History, Plus, Pencil, Send, AlertTriangle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { toast } from '@/hooks/use-toast'
import { useAuth } from '@/state/AuthContext'
import type { RefundRequest, BankInfo } from '@/types/refund'
import {
  bankInfoChangesApi,
  invalidateBankChanges,
  BANK_CHANGE_STATUS_LABELS,
  BankChangeError,
  type BankInfoChange,
} from '@/services/bankInfoChangesApi'
import { BankChangeActions, BankChangeComparison, BankInfoBlock } from './BankChangeReview'

const fmtDate = (d?: string) => (d ? new Date(d).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' }) : '—')

const STATUS_VARIANT: Record<string, string> = {
  PENDING: 'bg-amber-500/15 text-amber-700 border-amber-500/30',
  APPROVED: 'bg-emerald-500/15 text-emerald-700 border-emerald-500/30',
  APPLIED_DIRECT: 'bg-emerald-500/15 text-emerald-700 border-emerald-500/30',
  REJECTED: 'bg-destructive/10 text-destructive border-destructive/30',
  CANCELED: 'bg-muted text-muted-foreground',
  EXPIRED: 'bg-muted text-muted-foreground',
}

export function BankChangeStatusBadge({ status }: { status: BankInfoChange['status'] }) {
  return <Badge variant="outline" className={STATUS_VARIANT[status]}>{BANK_CHANGE_STATUS_LABELS[status] || status}</Badge>
}

export function BankAccountSection({ refund }: { refund: RefundRequest }) {
  const { user } = useAuth()
  const isAdmin = user?.rol === 'ADMIN'
  const isOperator = user?.rol === 'n'
  const canUseBankEdit = isAdmin || isOperator
  const [formOpen, setFormOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)

  const isScheduled = refund.status === 'payment_scheduled'
  const hasBank = !!(refund.bankInfo?.bank || refund.bankInfo?.accountType || refund.bankInfo?.accountNumber)

  const { data: history = [], isLoading: historyLoading } = useQuery({
    queryKey: ['bank-info-changes', refund.publicId],
    queryFn: () => bankInfoChangesApi.listForRefund(refund.publicId),
    enabled: isScheduled || refund.status === 'paid',
    retry: 1,
  })

  const pending = history.find((c) => c.status === 'PENDING')
  const hasPending = !!pending || refund.hasPendingBankChange === true
  const canEdit = isScheduled && !hasPending && canUseBankEdit

  if (!isScheduled && !(refund.status === 'paid' && hasBank)) return null

  const actionLabel = !hasBank ? 'Agregar cuenta' : isAdmin ? 'Modificar cuenta' : 'Solicitar cambio de cuenta'
  const ActionIcon = !hasBank ? Plus : isAdmin ? Pencil : Send

  const tone = hasPending ? 'amber' : hasBank ? 'emerald' : 'amber'
  const cardCls = tone === 'emerald' ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-amber-500/40 bg-amber-500/5'

  return (
    <Card className={cardCls}>
      <CardHeader className="pb-3 flex flex-row items-center justify-between gap-2">
        <CardTitle className={`flex items-center gap-2 ${tone === 'emerald' ? 'text-emerald-600' : 'text-amber-600'}`}>
          <Landmark className="h-5 w-5" />
          Datos para devolución
        </CardTitle>
        {isScheduled && canUseBankEdit && (
          <Button
            size="sm"
            variant={hasBank ? 'outline' : 'default'}
            className="gap-1.5"
            disabled={!canEdit}
            title={hasPending ? 'Hay un cambio pendiente de aprobación' : undefined}
            onClick={() => setFormOpen(true)}
          >
            <ActionIcon className="h-4 w-4" />
            {actionLabel}
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {hasPending ? (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <span className="text-sm font-medium text-amber-700">
              Hay un cambio de cuenta bancaria pendiente. El pago está bloqueado hasta resolverlo.
            </span>
          </div>
        ) : hasBank ? (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
            <CheckCircle className="h-5 w-5 text-emerald-600" />
            <span className="text-sm font-medium text-emerald-700">
              {isScheduled ? 'Cuenta bancaria vigente para procesar la devolución' : 'Solicitud pagada: datos de solo lectura'}
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
            <Landmark className="h-5 w-5 text-amber-600" />
            <span className="text-sm font-medium text-amber-700">
              Faltan los datos bancarios del cliente. Usa "Agregar cuenta" para registrarlos.
            </span>
          </div>
        )}

        {pending ? (
          <div className="space-y-3 rounded-lg border border-amber-500/30 bg-background p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Clock className="h-4 w-4 text-amber-600" /> Propuesta de cambio
              </div>
              <span className="text-xs text-muted-foreground">
                {pending.requestedBy?.name || pending.requestedBy?.email || '—'} · {fmtDate(pending.requestedAt)}
              </span>
            </div>
            <BankChangeComparison change={pending} />
            {pending.reason && (
              <p className="text-sm"><span className="text-muted-foreground">Motivo: </span>{pending.reason}</p>
            )}
            <BankChangeActions change={pending} />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Banco</p>
              <p className="font-medium">{refund.bankInfo?.bank || '—'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Tipo de cuenta</p>
              <p className="font-medium">{refund.bankInfo?.accountType || '—'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Número de cuenta</p>
              <p className="font-medium font-mono">{refund.bankInfo?.accountNumber || '—'}</p>
            </div>
          </div>
        )}

        {history.length > 0 && (
          <Collapsible open={historyOpen} onOpenChange={setHistoryOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-1.5 px-2 text-muted-foreground">
                <History className="h-4 w-4" />
                {historyOpen ? 'Ocultar historial' : `Ver historial de cambios (${history.length})`}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-2 pt-2">
              {history.map((c) => (
                <div key={c._id} className="rounded-lg border bg-background p-3 space-y-2 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <BankChangeStatusBadge status={c.status} />
                    <span className="text-xs text-muted-foreground">
                      {c.requestedBy?.name || c.requestedBy?.email || '—'} · {fmtDate(c.requestedAt)}
                    </span>
                  </div>
                  <p>
                    {c.previousBankInfo?.bank || 'Sin cuenta'} → <span className="font-medium">{c.newBankInfo?.bank}</span>{' '}
                    <span className="font-mono">{c.newBankInfo?.accountNumber}</span>
                  </p>
                  {c.reason && <p className="text-muted-foreground">Motivo: {c.reason}</p>}
                  {c.reviewedBy && (
                    <p className="text-muted-foreground">
                      Revisado por {c.reviewedBy.name || c.reviewedBy.email} · {fmtDate(c.reviewedAt)}
                      {c.reviewComment ? ` — "${c.reviewComment}"` : ''}
                    </p>
                  )}
                </div>
              ))}
            </CollapsibleContent>
          </Collapsible>
        )}
        {historyLoading && <p className="text-xs text-muted-foreground">Cargando historial…</p>}
      </CardContent>

      {formOpen && (
        <BankChangeFormDialog
          refund={refund}
          isAdmin={isAdmin}
          onClose={() => setFormOpen(false)}
        />
      )}
    </Card>
  )
}

function BankChangeFormDialog({ refund, isAdmin, onClose }: { refund: RefundRequest; isAdmin: boolean; onClose: () => void }) {
  const qc = useQueryClient()
  const current = refund.bankInfo
  const [bank, setBank] = useState('')
  const [accountType, setAccountType] = useState('')
  const [accountNumber, setAccountNumber] = useState('')
  const [reason, setReason] = useState('')
  const [step, setStep] = useState<'form' | 'confirm'>('form')
  const [errors, setErrors] = useState<Record<string, string>>({})

  const catalogQ = useQuery({
    queryKey: ['bank-info-catalog'],
    queryFn: bankInfoChangesApi.catalog,
    staleTime: 10 * 60 * 1000,
    retry: 1,
  })
  const catalogErr = catalogQ.error as BankChangeError | null
  // Tipos de cuenta fijos: no dependen del catálogo del servicio
  const ACCOUNT_TYPES = ['Cuenta Corriente', 'Cuenta Vista']

  const mutation = useMutation({
    mutationFn: () =>
      bankInfoChangesApi.create(
        refund.publicId,
        { bank: bank.trim(), accountType: accountType.trim(), accountNumber: accountNumber.trim() },
        reason.trim() || undefined,
      ),
    onSuccess: (res) => {
      toast({
        title: res.applied ? 'Datos bancarios actualizados' : 'Cambio enviado para aprobación',
        description: res.applied ? undefined : 'Un administrador debe aprobarlo antes de aplicarse.',
      })
      invalidateBankChanges(qc, refund.publicId)
      onClose()
    },
    onError: (e) => {
      const err = e as BankChangeError
      toast({ title: 'No se pudo guardar', description: err.message, variant: 'destructive' })
      if (err.code && ['PENDING_CHANGE_EXISTS', 'INVALID_STATUS', 'STALE_CHANGE'].includes(err.code)) {
        invalidateBankChanges(qc, refund.publicId)
        onClose()
      }
    },
  })

  const validate = () => {
    const e: Record<string, string> = {}
    const n = accountNumber.trim()
    if (!bank) e.bank = 'Selecciona el banco'
    if (!accountType) e.accountType = 'Selecciona el tipo de cuenta'
    if (!n) e.accountNumber = 'Ingresa el número de cuenta'
    else if (n.length > 30) e.accountNumber = 'Máximo 30 caracteres'
    else if (!/^[0-9-]+$/.test(n) || !/\d/.test(n)) e.accountNumber = 'Solo dígitos y guiones'
    const r = reason.trim()
    if (!isAdmin && r.length < 10) e.reason = 'El motivo debe tener al menos 10 caracteres'
    if (r.length > 2000) e.reason = 'Máximo 2000 caracteres'
    if (
      current &&
      bank === current.bank && accountType === current.accountType && n === (current.accountNumber || '').trim()
    ) e.accountNumber = 'La cuenta propuesta es igual a la vigente'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const disabled = catalogQ.isLoading || !!catalogErr
  const proposed: BankInfo = { bank, accountType, accountNumber: accountNumber.trim() }

  return (
    <Dialog open onOpenChange={(o) => !o && !mutation.isPending && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Landmark className="h-5 w-5 text-primary" />
            {step === 'confirm' ? 'Confirmar cuenta' : current?.bank ? (isAdmin ? 'Modificar cuenta' : 'Solicitar cambio de cuenta') : 'Agregar cuenta'}
          </DialogTitle>
          <DialogDescription>
            {isAdmin
              ? 'Como administrador, el cambio se aplica de inmediato y queda registrado.'
              : 'El cambio quedará pendiente hasta que un administrador lo apruebe. La cuenta vigente no cambia mientras tanto.'}
          </DialogDescription>
        </DialogHeader>

        {step === 'confirm' ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <BankInfoBlock title="Cuenta vigente" info={current?.bank ? current : null} tone="old" />
              <BankInfoBlock title="Cuenta propuesta" info={proposed} tone="new" />
            </div>
            {reason.trim() && <p className="text-sm"><span className="text-muted-foreground">Motivo: </span>{reason.trim()}</p>}
            <div className="flex justify-end gap-2 border-t pt-3">
              <Button variant="outline" disabled={mutation.isPending} onClick={() => setStep('form')}>Volver</Button>
              <Button disabled={mutation.isPending} onClick={() => mutation.mutate()}>
                {mutation.isPending ? 'Enviando…' : isAdmin ? 'Aplicar cambio' : 'Enviar para aprobación'}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {catalogErr && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                {catalogErr.code === 'BANK_CATALOG_NOT_CONFIGURED'
                  ? 'Falta configurar el catálogo de bancos. No es posible registrar cuentas por ahora.'
                  : catalogErr.message}
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Banco</Label>
                <Select value={bank} onValueChange={setBank} disabled={disabled}>
                  <SelectTrigger><SelectValue placeholder={catalogQ.isLoading ? 'Cargando…' : 'Selecciona banco'} /></SelectTrigger>
                  <SelectContent className="max-h-72">
                    {(catalogQ.data?.banks || []).map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                  </SelectContent>
                </Select>
                {errors.bank && <p className="text-xs text-destructive">{errors.bank}</p>}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Tipo de cuenta</Label>
                <Select value={accountType} onValueChange={setAccountType}>
                  <SelectTrigger><SelectValue placeholder="Selecciona tipo" /></SelectTrigger>
                  <SelectContent>
                    {ACCOUNT_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
                {errors.accountType && <p className="text-xs text-destructive">{errors.accountType}</p>}
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label className="text-xs">Número de cuenta</Label>
                <Input value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} inputMode="numeric" maxLength={30} placeholder="1234567890" disabled={disabled} />
                {errors.accountNumber && <p className="text-xs text-destructive">{errors.accountNumber}</p>}
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label className="text-xs">Motivo {isAdmin ? '(opcional)' : '(obligatorio, mín. 10 caracteres)'}</Label>
                <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} maxLength={2000} placeholder="Ej: Cliente informó una nueva cuenta bancaria por correo" disabled={disabled} />
                {errors.reason && <p className="text-xs text-destructive">{errors.reason}</p>}
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t pt-3">
              <Button variant="outline" onClick={onClose}>Cancelar</Button>
              <Button disabled={disabled} onClick={() => validate() && setStep('confirm')}>Revisar</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
