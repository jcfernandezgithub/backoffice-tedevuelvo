import tasasCesantiaBanco from '@/data/tasas_cesantia_banco.json'
import tasasCesantiaTeDevuelvo from '@/data/tasas_cesantia_te_devuelvo.json'

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
  'lider-bci': 'LIDER-BCI',
  forum: 'FORUM',
  tanner: 'TANNER',
  cooperativas: 'COOPERATIVAS',
}

function getTramo(monto: number): string {
  if (monto <= 1000000) return 'tramo_1'
  if (monto <= 3000000) return 'tramo_2'
  if (monto <= 5000000) return 'tramo_3'
  if (monto <= 7000000) return 'tramo_4'
  return 'tramo_5'
}

export interface BreakdownResult {
  desgravamen: {
    primaBanco: number
    primaTDV: number
    primaTotalBanco: number
    primaTotalTDV: number
    devolucion: number
  }
  cesantia: {
    primaBanco: number
    primaTDV: number
    primaTotalBanco: number
    primaTotalTDV: number
    devolucion: number
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
    totalAmount,
    remainingInstallments,
    currentMonthlyPremium,
    newMonthlyPremium,
    totalSaving,
    institutionId,
  } = snapshot

  if (!totalAmount || !remainingInstallments) return null

  // --- Desgravamen (from snapshot) ---
  const desgPrimaBanco = currentMonthlyPremium || 0
  const desgPrimaTDV = newMonthlyPremium || 0
  const desgDevolucion = (desgPrimaBanco - desgPrimaTDV) * remainingInstallments

  // --- Cesantía (on-the-fly) ---
  const bankKey = INSTITUTION_MAP[(institutionId || '').toLowerCase()] || (institutionId || '').toUpperCase()
  const tramo = getTramo(totalAmount)

  let cesantiaTasaBanco = 0
  let cesantiaTasaTDV = 0

  const bankData = tasasCesantiaBanco[bankKey as keyof typeof tasasCesantiaBanco]
  if (bankData) {
    const tramoData = bankData[tramo as keyof typeof bankData] as any
    if (tramoData) cesantiaTasaBanco = tramoData.tasa_mensual
  }

  const tdvData = tasasCesantiaTeDevuelvo.TE_DEVUELVO_CESANTIA
  const tdvTramo = tdvData[tramo as keyof typeof tdvData] as any
  if (tdvTramo) cesantiaTasaTDV = tdvTramo.tasa_mensual

  const cesantiaPrimaBanco = Math.round(totalAmount * cesantiaTasaBanco)
  const cesantiaPrimaTDV = Math.round(totalAmount * cesantiaTasaTDV)
  const cesantiaDevolucion = (cesantiaPrimaBanco - cesantiaPrimaTDV) * remainingInstallments

  const totalDevolucion = desgDevolucion + cesantiaDevolucion

  // Derive margin from totalSaving if available
  let margen = 10
  if (totalSaving && totalDevolucion > 0) {
    margen = Math.round((1 - totalSaving / totalDevolucion) * 100)
    if (margen < 0) margen = 0
  }

  const totalConMargen = Math.round(totalDevolucion * (1 - margen / 100))

  return {
    desgravamen: {
      primaBanco: desgPrimaBanco,
      primaTDV: desgPrimaTDV,
      primaTotalBanco: desgPrimaBanco * remainingInstallments,
      primaTotalTDV: desgPrimaTDV * remainingInstallments,
      devolucion: Math.max(0, Math.round(desgDevolucion)),
    },
    cesantia: {
      primaBanco: cesantiaPrimaBanco,
      primaTDV: cesantiaPrimaTDV,
      primaTotalBanco: cesantiaPrimaBanco * remainingInstallments,
      primaTotalTDV: cesantiaPrimaTDV * remainingInstallments,
      devolucion: Math.max(0, Math.round(cesantiaDevolucion)),
    },
    totalDevolucion: Math.round(totalDevolucion),
    totalConMargen,
    margen,
  }
}
