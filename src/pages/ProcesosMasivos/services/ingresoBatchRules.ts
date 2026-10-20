import Papa from 'papaparse'
import type { RefundDocument, RefundRequest } from '@/types/refund'

export interface IngresoCsvRow { lineNumber: number; refundId: string }

export function ingresoBlockers(refund: RefundRequest, documents: RefundDocument[]): string[] {
  const reasons: string[] = []
  if (refund.status !== 'docs_pending') reasons.push('Solo admite Documentos pendientes.')
  const required = [
    { kinds: ['cedula-frente'], label: 'Cédula frontal' },
    { kinds: ['cedula-trasera'], label: 'Cédula trasera' },
    { kinds: ['signed-mandate'], label: 'Mandato firmado' },
    { kinds: ['carta-de-corte', 'carta-de-corte-cesantia', 'carta-de-corte-desgravamen'], label: 'Carta de corte' },
  ]
  for (const requirement of required) {
    if (!documents.some(doc => requirement.kinds.includes(doc.kind))) reasons.push(`Falta ${requirement.label}.`)
  }
  const snapshot = refund.calculationSnapshot || {}
  if (!String(snapshot.nroPoliza ?? '').trim()) reasons.push('Falta Nº de póliza.')
  if (!String(snapshot.nroCredito ?? '').trim()) reasons.push('Falta Nº de crédito.')
  const insurance = String(snapshot.tipoSeguro || snapshot.insuranceToEvaluate || '').toLowerCase()
  if (!insurance) reasons.push('Falta el tipo de seguro.')
  if (/cesant|ambos|both/.test(insurance)) {
    const cuota = Number(refund.cuotaActual ?? snapshot.cuotaActual ?? snapshot.valorCuota)
    if (!Number.isFinite(cuota) || cuota <= 0) reasons.push('Falta valor cuota del crédito.')
  }
  return reasons
}

export function parseIngresoCsv(text: string): IngresoCsvRow[] {
  const parsed = Papa.parse<string[]>(text.replace(/^\uFEFF/, ''), { skipEmptyLines: 'greedy' })
  if (parsed.errors.length) throw new Error('El CSV contiene errores de formato: ' + parsed.errors[0].message)
  const [header, ...data] = parsed.data
  if (!header) throw new Error('El archivo está vacío.')
  const column = header.findIndex(value => ['id', 'idsolicitud', 'refundid', 'publicid'].includes(value.normalize('NFD').replace(/[\u0300-\u036f\s_]/g, '').toLowerCase()))
  if (column < 0) throw new Error('Falta la columna ID Solicitud.')
  if (!data.length) throw new Error('El archivo no contiene solicitudes.')
  return data.map((row, index) => ({ lineNumber: index + 2, refundId: row[column]?.trim() || '' }))
}

export async function runSequential<T>(items: T[], process: (item: T) => Promise<boolean>, onStop: (remaining: T[]) => void) {
  for (let index = 0; index < items.length; index++) {
    const proceed = await process(items[index])
    if (!proceed) { onStop(items.slice(index + 1)); return }
  }
}