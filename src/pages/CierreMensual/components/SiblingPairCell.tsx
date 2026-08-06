import { useMemo } from 'react'
import { formatCLPNumber } from '@/lib/formatters'

/**
 * TEMPORAL: Mientras convivimos con el flujo viejo (1 solicitud AMBOS) y el
 * nuevo (2 solicitudes independientes Desgravamen + Cesantía), agrupamos
 * visualmente los pares hermanos en el listado para mostrar ambos valores
 * y el total. NO modifica datos ni lógica de negocio.
 */

type Tipo = 'desgravamen' | 'cesantia' | 'ambos' | 'unknown'

function detectTipo(refund: any): Tipo {
  const snap = refund?.calculationSnapshot
  const raw = (snap?.insuranceToEvaluate || snap?.tipoSeguro || '').toString().toUpperCase()
  if (raw.includes('AMBOS') || raw.includes('BOTH')) return 'ambos'
  if (raw.includes('CESANT')) return 'cesantia'
  if (raw.includes('DESGRAV')) return 'desgravamen'
  return 'unknown'
}

export interface SiblingInfo {
  sibling: any
  selfTipo: 'desgravamen' | 'cesantia'
  siblingTipo: 'desgravamen' | 'cesantia'
}

/**
 * Detecta pares hermanos dentro de un set de solicitudes.
 * Clave: rut + institutionId + totalAmount + remainingInstallments,
 * donde una sea DESGRAVAMEN y la otra CESANTIA y haya exactamente 2 candidatos.
 */
export function buildSiblingsMap(refunds: any[]): Map<string, SiblingInfo> {
  const map = new Map<string, SiblingInfo>()
  if (!refunds || refunds.length === 0) return map

  const groups = new Map<string, any[]>()
  for (const r of refunds) {
    const tipo = detectTipo(r)
    if (tipo !== 'desgravamen' && tipo !== 'cesantia') continue
    const snap = r?.calculationSnapshot
    const rut = (r?.rut || '').toString().trim()
    const inst = (r?.institutionId || '').toString().toLowerCase().trim()
    const totalAmount = snap?.totalAmount ?? snap?.creditAmount ?? null
    const cuotas = snap?.remainingInstallments ?? null
    if (!rut || !inst || totalAmount == null || cuotas == null) continue
    const key = `${rut}|${inst}|${totalAmount}|${cuotas}`
    const arr = groups.get(key) || []
    arr.push(r)
    groups.set(key, arr)
  }

  for (const arr of groups.values()) {
    if (arr.length !== 2) continue
    const [a, b] = arr
    const tA = detectTipo(a) as 'desgravamen' | 'cesantia'
    const tB = detectTipo(b) as 'desgravamen' | 'cesantia'
    if (tA === tB) continue // ambos del mismo tipo, no es par válido
    map.set(a.publicId || a.id, { sibling: b, selfTipo: tA, siblingTipo: tB })
    map.set(b.publicId || b.id, { sibling: a, selfTipo: tB, siblingTipo: tA })
  }

  return map
}

const TIPO_COLORS: Record<'desgravamen' | 'cesantia', { dot: string; label: string; abbr: string }> = {
  desgravamen: { dot: 'bg-violet-500', label: 'Desgravamen', abbr: 'D' },
  cesantia: { dot: 'bg-teal-500', label: 'Cesantía', abbr: 'C' },
}

interface PairedAmountCellProps {
  selfValue: number
  siblingValue: number
  selfTipo: 'desgravamen' | 'cesantia'
  siblingTipo: 'desgravamen' | 'cesantia'
  /** Estilo del total (text-* y font-*) */
  totalClassName?: string
  /** Prefijo (ej. '$') */
  prefix?: string
}

export function PairedAmountCell({
  selfValue,
  siblingValue,
  selfTipo,
  siblingTipo,
  totalClassName = 'font-semibold',
  prefix = '$',
}: PairedAmountCellProps) {
  const total = (selfValue || 0) + (siblingValue || 0)
  // Mostramos siempre Desgravamen primero, luego Cesantía, sin importar cuál es "self"
  const desgValue = selfTipo === 'desgravamen' ? selfValue : siblingValue
  const cesValue = selfTipo === 'cesantia' ? selfValue : siblingValue

  const Row = ({ tipo, value }: { tipo: 'desgravamen' | 'cesantia'; value: number }) => {
    const c = TIPO_COLORS[tipo]
    return (
      <div className="flex items-center justify-end gap-1.5 text-xs leading-tight">
        <span className={`inline-block h-1.5 w-1.5 rounded-full ${c.dot}`} aria-hidden />
        <span className="tabular-nums">{prefix}{formatCLPNumber(value || 0)}</span>
        <span className="text-muted-foreground font-medium w-3 text-left">{c.abbr}</span>
      </div>
    )
  }

  return (
    <div
      className="flex flex-col items-end gap-0.5"
      title={`Solicitud agrupada (par Desgravamen + Cesantía)\nDesgravamen: ${prefix}${formatCLPNumber(desgValue || 0)}\nCesantía: ${prefix}${formatCLPNumber(cesValue || 0)}\nTotal: ${prefix}${formatCLPNumber(total)}`}
    >
      <Row tipo="desgravamen" value={desgValue} />
      <Row tipo="cesantia" value={cesValue} />
      <div className={`mt-0.5 pt-0.5 border-t border-border/60 tabular-nums ${totalClassName}`}>
        {prefix}{formatCLPNumber(total)}
      </div>
    </div>
  )
}

/** Hook trivial — useMemo wrapper sobre buildSiblingsMap */
export function useSiblingsMap(refunds: any[]) {
  return useMemo(() => buildSiblingsMap(refunds || []), [refunds])
}