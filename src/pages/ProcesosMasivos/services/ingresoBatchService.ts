import { refundAdminApi } from '@/services/refundAdminApi'
import { getRefundDocumentsPublicId } from '@/lib/refundDocsId'
import type { RefundRequest } from '@/types/refund'
import { ingresoBlockers, type IngresoCsvRow } from './ingresoBatchRules'

export interface IngresoRow extends IngresoCsvRow {
  refund?: RefundRequest
  reasons: string[]
}

export async function resolveIngresoRow(row: IngresoCsvRow): Promise<IngresoRow> {
  const refund = await refundAdminApi.getById(row.refundId)
  if (!refund.publicId) throw new Error('La solicitud no tiene identificador público.')
  const documents = await refundAdminApi.listDocs(getRefundDocumentsPublicId(refund))
  return { ...row, refund, reasons: ingresoBlockers(refund, documents) }
}

export async function submitIngresoRow(row: IngresoRow): Promise<RefundRequest> {
  // Releer estado y requisitos justo antes de escribir: no forzar ni repetir envíos.
  const current = await resolveIngresoRow(row)
  if (current.reasons.length) throw new Error(current.reasons.join(' '))
  const refund = current.refund
  if (!refund) throw new Error('No se encontró la solicitud.')
  // Excepción del proceso masivo: conserva requisitos, pero no ejecuta IA.
  const snapshot = refund.calculationSnapshot || {}
  const insurance = String(snapshot.tipoSeguro || snapshot.insuranceToEvaluate || '').toLowerCase()
  if (/cesant|ambos|both/.test(insurance)) {
    const cuotaActual = Number(refund.cuotaActual ?? snapshot.cuotaActual ?? snapshot.valorCuota)
    if (Number(refund.cuotaActual) !== cuotaActual) await refundAdminApi.updatePersonalInformation(refund.publicId, { cuotaActual })
  }
  return refundAdminApi.updateStatus(refund.publicId, {
    status: 'docs_received',
    note: 'Proceso masivo de ingreso bancario desde CSV',
    force: false,
  })
}