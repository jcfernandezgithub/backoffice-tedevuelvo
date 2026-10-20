import { refundAdminApi } from '@/services/refundAdminApi'
import { aiImageValidationService } from '@/services/aiImageValidationService'
import { authenticatedFetch } from '@/services/apiClient'
import { getRefundDocumentsPublicId } from '@/lib/refundDocsId'
import { validateCedulaChilenaDocuments } from '@/lib/cedulaValidation'
import { validateCreditoDocument } from '@/lib/creditoValidation'
import type { RefundDocument, RefundRequest } from '@/types/refund'
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

async function documentFile(publicId: string, doc: RefundDocument): Promise<File> {
  const response = await authenticatedFetch(`/refund-requests/admin/${publicId}/refund-documents/${doc.id}`)
  if (!response.ok) throw new Error(`No se pudo descargar el documento (${response.status}).`)
  const blob = await response.blob()
  return new File([blob], doc.id, { type: doc.contentType || blob.type })
}

export async function submitIngresoRow(row: IngresoRow): Promise<RefundRequest> {
  // Releer estado y requisitos justo antes de escribir: no forzar ni repetir envíos.
  const current = await resolveIngresoRow(row)
  if (current.reasons.length) throw new Error(current.reasons.join(' '))
  const refund = current.refund
  if (!refund) throw new Error('No se encontró la solicitud.')
  const docsId = getRefundDocumentsPublicId(refund)
  const documents = await refundAdminApi.listDocs(docsId)
  const config = await aiImageValidationService.getConfig()
  if (config.imageValidationEnabled) {
    const frente = documents.find(doc => doc.kind === 'cedula-frente')
    const trasera = documents.find(doc => doc.kind === 'cedula-trasera')
    if (!frente || !trasera) throw new Error('Faltan las cédulas para validar.')
    const anversoFile = await documentFile(docsId, frente)
    const reversoFile = await documentFile(docsId, trasera)
    const validation = await validateCedulaChilenaDocuments({ anversoFile, reversoFile })
    if (validation.es_valida_para_continuar_proceso !== true) throw new Error('La cédula requiere revisión individual con IA. No se envió el cambio de estado.')
  }
  if (config.docsValidationEnabled) {
    for (const doc of documents.filter(doc => doc.kind === 'otros')) {
      const validation = await validateCreditoDocument({ file: await documentFile(docsId, doc) })
      if (validation.es_valida_para_continuar_proceso !== true) throw new Error('El documento de crédito requiere revisión individual con IA. No se envió el cambio de estado.')
    }
  }
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