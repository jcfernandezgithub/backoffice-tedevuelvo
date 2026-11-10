import { expect, test } from 'bun:test'
import { canManageFinancialContacts, financialContactSchema, pageAfterContactDeletion } from '../src/lib/financialInstitutionContacts'
import { FinancialContactError, readContactResponse } from '../src/services/financialInstitutionContactsApi'

test('solo roles explícitos ADMIN permiten el directorio, no rol ni pages', () => {
  expect(canManageFinancialContacts({ roles: ['ADMIN'] })).toBe(true)
  for (const roles of [[], ['OPERADOR'], ['ALIANZAS'], ['CALLCENTER'], ['admin']]) {
    expect(canManageFinancialContacts({ roles })).toBe(false)
  }
  expect(canManageFinancialContacts(null)).toBe(false)
  expect(canManageFinancialContacts({})).toBe(false)
  expect(canManageFinancialContacts({ roles: ['ADMIN'], email: 'admin@callcenter.cl' })).toBe(false)
})
test('nombre obligatorio hasta 160 caracteres con normalización Unicode y espacios', () => {
  expect(financialContactSchema.parse({ name: '  Banco   Ａ  ', email: 'test@example.cl' }).name).toBe('Banco A')
  expect(financialContactSchema.safeParse({ name: ' ', email: 'test@example.cl' }).success).toBe(false)
  expect(financialContactSchema.safeParse({ name: 'a'.repeat(160), email: 'test@example.cl' }).success).toBe(true)
  expect(financialContactSchema.safeParse({ name: 'a'.repeat(161), email: 'test@example.cl' }).success).toBe(false)
})
test('solo un correo válido, máximo 254 caracteres y sin campos adicionales', () => {
  expect(financialContactSchema.parse({ name: 'Banco', email: ' test@example.cl ' }).email).toBe('test@example.cl')
  for (const email of [null, '', 'test', 'a@example.cl,b@example.cl', `${'a'.repeat(245)}@example.cl`]) {
    expect(financialContactSchema.safeParse({ name: 'Banco', email }).success).toBe(false)
  }
  expect(financialContactSchema.safeParse({ name: 'Banco', email: 'test@example.cl', id: 'extra' }).success).toBe(false)
})
test('eliminar último registro retrocede solo en páginas posteriores a la primera', () => {
  expect(pageAfterContactDeletion(3, 1)).toBe(2)
  expect(pageAfterContactDeletion(1, 1)).toBe(1)
  expect(pageAfterContactDeletion(3, 2)).toBe(3)
})
test('DELETE 204 no intenta leer JSON', async () => {
  const response = new Response(null, { status: 204 })
  response.json = async () => { throw new Error('No hay cuerpo') }
  expect(await readContactResponse(response)).toBeUndefined()
})
test('conflicto 409 conserva código HTTP aunque cambie el mensaje', async () => {
  try {
    await readContactResponse(Response.json({ message: ['duplicate'] }, { status: 409 }))
    throw new Error('Debió rechazar')
  } catch (error) {
    expect(error).toBeInstanceOf(FinancialContactError)
    expect((error as FinancialContactError).status).toBe(409)
  }
})
test('validación 400 admite message como arreglo', async () => {
  await expect(readContactResponse(Response.json({ message: ['email invalid', 'name invalid'] }, { status: 400 })))
    .rejects.toThrow('email invalid, name invalid')
})