import { afterEach, expect, spyOn, test } from 'bun:test'
import { refundAdminApi } from '../src/services/refundAdminApi'
import { loadAllBankEmailRecipients } from '../src/pages/ProcesosMasivos/services/bankEmailSelection'
import type { RefundRequest } from '../src/types/refund'

const row = { id: 'one', publicId: 'public-one', fullName: 'Cliente', email: 'cliente@example.cl', status: 'payment_scheduled', realAmount: 123000 } as RefundRequest
afterEach(() => mock?.mockRestore())
let mock: ReturnType<typeof spyOn<typeof refundAdminApi, 'search'>> | undefined

test('seleccionar todos incluye todas las páginas del filtro, sin duplicados ni filas no elegibles', async () => {
  mock = spyOn(refundAdminApi, 'search').mockResolvedValueOnce({ items: [row], total: 4, page: 1, pageSize: 25, hasNext: true }).mockResolvedValueOnce({ items: [row, { ...row, id: 'two' }, { ...row, id: 'invalid', email: '' }], total: 4, page: 2, pageSize: 25, hasNext: false })
  const signal = new AbortController().signal
  const selected = await loadAllBankEmailRecipients('Cliente', signal)
  expect([...selected.keys()]).toEqual(['one', 'two'])
  expect(mock.mock.calls.map(call => call[0])).toEqual([1, 2].map(page => ({ status: 'payment_scheduled', page, limit: 25, q: 'Cliente' })))
})

test('un fallo de página no devuelve una selección incompleta', async () => {
  mock = spyOn(refundAdminApi, 'search').mockResolvedValueOnce({ items: [row], total: 2, page: 1, pageSize: 25, hasNext: true }).mockRejectedValueOnce(new Error('Sin conexión'))
  await expect(loadAllBankEmailRecipients('', new AbortController().signal)).rejects.toThrow('Sin conexión')
})

test('cancelar la selección impide consultar páginas adicionales', async () => {
  mock = spyOn(refundAdminApi, 'search')
  const controller = new AbortController()
  controller.abort()
  await expect(loadAllBankEmailRecipients('', controller.signal)).rejects.toThrow()
  expect(mock).not.toHaveBeenCalled()
})