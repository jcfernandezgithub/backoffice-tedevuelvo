// Helpers de comparación de períodos del Dashboard.
// El backend ya recibe from/to, así que la desviación se calcula en el front
// consultando dos veces los mismos servicios (período actual y comparación).

export type DeltaTone = 'up' | 'down' | 'flat'
export interface DeltaInfo { previousText: string; deltaLabel: string; tone: DeltaTone }

const toLocalDateString = (date: Date): string => {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

const fmtCLP = (v: number) =>
  v.toLocaleString('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 })

const fmtPct = (v: number) =>
  Math.abs(v).toLocaleString('es-CL', { maximumFractionDigits: 1, minimumFractionDigits: 1 })

const toneFor = (delta: number): DeltaTone => (delta > 0.05 ? 'up' : delta < -0.05 ? 'down' : 'flat')
const arrowFor = (tone: DeltaTone) => (tone === 'up' ? '▲' : tone === 'down' ? '▼' : '')

/** Período inmediatamente anterior, de la misma duración (en días calendario locales). */
export function previousRange(from: string, to: string): { from: string; to: string } | null {
  if (!from || !to) return null
  const [fy, fm, fd] = from.split('-').map(Number)
  const [ty, tm, td] = to.split('-').map(Number)
  const start = new Date(fy, fm - 1, fd)
  const end = new Date(ty, tm - 1, td)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return null
  const lengthDays = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1
  const prevEnd = new Date(fy, fm - 1, fd - 1)
  const prevStart = new Date(prevEnd.getFullYear(), prevEnd.getMonth(), prevEnd.getDate() - (lengthDays - 1))
  return { from: toLocalDateString(prevStart), to: toLocalDateString(prevEnd) }
}

/** Formato dd/mm/aaaa para etiquetas de rango. */
export function formatDayMonthYear(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

export function formatRange(from: string, to: string): string {
  return from === to ? formatDayMonthYear(from) : `${formatDayMonthYear(from)} – ${formatDayMonthYear(to)}`
}

/** Desviación de un conteo: texto del valor anterior + etiqueta con variación. */
export function countDelta(current: number, previous: number): DeltaInfo {
  const previousText = previous.toLocaleString('es-CL')
  if (previous === 0 && current === 0) return { previousText, deltaLabel: '0,0%', tone: 'flat' }
  if (previous === 0) return { previousText, deltaLabel: 'nuevo', tone: 'up' }
  const pct = ((current - previous) / previous) * 100
  const tone = toneFor(pct)
  return { previousText, deltaLabel: tone === 'flat' ? `${fmtPct(pct)}%` : `${arrowFor(tone)} ${fmtPct(pct)}%`, tone }
}

/** Desviación de un monto en CLP. */
export function moneyDelta(current: number, previous: number): DeltaInfo {
  const base = countDelta(current, previous)
  return { ...base, previousText: fmtCLP(previous) }
}

/** Desviación de una tasa en puntos porcentuales (pp). */
export function rateDelta(current: number, previous: number): DeltaInfo {
  const previousText = `${previous.toLocaleString('es-CL', { maximumFractionDigits: 1 })}%`
  const diff = current - previous
  const tone = toneFor(diff)
  return {
    previousText,
    deltaLabel: tone === 'flat' ? `${fmtPct(diff)} pp` : `${arrowFor(tone)} ${fmtPct(diff)} pp`,
    tone,
  }
}

export function deltaToneClass(tone: DeltaTone): string {
  if (tone === 'up') return 'text-emerald-600 dark:text-emerald-400'
  if (tone === 'down') return 'text-red-600 dark:text-red-400'
  return 'text-muted-foreground'
}

/** Alinea la serie del período de comparación con la actual por posición (misma granularidad). */
export function mergeCountSeries(
  current: { bucket: string; value: number }[],
  comparison: { bucket: string; value: number }[],
): { bucket: string; value: number; compareValue: number | null }[] {
  return current.map((point, i) => ({ ...point, compareValue: comparison[i]?.value ?? null }))
}

export function mergePaymentSeries(
  current: { bucket: string; monto: number }[],
  comparison: { bucket: string; monto: number }[],
): { bucket: string; monto: number; compareMonto: number | null }[] {
  return current.map((point, i) => ({ ...point, compareMonto: comparison[i]?.monto ?? null }))
}
