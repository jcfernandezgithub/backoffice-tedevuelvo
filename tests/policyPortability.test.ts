import { expect, test } from 'bun:test'
import { assertPortablePolicy, isNonPortablePolicy } from '../src/lib/policyPortability'

test('bloquea la póliza mensualizada Cardiff 226071739 incluso con espacios exteriores', () => {
  expect(isNonPortablePolicy('226071739')).toBe(true)
  expect(isNonPortablePolicy(' 226071739 ')).toBe(true)
  expect(isNonPortablePolicy(226071739)).toBe(true)
  expect(() => assertPortablePolicy('226071739')).toThrow()
})

test('no bloquea otras pólizas ni modifica la regla de campos opcionales', () => {
  for (const value of ['226071738', '2260717390', '', undefined, null]) {
    expect(isNonPortablePolicy(value)).toBe(false)
    expect(() => assertPortablePolicy(value)).not.toThrow()
  }
})