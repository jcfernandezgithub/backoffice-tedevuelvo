import { refundAdminApi } from '@/services/refundAdminApi'
import type { RefundRequest } from '@/types/refund'

export function bankEmailEligibility(refund: RefundRequest): string | null {
  if (refund.status?.toLowerCase() !== 'payment_scheduled') return 'La solicitud ya no está en Pago programado.'
  if (!refund.email?.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(refund.email.trim())) return 'Correo del cliente ausente o inválido.'
  const amount = (refund as RefundRequest & { realAmount?: number }).realAmount
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) return 'Monto aprobado ausente o inválido.'
  return null
}

export function bankEmailPayload(refund: RefundRequest) {
  const reason = bankEmailEligibility(refund)
  if (reason) throw new Error(reason)
  return {
    nombre_cliente: refund.fullName || '',
    email: refund.email,
    idSolicitud: refund.publicId || refund.id,
    monto_aprobado: (refund as RefundRequest & { realAmount: number }).realAmount,
    estado: refund.status,
    linkAccion: 'https://www.tedevuelvo.cl/login',
  }
}

export type BankEmailResult = { id: string; name: string; email: string; status: 'success' | 'skipped' | 'error'; detail: string; attempted?: boolean }

// All writes are explicit, sequential and never retried: a failed response can hide an email already sent.
export async function runBankEmailBatch(
  selected: RefundRequest[],
  onResult: (result: BankEmailResult) => void,
  shouldStop: () => boolean,
  wait: () => Promise<void> = () => new Promise(resolve => setTimeout(resolve, 1000)),
  processed: ReadonlySet<string> = new Set(),
) {
  const seen = new Set<string>()
  for (const row of selected) {
    if (shouldStop()) break
    if (seen.has(row.id)) continue
    seen.add(row.id)
    if (processed.has(row.id)) {
      onResult({ id: row.id, name: row.fullName, email: row.email, status: 'skipped', detail: 'Advertencia: ya procesada en esta sesión; se continúa con las demás.' })
      continue
    }
    let current: RefundRequest
    let attempted = false
    try {
      const publicId = row.publicId || row.id
      current = await refundAdminApi.getById(publicId)
      const reason = bankEmailEligibility(current)
      if (reason) {
        onResult({ id: row.id, name: current.fullName, email: current.email, status: 'skipped', detail: reason })
        continue
      }
      attempted = true
      const response = await refundAdminApi.resendScheduledPaymentEmail(publicId, bankEmailPayload(current))
      if (response.ok !== true) throw new Error('El servicio no confirmó el envío.')
      onResult({ id: row.id, name: current.fullName, email: current.email, status: 'success', attempted, detail: 'Servicio confirmó el envío; entrega en bandeja no verificada.' })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error desconocido'
      if (attempted && /\b(ya (?:fue |ha sido |est[aá] )?procesad[ao]|already processed)\b/i.test(message)) {
        onResult({ id: row.id, name: row.fullName, email: row.email, status: 'skipped', attempted, detail: `Advertencia: ${message}. Se continúa con las demás.` })
        continue
      }
      onResult({ id: row.id, name: row.fullName, email: row.email, status: 'error', attempted, detail: `${message}. Lote detenido; ${attempted ? 'verificar el envío' : 'no se ejecutó el envío de esta solicitud'} antes de reintentar.` })
      break
    }
    if (!shouldStop()) await wait()
  }
}