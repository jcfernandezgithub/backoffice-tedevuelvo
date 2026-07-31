import { getBankCesantiaRates, getTdvCesantiaRates } from '@/services/ratesService'
import { resolveInstitutionKey } from '@/lib/calculadoraUtils'

/** Maps institutionId (lowercase) to cesantía JSON key */
const INSTITUTION_MAP: Record<string, string> = {
  santander: 'BANCO SANTANDER',
  bci: 'BANCO BCI',
  scotiabank: 'SCOTIABANK',
  chile: 'BANCO CHILE',
  security: 'BANCO SECURITY',
  'itau-corpbanca': 'BANCO ITAU-CORPBANCA',
  itau: 'BANCO ITAÚ',
  bice: 'BANCO BICE',
  estado: 'BANCO ESTADO',
  ripley: 'BANCO RIPLEY',
  falabella: 'BANCO FALABELLA',
  consorcio: 'BANCO CONSORCIO',
  coopeuch: 'COOPEUCH',
  cencosud: 'BANCO CENCOSUD',
  internacional: 'BANCO INTERNACIONAL',
  'lider-bci': 'LIDER-BCI',
  forum: 'FORUM',
  tanner: 'TANNER',
  cooperativas: 'COOPERATIVAS',
  'chevrolet-sf': 'CHEVROLET SF',
  'chevrolet sf': 'CHEVROLET SF',
  marubeni: 'MARUBENI',
  'santander-consumer': 'SANTANDER CONSUMER',
  'santander consumer': 'SANTANDER CONSUMER',
}

function getTramo(monto: number): string {
  if (monto <= 1000000) return 'tramo_1'
  if (monto <= 3000000) return 'tramo_2'
  if (monto <= 5000000) return 'tramo_3'
  if (monto <= 7000000) return 'tramo_4'
  return 'tramo_5'
}

/**
 * Obtiene la tasa mensual de un set de tramos tolerando variaciones de nombre
 * ("tramo_1", "Tramo 1", "TRAMO1", ...). Si no hay coincidencia por nombre,
 * busca el tramo cuyo rango [desde, hasta] contenga el monto y, como último
 * recurso, usa el último tramo disponible.
 */
function getTasaMensual(ranges: any, monto: number): number {
  if (!ranges || typeof ranges !== 'object') return 0
  const wanted = getTramo(monto)
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')
  const entries = Object.entries<any>(ranges)

  const byName = entries.find(([k]) => norm(k) === norm(wanted))
  if (byName && Number(byName[1]?.tasa_mensual)) return Number(byName[1].tasa_mensual)

  const byRange = entries.find(([, v]) => {
    const desde = Number(v?.desde ?? 0)
    const hasta = v?.hasta === null || v?.hasta === undefined ? Infinity : Number(v.hasta)
    return monto >= desde && monto <= hasta
  })
  if (byRange && Number(byRange[1]?.tasa_mensual)) return Number(byRange[1].tasa_mensual)

  const last = entries[entries.length - 1]
  return Number(last?.[1]?.tasa_mensual) || 0
}

export interface BreakdownResult {
  desgravamen: {
    primaBanco: number
    primaTDV: number
    primaTotalBanco: number
    primaTotalTDV: number
    devolucion: number
    devolucionConMargen: number
  }
  cesantia: {
    primaBanco: number
    primaTDV: number
    primaTotalBanco: number
    primaTotalTDV: number
    devolucion: number
    devolucionConMargen: number
  }
  totalDevolucion: number
  totalConMargen: number
  margen: number
}

export function computeBreakdown(snapshot: any): BreakdownResult | null {
  if (!snapshot) return null

  const tipo = (snapshot.insuranceToEvaluate || snapshot.tipoSeguro || '').toLowerCase()
  if (tipo !== 'ambos') return null

  const {
    currentMonthlyPremium,
    newMonthlyPremium,
    totalSaving,
    institutionId,
  } = snapshot

  // Prefer confirmed values when present, fallback to simulated.
  const totalAmount = snapshot.confirmedTotalAmount || snapshot.totalAmount
  const remainingInstallments =
    snapshot.confirmedRemainingInstallments || snapshot.remainingInstallments

  if (!totalAmount || !remainingInstallments) return null

  // La cesantía se calcula sobre el SALDO INSOLUTO (averageInsuredBalance),
  // igual que en la calculadora y el certificado. Si no está disponible,
  // caemos a totalAmount para evitar romper snapshots antiguos.
  const saldoInsoluto =
    snapshot.confirmedAverageInsuredBalance ||
    snapshot.averageInsuredBalance ||
    totalAmount

  // --- Desgravamen (from snapshot) ---
  const desgPrimaBanco = currentMonthlyPremium || 0
  const desgPrimaTDV = newMonthlyPremium || 0
  const desgDevolucion = (desgPrimaBanco - desgPrimaTDV) * remainingInstallments

  // --- Cesantía (on-the-fly) ---
  const rawInstitution =
    institutionId ||
    snapshot.institution ||
    snapshot.institutionName ||
    snapshot.banco ||
    snapshot.bankName ||
    snapshot.entidad ||
    snapshot.confirmedInstitution ||
    ''
  const bankRates = getBankCesantiaRates()
  const mapped = INSTITUTION_MAP[String(rawInstitution).toLowerCase()]
  const bankKey =
    (mapped && bankRates[mapped] ? mapped : null) ||
    resolveInstitutionKey(String(rawInstitution), Object.keys(bankRates)) ||
    String(rawInstitution).toUpperCase()

  let cesantiaTasaBanco = 0
  let cesantiaTasaTDV = 0

  const bankData = bankRates[bankKey]
  if (!bankData) {
    console.warn('[breakdown] Sin tasas de cesantía para institución:', rawInstitution)
  }
  cesantiaTasaBanco = getTasaMensual(bankData, saldoInsoluto)

  const tdvData = getTdvCesantiaRates().TE_DEVUELVO_CESANTIA ?? {}
  cesantiaTasaTDV = getTasaMensual(tdvData, saldoInsoluto)

  const cesantiaPrimaBanco = Math.round(saldoInsoluto * cesantiaTasaBanco)
  const cesantiaPrimaTDV = Math.round(saldoInsoluto * cesantiaTasaTDV)
  const cesantiaDevolucion = (cesantiaPrimaBanco - cesantiaPrimaTDV) * remainingInstallments

  const totalDevolucion = desgDevolucion + cesantiaDevolucion

  // Derive margin from totalSaving if available
  let margen = 10
  if (totalSaving && totalDevolucion > 0) {
    margen = Math.round((1 - totalSaving / totalDevolucion) * 100)
    if (margen < 0) margen = 0
  }

  const totalConMargen = Math.round(totalDevolucion * (1 - margen / 100))
  const factor = 1 - margen / 100

  return {
    desgravamen: {
      primaBanco: desgPrimaBanco,
      primaTDV: desgPrimaTDV,
      primaTotalBanco: desgPrimaBanco * remainingInstallments,
      primaTotalTDV: desgPrimaTDV * remainingInstallments,
      devolucion: Math.max(0, Math.round(desgDevolucion)),
      devolucionConMargen: Math.max(0, Math.round(desgDevolucion * factor)),
    },
    cesantia: {
      primaBanco: cesantiaPrimaBanco,
      primaTDV: cesantiaPrimaTDV,
      primaTotalBanco: cesantiaPrimaBanco * remainingInstallments,
      primaTotalTDV: cesantiaPrimaTDV * remainingInstallments,
      devolucion: Math.max(0, Math.round(cesantiaDevolucion)),
      devolucionConMargen: Math.max(0, Math.round(cesantiaDevolucion * factor)),
    },
    totalDevolucion: Math.round(totalDevolucion),
    totalConMargen,
    margen,
  }
}

/**
 * Calcula la prima TOTAL de cesantía TDV (saldo × tasa × cuotas restantes)
 * para solicitudes de CESANTÍA PURA (nuevo flujo donde cada seguro es una
 * solicitud independiente). Retorna null si el snapshot no es cesantía pura
 * o si faltan datos.
 *
 * Usa la misma fórmula que el certificado de cobertura de cesantía, evitando
 * que la UI muestre `newMonthlyPremium × cuotas` (fórmula de desgravamen que
 * produce valores erróneos para snapshots antiguos donde ese campo quedó con
 * un residual).
 */
export function computePureCesantiaTotalTDV(snapshot: any): number | null {
  if (!snapshot) return null
  const ins = (snapshot.insuranceToEvaluate || snapshot.tipoSeguro || '').toLowerCase()
  const isMixed =
    ins.includes('ambos') ||
    ins.includes('both') ||
    (ins.includes('desgrav') && ins.includes('cesant'))
  const isPureCesantia = (ins === 'cesantia' || ins === 'cesantía' || ins.includes('cesant')) && !isMixed
  if (!isPureCesantia) return null

  // El certificado de cesantía usa el SALDO INSOLUTO (averageInsuredBalance),
  // no el monto total del crédito. Replicamos la misma prioridad.
  const saldoInsoluto =
    snapshot.confirmedAverageInsuredBalance ||
    snapshot.averageInsuredBalance ||
    snapshot.confirmedTotalAmount ||
    snapshot.totalAmount
  const remainingInstallments =
    snapshot.confirmedRemainingInstallments || snapshot.remainingInstallments
  if (!saldoInsoluto || !remainingInstallments) return null

  const tdvData = getTdvCesantiaRates().TE_DEVUELVO_CESANTIA ?? {}
  const tasaTDV = getTasaMensual(tdvData, saldoInsoluto)
  if (!tasaTDV) return null

  return Math.round(saldoInsoluto * tasaTDV * remainingInstallments)
}
