import { describe, expect, test } from 'bun:test'
import { ingresoBlockers, ingresoStatusLabel, parseIngresoCsv, runSequential } from '../src/pages/ProcesosMasivos/services/ingresoBatchRules'
import type { RefundDocument, RefundRequest } from '@/types/refund'

const refund = { status: 'docs_pending', calculationSnapshot: { nroPoliza: 'P1', nroCredito: 'C1', tipoSeguro: 'cesantia' }, cuotaActual: 120000 } as RefundRequest
const docs = ['cedula-frente', 'cedula-trasera', 'signed-mandate', 'carta-de-corte-cesantia'].map(kind => ({ kind }) as RefundDocument)
describe('Ingreso bancario masivo', () => {
  test('acepta Documentos pendientes e Ingresado como estado origen', () => {
    expect(ingresoBlockers(refund, docs)).toEqual([])
    expect(ingresoBlockers({ ...refund, status: 'submitted' }, docs)).toEqual([])
    expect(ingresoBlockers({ ...refund, status: 'paid' }, docs)).toContain('Solo admite Documentos pendientes o Ingresado.')
  })
  test('muestra los estados con glosa en español', () => {
    expect(ingresoStatusLabel('docs_pending')).toBe('Documentos pendientes')
    expect(ingresoStatusLabel('docs_received')).toBe('Documentos recibidos')
    expect(ingresoStatusLabel('submitted')).toBe('Ingresado')
    expect(ingresoStatusLabel('paid')).toBe('paid')
  })
  test('requiere todos los documentos del cambio individual', () => {
    for (const doc of docs) expect(ingresoBlockers(refund, docs.filter(item => item !== doc)).length).toBe(1)
  })
  test('requiere póliza y crédito previamente registrados', () => {
    expect(ingresoBlockers({ ...refund, calculationSnapshot: { tipoSeguro: 'cesantia' } }, docs)).toEqual(['Falta Nº de póliza.', 'Falta Nº de crédito.'])
  })
  test('cesantía requiere valor cuota positivo', () => {
    expect(ingresoBlockers({ ...refund, cuotaActual: 0 }, docs)).toContain('Falta valor cuota del crédito.')
  })
  test('interpreta CSV con ID sin exigir datos de nómina', () => {
    expect(parseIngresoCsv('ID Solicitud;Nombre\nabc;Cliente')).toEqual([{ lineNumber: 2, refundId: 'abc' }])
    expect(parseIngresoCsv('ID Solicitud\nabc\ndef')).toEqual([{ lineNumber: 2, refundId: 'abc' }, { lineNumber: 3, refundId: 'def' }])
  })
  test('espera cada llamada de estado antes de continuar', async () => {
    let active = 0; let peak = 0; const done: number[] = []
    await runSequential([1, 2, 3], async item => {
      active++; peak = Math.max(peak, active)
      await new Promise(resolve => setTimeout(resolve, 5))
      active--; done.push(item); return true
    }, () => {})
    expect(peak).toBe(1); expect(done).toEqual([1, 2, 3])
  })
  test('detiene la cola ante un resultado incierto sin reintentar', async () => {
    const calls: number[] = []; let remaining: number[] = []
    await runSequential([1, 2, 3], async item => { calls.push(item); return false }, items => { remaining = items })
    expect(calls).toEqual([1]); expect(remaining).toEqual([2, 3])
  })
})