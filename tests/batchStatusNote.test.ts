import { afterEach, expect, spyOn, test } from 'bun:test'
import { authService } from '../src/services/authService'
import { refundAdminApi } from '../src/services/refundAdminApi'
import { batchStatusNote } from '../src/pages/ProcesosMasivos/services/batchStatusNote'
import { markRowAsPaid, type ResolvedRow } from '../src/pages/ProcesosMasivos/services/pagosBatchService'
import type { RefundRequest } from '../src/types/refund'

const spies: { mockRestore: () => void }[] = []
afterEach(() => { spies.splice(0).forEach(spy => spy.mockRestore()) })

test('registra proceso masivo y ejecutor también en el cambio a pagada', async () => {
  spies.push(spyOn(authService, 'getCurrent').mockReturnValue({
    id: 'operator-2', nombre: 'Operador Actual', email: 'operador@example.cl', rol: 'OPERACIONES', activo: true,
  }))
  const status = spyOn(refundAdminApi, 'updateStatus').mockResolvedValue({ status: 'paid' } as RefundRequest)
  spies.push(status)
  const row: ResolvedRow = {
    lineNumber: 2, refundId: 'payment-id', fullName: 'Cliente', rut: '1-9', institucion: 'Banco', monto: 12000,
    rowStatus: 'ready', reason: '',
  }
  const result = await markRowAsPaid(row)
  expect(result.status).toBe('success')
  expect(status).toHaveBeenCalledWith('payment-id', {
    status: 'paid', force: true, realAmount: 12000,
    note: 'Proceso masivo de cambio de estado — Pago de devoluciones desde CSV. Ejecutado por: Operador Actual (operador@example.cl; ID: operator-2).',
  })
})

test('no genera observaciones sin un ejecutor identificado', () => {
  spies.push(spyOn(authService, 'getCurrent').mockReturnValue(null))
  expect(() => batchStatusNote('Envío de Datos al Banco desde CSV')).toThrow('No se pudo identificar al usuario ejecutor')
})