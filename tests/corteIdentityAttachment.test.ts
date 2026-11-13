import { expect, test } from 'bun:test'
import { corteCedulaImg } from '../src/lib/corteIdentityAttachment'
import asset from '../src/assets/corte-cedula-legalizada-2026-11.jpg.asset.json'

test('external production resolves the shared identity image through its serving origin', () => {
  const url = new URL(corteCedulaImg, 'https://backoffice.info-tedevuelvo.cl')
  expect(url.origin).toBe('https://backoffice-te-devuelvo.lovable.app')
  expect(url.pathname).toBe(asset.url)
})