import { Fragment } from 'react'
import { Badge } from '@/components/ui/badge'
import type { Evidence } from '@/services/operationalAlertsApi'
import { alertDate, alertMoney } from '@/lib/operationalAlerts'
import { alertAccountType, alertBank, requestStatusLabel } from '@/lib/alertEvidencePresentation'
import { AlertDisclosure } from './AlertCommon'

export function AlertEvidenceComparison({ detected, current }: { detected: Evidence; current: Evidence | null }) {
  const accountKnown = (e: Evidence | null) => Boolean(e && e.accountSource !== 'HISTORICAL_ACCOUNT_UNAVAILABLE')
  const accountValue = (e: Evidence | null, field: 'bank' | 'accountType' | 'maskedAccountNumber') => {
    if (!e) return 'Solicitud no disponible'
    if (!accountKnown(e)) return 'No disponible al momento del pago'
    if (field === 'bank') return alertBank(e.bank)
    if (field === 'accountType') return alertAccountType(e.accountType)
    return e.maskedAccountNumber || 'Número de cuenta no informado'
  }
  const rows = [
    { label: 'Estado de la solicitud', before: requestStatusLabel(detected.status, detected.statusLabel), now: current ? requestStatusLabel(current.status, current.statusLabel) : 'Solicitud no disponible' },
    ...(['bank', 'accountType', 'maskedAccountNumber'] as const).map(field => ({
      label: { bank: 'Banco', accountType: 'Tipo de cuenta', maskedAccountNumber: 'Número de cuenta' }[field],
      before: accountValue(detected, field), now: accountValue(current, field),
      changed: Boolean(accountKnown(detected) && accountKnown(current) && detected[field] && current?.[field] && accountValue(detected, field) !== accountValue(current, field)),
    })),
    { label: 'Monto registrado', before: alertMoney(detected.amountCLP), now: current ? alertMoney(current.amountCLP) : 'Solicitud no disponible' },
    { label: 'Pago programado el', before: alertDate(detected.scheduledAt), now: alertDate(current?.scheduledAt) },
    { label: 'Cambio a Pagado el', before: alertDate(detected.paidAt), now: alertDate(current?.paidAt) },
  ]
  const origin = (e: Evidence | null) => !e ? 'Solicitud actual no disponible.' : e.accountSource === 'HISTORICAL_ACCOUNT_UNAVAILABLE' ? 'No se conoce la cuenta usada al pagar; no se reemplaza por la cuenta actual.' : e.accountSource === 'CURRENT_EFFECTIVE_SCHEDULED' ? 'Cuenta registrada para el pago programado.' : 'Cuenta registrada en la solicitud; no confirma la cuenta usada en una transferencia.'
  return <div className="space-y-3">
    <div className="grid grid-cols-2 sm:grid-cols-[minmax(140px,0.8fr)_minmax(0,1fr)_minmax(0,1fr)] gap-x-3 text-sm">
      <div className="hidden sm:block" />
      <h4 className="font-semibold py-2 border-b">Al detectar la alerta</h4>
      <h4 className="font-semibold py-2 border-b">Datos actuales</h4>
      {rows.map(row => <Fragment key={row.label}>
        <div className="col-span-2 sm:col-span-1 text-xs text-muted-foreground pt-3 sm:py-3 sm:border-b">{row.label}</div>
        <div className="min-w-0 break-words py-2 sm:py-3 border-b font-medium">{row.before}</div>
        <div className={`min-w-0 break-words py-2 sm:py-3 border-b font-medium ${'changed' in row && row.changed ? 'bg-primary/5 text-primary' : ''}`}>{row.now}{'changed' in row && row.changed && <Badge variant="outline" className="block w-fit mt-1 text-xs">Cambió desde la detección</Badge>}</div>
      </Fragment>)}
    </div>
    <div className="grid sm:grid-cols-2 gap-3 text-xs text-muted-foreground"><p><strong>Al detectar:</strong> {origin(detected)}</p><p><strong>Ahora:</strong> {origin(current)}</p></div>
    <AlertDisclosure title="Origen de los montos y antecedentes del pago"><div className="grid sm:grid-cols-2 gap-4 text-xs">{[detected,current].map((e,i) => <section key={i} className="space-y-2 min-w-0"><h4 className="font-semibold">{i === 0 ? 'Al detectar la alerta' : 'Datos actuales'}</h4><p>Monto: {e?.amountSource === 'STATUS_HISTORY' ? 'Registrado en el historial de la solicitud' : e?.amountSource === 'CURRENT_REAL_AMOUNT' ? 'Monto real vigente de la solicitud' : 'Origen no informado'}</p><p>Fecha de pago: {e?.paymentDateSource === 'STATUS_HISTORY' ? 'Cambio de estado registrado en el historial' : 'Origen no informado'}</p>{Boolean(e?.paidReentryCount) && <p>Reingresos al estado Pagado: {e?.paidReentryCount}</p>}{e?.administrativePaymentOnly && <p>Solo consta el estado administrativo; no hay comprobación de transferencia bancaria.</p>}</section>)}</div></AlertDisclosure>
  </div>
}