import { expect, test } from 'bun:test'
import { institutionOptions, selectedInstitution, validInstitutionChange } from '../src/lib/institutionSelection'

const catalog = [
  { id: '1', value: 'scotiabank', label: 'Scotiabank', active: true, grupo: '', margen_seguridad: 10 },
  { id: '2', value: 'bci', label: 'BCI', active: false, grupo: '', margen_seguridad: 10 },
]

test('permite solo instituciones activas del catálogo, no texto libre', () => {
  expect(validInstitutionChange('scotiabank', 'otro', catalog, true)).toBe(true)
  expect(validInstitutionChange('banco_inventado', 'otro', catalog, true)).toBe(false)
  expect(validInstitutionChange('bci', 'otro', catalog, true)).toBe(false)
})
test('selección guarda identificadores en minúsculas y reconoce Scotiabank antiguo', () => {
  expect(institutionOptions([{ ...catalog[0], value: 'Scotiabank' }])[0].value).toBe('scotiabank')
  expect(selectedInstitution('Scotiabank', catalog)?.value).toBe('scotiabank')
  expect(validInstitutionChange('Scotiabank', 'otro', catalog, true)).toBe(false)
})
test('un catálogo no disponible bloquea cambios sin alterar datos antiguos', () => {
  expect(validInstitutionChange('scotiabank', 'otro', catalog, false)).toBe(false)
  expect(validInstitutionChange('Banco antiguo', 'Banco antiguo', [], false)).toBe(true)
})