import { afterEach, expect, spyOn, test } from 'bun:test'
import { refundAdminApi } from '../src/services/refundAdminApi'
import { aiImageValidationService } from '../src/services/aiImageValidationService'
import { submitIngresoRow } from '../src/pages/ProcesosMasivos/services/ingresoBatchService'
import type { RefundDocument, RefundRequest } from '../src/types/refund'

const refund = {
  publicId: 'bulk-request', status: 'docs_pending', cuotaActual: 120000,
  calculationSnapshot: { nroPoliza: 'P1', nroCredito: 'C1', tipoSeguro: 'cesantia' },
} as RefundRequest
const documents = ['cedula-frente', 'cedula-trasera', 'signed-mandate', 'carta-de-corte-cesantia', 'otros']
  .map(kind => ({ kind }) as RefundDocument)
const row = { lineNumber: 2, refundId: refund.publicId, reasons: [] }
const spies: { mockRestore: () => void }[] = []
afterEach(() => { spies.splice(0).forEach(spy => spy.mockRestore()) })

test('envío masivo omite IA aunque estén activadas ambas validaciones', async () => {
  const get = spyOn(refundAdminApi, 'getById').mockResolvedValue(refund)
  const docs = spyOn(refundAdminApi, 'listDocs').mockResolvedValue(documents)
  const config = spyOn(aiImageValidationService, 'getConfig').mockResolvedValue({ imageValidationEnabled: true, docsValidationEnabled: true })
  const status = spyOn(refundAdminApi, 'updateStatus').mockResolvedValue({ ...refund, status: 'submitted' })
  spies.push(get, docs, config, status)
  const result = await submitIngresoRow(row)
  expect(config).not.toHaveBeenCalled()
  expect(docs).toHaveBeenCalledTimes(1)
  expect(status).toHaveBeenCalledWith('bulk-request', {
    status: 'docs_received', note: 'Proceso masivo de ingreso bancario desde CSV', force: false,
  })
  expect(result.status).toBe('submitted')
})

test('omitir IA no permite enviar sin documentos obligatorios', async () => {
  const get = spyOn(refundAdminApi, 'getById').mockResolvedValue(refund)
  const docs = spyOn(refundAdminApi, 'listDocs').mockResolvedValue(documents.filter(doc => doc.kind !== 'cedula-frente'))
  const status = spyOn(refundAdminApi, 'updateStatus').mockResolvedValue(refund)
  spies.push(get, docs, status)
  await expect(submitIngresoRow(row)).rejects.toThrow('Falta Cédula frontal.')
  expect(status).not.toHaveBeenCalled()
})