import Papa from 'papaparse'

export interface IngresoCsvRow { lineNumber: number; refundId: string }

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