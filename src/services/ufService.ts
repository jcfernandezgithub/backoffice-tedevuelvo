/**
 * Valor de la UF desde el servicio público findic.cl.
 * Formato: https://findic.cl/api/uf/DD-MM-YYYY
 * Si el día aún no está publicado (mañana temprano, feriados), se
 * retrocede hasta 4 días para obtener el último valor disponible.
 */
export interface UfLookupResult {
  value: number
  date: string // YYYY-MM-DD del valor efectivamente obtenido
  isFallback: boolean // true si no era el día solicitado
}

function toDdMmYyyy(d: Date) {
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  return `${dd}-${mm}-${d.getFullYear()}`
}

function toIso(d: Date) {
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
}

async function fetchUfForDate(date: Date): Promise<number | null> {
  const res = await fetch(`https://findic.cl/api/uf/${toDdMmYyyy(date)}`)
  if (!res.ok) throw new Error(`findic.cl respondió ${res.status}`)
  const json = await res.json()
  const entry = Array.isArray(json?.serie) ? json.serie[0] : null
  const value = Number(entry?.valor)
  return Number.isFinite(value) && value > 0 ? value : null
}

/**
 * Obtiene el valor de la UF para la fecha indicada (por defecto hoy).
 * Lanza error si el servicio no responde o no hay valores recientes.
 */
export async function getUfValue(referenceDate: Date = new Date()): Promise<UfLookupResult> {
  const target = toIso(referenceDate)
  for (let offset = 0; offset <= 4; offset++) {
    const d = new Date(referenceDate)
    d.setDate(d.getDate() - offset)
    const value = await fetchUfForDate(d)
    if (value != null) {
      const iso = toIso(d)
      return { value, date: iso, isFallback: iso !== target }
    }
  }
  throw new Error('Sin valor de UF publicado en los últimos días')
}

/** Formatea un valor UF al formato chileno (40.848,74). */
export function formatUf(value: number): string {
  return value.toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
