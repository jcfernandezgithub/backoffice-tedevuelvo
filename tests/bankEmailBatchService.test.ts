import { afterEach, expect, spyOn, test } from 'bun:test'
import { refundAdminApi } from '../src/services/refundAdminApi'
import { bankEmailEligibility, bankEmailPayload, runBankEmailBatch } from '../src/pages/ProcesosMasivos/services/bankEmailBatchService'
import type { BankEmailResult } from '../src/pages/ProcesosMasivos/services/bankEmailBatchService'
import type { RefundRequest } from '../src/types/refund'

const row = { id: 'one', publicId: 'public-one', fullName: 'Cliente', email: 'cliente@example.cl', status: 'payment_scheduled', realAmount: 123000 } as RefundRequest & { realAmount: number }
const spies: { mockRestore: () => void }[] = []
afterEach(() => spies.splice(0).forEach(spy => spy.mockRestore()))

test('solo Pago programado es elegible para el envío', () => {
  expect(bankEmailEligibility(row)).toBeNull()
  expect(bankEmailEligibility({ ...row, status: 'paid' })).not.toBeNull()
})
test('payload conserva los datos del servicio individual', () => {
  expect(bankEmailPayload(row)).toEqual({ nombre_cliente: 'Cliente', email: 'cliente@example.cl', idSolicitud: 'public-one', monto_aprobado: 123000, estado: 'payment_scheduled', linkAccion: 'https://www.tedevuelvo.cl/login' })
})
test('omite solicitudes que ya no están en Pago programado al ejecutar', async () => {
  const get = spyOn(refundAdminApi, 'getById').mockResolvedValue({ ...row, status: 'paid' })
  const send = spyOn(refundAdminApi, 'resendScheduledPaymentEmail')
  spies.push(get, send)
  const results: BankEmailResult[] = []
  await runBankEmailBatch([row], result => results.push(result), () => false, async () => {})
  expect(send).not.toHaveBeenCalled()
  expect(results[0].status).toBe('skipped')
})
test('envía secuencialmente, sin duplicados ni cambios de estado', async () => {
  const second = { ...row, id: 'two', publicId: 'public-two' }
  const events: string[] = []
  const get = spyOn(refundAdminApi, 'getById').mockImplementation(async id => { events.push(`read:${id}`); return { ...row, id, realAmount: 456000 } })
  const send = spyOn(refundAdminApi, 'resendScheduledPaymentEmail').mockImplementation(async id => { events.push(`send:${id}`); await Promise.resolve(); events.push(`done:${id}`); return { ok: true, data: null } })
  const status = spyOn(refundAdminApi, 'updateStatus')
  spies.push(get, send, status)
  await runBankEmailBatch([row, row, second], () => {}, () => false, async () => {})
  expect(events).toEqual(['read:public-one', 'send:public-one', 'done:public-one', 'read:public-two', 'send:public-two', 'done:public-two'])
  expect(send.mock.calls[0][1].monto_aprobado).toBe(456000)
  expect(status).not.toHaveBeenCalled()
})
test('un error detiene el lote sin reintentar el correo', async () => {
  const get = spyOn(refundAdminApi, 'getById').mockResolvedValue(row)
  const send = spyOn(refundAdminApi, 'resendScheduledPaymentEmail').mockRejectedValue(new Error('n8n 500'))
  spies.push(get, send)
  const results: BankEmailResult[] = []
  await runBankEmailBatch([row, { ...row, id: 'two' }], result => results.push(result), () => false, async () => {})
  expect(send).toHaveBeenCalledTimes(1)
  expect(get).toHaveBeenCalledTimes(1)
  expect(results[0].status).toBe('error')
})
test('detener después del actual conserva las restantes sin enviar', async () => {
  const get = spyOn(refundAdminApi, 'getById').mockResolvedValue(row)
  const send = spyOn(refundAdminApi, 'resendScheduledPaymentEmail').mockResolvedValue({ ok: true, data: null })
  spies.push(get, send)
  let stop = false
  await runBankEmailBatch([row, { ...row, id: 'two' }], () => { stop = true }, () => stop, async () => {})
  expect(send).toHaveBeenCalledTimes(1)
})
test('no envía montos inválidos ni correos vacíos', () => {
  expect(() => bankEmailPayload({ ...row, realAmount: 0 } as RefundRequest)).toThrow('Monto aprobado')
  expect(() => bankEmailPayload({ ...row, email: '' })).toThrow('Correo')
})
test('ya procesada es advertencia y continúa con la siguiente sin reenviar', async () => {
  const get = spyOn(refundAdminApi, 'getById').mockResolvedValue(row)
  const send = spyOn(refundAdminApi, 'resendScheduledPaymentEmail').mockRejectedValueOnce(new Error('Solicitud ya fue procesada')).mockResolvedValueOnce({ ok: true, data: null })
  spies.push(get, send)
  const results: BankEmailResult[] = []
  await runBankEmailBatch([row, { ...row, id: 'two', publicId: 'public-two' }], result => results.push(result), () => false, async () => {})
  expect(results.map(result => result.status)).toEqual(['skipped', 'success'])
  expect(send).toHaveBeenCalledTimes(2)
  expect(get.mock.calls[0][0]).toBe('public-one')
})
test('error de consulta no se marca como envío intentado', async () => {
  const get = spyOn(refundAdminApi, 'getById').mockRejectedValue(new Error('Solicitud no encontrada'))
  const send = spyOn(refundAdminApi, 'resendScheduledPaymentEmail')
  spies.push(get, send)
  const results: BankEmailResult[] = []
  await runBankEmailBatch([row], result => results.push(result), () => false)
  expect(results[0].attempted).toBe(false)
  expect(send).not.toHaveBeenCalled()
})
test('solicitud procesada en la sesión se omite y no bloquea otras', async () => {
  const get = spyOn(refundAdminApi, 'getById').mockResolvedValue(row)
  const send = spyOn(refundAdminApi, 'resendScheduledPaymentEmail').mockResolvedValue({ ok: true, data: null })
  spies.push(get, send)
  const results: BankEmailResult[] = []
  await runBankEmailBatch([row, { ...row, id: 'two', publicId: 'public-two' }], result => results.push(result), () => false, async () => {}, new Set(['one']))
  expect(results.map(result => result.status)).toEqual(['skipped', 'success'])
  expect(get).toHaveBeenCalledTimes(1)
  expect(send).toHaveBeenCalledTimes(1)
})