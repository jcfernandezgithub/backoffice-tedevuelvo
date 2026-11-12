import type { Evidence } from '@/services/operationalAlertsApi'
import { alertDate, alertMoney } from '@/lib/operationalAlerts'
import { alertAccountType, alertBank, requestStatusLabel } from '@/lib/alertEvidencePresentation'
import { AlertDisclosure } from './AlertCommon'

export function AlertEvidence({ detected }: { detected: Evidence }) {
  const accountKnown = (e: Evidence | null) => Boolean(e && e.accountSource !== 'HISTORICAL_ACCOUNT_UNAVAILABLE')
  const accountValue = (e: Evidence | null, field: 'bank' | 'accountType' | 'maskedAccountNumber') => {
    if (!e) return 'Solicitud no disponible'
    if (!accountKnown(e)) return 'No disponible al momento del pago'
    if (field === 'bank') return alertBank(e.bank)
    if (field === 'accountType') return alertAccountType(e.accountType)
    return e.maskedAccountNumber || 'Número de cuenta no informado'
  }
  const rows = [
    { label: 'Estado de la solicitud', value: requestStatusLabel(detected.status, detected.statusLabel) },
    ...(['bank', 'accountType', 'maskedAccountNumber'] as const).map(field => ({
      label: { bank: 'Banco', accountType: 'Tipo de cuenta', maskedAccountNumber: 'Número de cuenta' }[field],
      value: accountValue(detected, field),
    })),
    { label: 'Monto registrado', value: alertMoney(detected.amountCLP) },
    { label: 'Pago programado el', value: alertDate(detected.scheduledAt) },
    { label: 'Cambio a Pagado el', value: alertDate(detected.paidAt) },
  ]
  const origin = (e: Evidence | null) => !e ? 'Solicitud actual no disponible.' : e.accountSource === 'HISTORICAL_ACCOUNT_UNAVAILABLE' ? 'No se conoce la cuenta usada al pagar; no se reemplaza por la cuenta actual.' : e.accountSource === 'CURRENT_EFFECTIVE_SCHEDULED' ? 'Cuenta registrada para el pago programado.' : 'Cuenta registrada en la solicitud; no confirma la cuenta usada en una transferencia.'
  return <div className="space-y-3">
    <h4 className="font-semibold text-sm border-b pb-2">Antecedentes al detectar la alerta</h4>
    <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">{rows.map(row => <div key={row.label} className="min-w-0 border-b pb-3"><dt className="text-xs text-muted-foreground">{row.label}</dt><dd className="font-medium break-words mt-1">{row.value}</dd></div>)}</dl>
    <p className="text-xs text-muted-foreground">{origin(detected)}</p>
    <AlertDisclosure title="Origen de los montos y antecedentes del pago"><div className="space-y-2 text-xs"><p>Monto: {detected.amountSource === 'STATUS_HISTORY' ? 'Registrado en el historial de la solicitud' : detected.amountSource === 'CURRENT_REAL_AMOUNT' ? 'Monto real registrado al detectar la alerta' : 'Origen no informado'}</p><p>Fecha de pago: {detected.paymentDateSource === 'STATUS_HISTORY' ? 'Cambio de estado registrado en el historial' : 'Origen no informado'}</p>{Boolean(detected.paidReentryCount) && <p>Reingresos al estado Pagado: {detected.paidReentryCount}</p>}{detected.administrativePaymentOnly && <p>Solo consta el estado administrativo; no hay comprobación de transferencia bancaria.</p>}</div></AlertDisclosure>
  </div>
}