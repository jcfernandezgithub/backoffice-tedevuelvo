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

export type BankEmailResult = { id: string; name: string; email: string; status: 'success' | 'skipped' | 'error'; detail: string }

// All writes are explicit, sequential and never retried: a failed response can hide an email already sent.
export async function runBankEmailBatch(
  selected: RefundRequest[],
  onResult: (result: BankEmailResult) => void,
  shouldStop: () => boolean,
  wait: () => Promise<void> = () => new Promise(resolve => setTimeout(resolve, 1000)),
) {
  const seen = new Set<string>()
  for (const row of selected) {
    if (shouldStop()) break
    if (seen.has(row.id)) continue
    seen.add(row.id)
    let current: RefundRequest
    try {
      current = await refundAdminApi.getById(row.id)
      const reason = bankEmailEligibility(current)
      if (reason) {
        onResult({ id: row.id, name: current.fullName, email: current.email, status: 'skipped', detail: reason })
        continue
      }
      const response = await refundAdminApi.resendScheduledPaymentEmail(row.id, bankEmailPayload(current))
      if (response.ok !== true) throw new Error('El servicio no confirmó el envío.')
      onResult({ id: row.id, name: current.fullName, email: current.email, status: 'success', detail: 'Servicio confirmó el envío; entrega en bandeja no verificada.' })
    } catch (error) {
      onResult({ id: row.id, name: row.fullName, email: row.email, status: 'error', detail: `${error instanceof Error ? error.message : 'Error desconocido'}. Lote detenido; verificar el envío antes de reintentar.` })
      break
    }
    if (!shouldStop()) await wait()
  }
}