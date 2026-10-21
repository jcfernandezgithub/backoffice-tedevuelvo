import { afterEach, expect, spyOn, test } from 'bun:test'
import { refundAdminApi } from '../src/services/refundAdminApi'
import { aiImageValidationService } from '../src/services/aiImageValidationService'
import { authService } from '../src/services/authService'
import { beforeEach } from 'bun:test'
import { submitIngresoRow, readIngresoCurrentState } from '../src/pages/ProcesosMasivos/services/ingresoBatchService'
import type { RefundDocument, RefundRequest } from '../src/types/refund'

const refund = {
  publicId: 'bulk-request', status: 'docs_pending', cuotaActual: 120000,
  calculationSnapshot: { nroPoliza: 'P1', nroCredito: 'C1', tipoSeguro: 'cesantia' },
} as RefundRequest
const documents = ['cedula-frente', 'cedula-trasera', 'signed-mandate', 'carta-de-corte-cesantia', 'otros']
  .map(kind => ({ kind }) as RefundDocument)
const row = { lineNumber: 2, refundId: refund.publicId, reasons: [] }
const spies: { mockRestore: () => void }[] = []
beforeEach(() => {
  spies.push(spyOn(authService, 'getCurrent').mockReturnValue({
    id: 'executor-1', nombre: 'Usuario Ejecutor', email: 'ejecutor@example.cl', rol: 'ADMIN', activo: true,
  }))
})
afterEach(() => { spies.splice(0).forEach(spy => spy.mockRestore()) })

test('consulta el estado posterior y muestra ingresada sin repetir el cambio', async () => {
  const get = spyOn(refundAdminApi, 'getById')
    .mockResolvedValueOnce({ ...refund, status: 'docs_received' })
    .mockResolvedValueOnce({ ...refund, status: 'submitted' })
  const status = spyOn(refundAdminApi, 'updateStatus').mockResolvedValue(refund)
  spies.push(get, status)
  const current = await readIngresoCurrentState(refund.publicId, async () => {})
  expect(current.status).toBe('submitted')
  expect(get).toHaveBeenCalledTimes(2)
  expect(status).not.toHaveBeenCalled()
})

test('no inventa ingresada si el backend todavía devuelve documentos recibidos', async () => {
  const get = spyOn(refundAdminApi, 'getById').mockResolvedValue({ ...refund, status: 'docs_received' })
  spies.push(get)
  const current = await readIngresoCurrentState(refund.publicId, async () => {})
  expect(current.status).toBe('docs_received')
  expect(get).toHaveBeenCalledTimes(5)
})

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
    status: 'docs_received', note: 'Proceso masivo de cambio de estado — Envío de Datos al Banco desde CSV. Ejecutado por: Usuario Ejecutor (ejecutor@example.cl; ID: executor-1).', force: false,
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

test('fuerza el retorno desde ingresada usando el estado recién consultado', async () => {
  const get = spyOn(refundAdminApi, 'getById').mockResolvedValue({ ...refund, status: 'submitted' })
  const docs = spyOn(refundAdminApi, 'listDocs').mockResolvedValue(documents)
  const status = spyOn(refundAdminApi, 'updateStatus').mockResolvedValue({ ...refund, status: 'submitted' })
  spies.push(get, docs, status)
  await submitIngresoRow({ ...row, refund })
  expect(status).toHaveBeenCalledWith('bulk-request', {
    status: 'docs_received', force: true,
    note: 'Proceso masivo de cambio de estado — Envío de Datos al Banco desde CSV. Ejecutado por: Usuario Ejecutor (ejecutor@example.cl; ID: executor-1).',
  })
})