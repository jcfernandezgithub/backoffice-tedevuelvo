/**
 * Cálculo de "Nueva prima total" alineado con la vista de Detalle de la
 * solicitud (fuente de verdad).
 *
 * Reglas (idénticas a src/pages/Refunds/Detail.tsx):
 *  - Cesantía: prima única = saldo insoluto CONFIRMADO × tasa cesantía (0,94‰)
 *    × cuotas restantes confirmadas.
 *  - Desgravamen / Ambos: nueva prima mensual derivada en vivo desde los datos
 *    confirmados (`derivePremiumsFromSnapshot`) × cuotas restantes confirmadas.
 *
 * Motivo: `calculationSnapshot.newMonthlyPremium` puede quedar stale (calculado
 * con el saldo simulado en vez del confirmado), lo que produce diferencias al
 * multiplicarlo por las cuotas restantes.
 */
import { derivePremiumsFromSnapshot } from '@/lib/snapshotPremiums'

/** Tasa única Southbridge para cesantía, expresada en % (0,094% = 0,94‰). */
const TASA_CESANTIA_PCT = 0.094

export function isCesantiaSnapshot(snapshot: any): boolean {
  const tipo = String(
    snapshot?.insuranceToEvaluate ?? snapshot?.insuranceType ?? snapshot?.tipoSeguro ?? '',
  ).toLowerCase()
  if (!tipo) return false
  const mixed =
    tipo.includes('ambos') ||
    tipo.includes('both') ||
    (tipo.includes('desgrav') && tipo.includes('cesant'))
  return !mixed && tipo.includes('cesant')
}

export interface PrimaTotalResult {
  /** Prima mensual usada (0 en cesantía pura: la prima es única). */
  monthlyPremium: number
  /** Cuotas restantes confirmadas consideradas. */
  installments: number
  /** Prima total (única para cesantía, mensual × cuotas para desgravamen). */
  primaTotal: number
  isCesantia: boolean
}

export function resolvePrimaTotal(snapshot: any, institutionId?: string): PrimaTotalResult {
  const snap = snapshot ?? {}
  const installments = Number(
    snap.confirmedRemainingInstallments ?? snap.remainingInstallments ?? 0,
  )
  const isCesantia = isCesantiaSnapshot(snap)

  if (isCesantia) {
    const saldo = Number(
      snap.confirmedAverageInsuredBalance || snap.averageInsuredBalance || snap.totalAmount || 0,
    )
    const primaTotal = Math.round(saldo * (TASA_CESANTIA_PCT / 100) * installments)
    return { monthlyPremium: 0, installments, primaTotal, isCesantia: true }
  }

  const derived = derivePremiumsFromSnapshot({ ...snap, institutionId: institutionId ?? snap.institutionId }, institutionId)
  const monthlyPremium = derived.newMonthlyPremium || Number(snap.newMonthlyPremium ?? 0)
  return {
    monthlyPremium,
    installments,
    primaTotal: Math.max(0, Math.round(monthlyPremium * installments)),
    isCesantia: false,
  }
}
