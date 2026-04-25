import type { RefundRequest } from '@/types/refund'

/**
 * Devuelve el publicId que debe usarse para consultar/gestionar
 * los documentos de una solicitud de reembolso.
 *
 * Cuando la solicitud viene marcada como `cloned: true`, los documentos
 * viven bajo la solicitud original (`siblingId`). Para todos los demás
 * casos se usa el `publicId` propio.
 */
export function getRefundDocumentsPublicId(
  refund: Pick<RefundRequest, 'publicId' | 'cloned' | 'siblingId'> | null | undefined
): string {
  if (!refund) return ''
  if (refund.cloned && refund.siblingId) return refund.siblingId
  return refund.publicId
}