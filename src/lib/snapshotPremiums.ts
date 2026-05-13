/**
 * Deriva las primas mensuales (banco vs TDV) desde los datos confirmados
 * actuales del snapshot. Esto evita que la UI muestre valores stale cuando
 * el snapshot fue calculado antes de confirmarse el saldo insoluto, monto
 * total o cuotas del crédito.
 *
 * Política:
 *  - Solo aplica para seguro DESGRAVAMEN (cesantía usa prima única).
 *  - Si faltan datos para derivar (sin tasa, sin saldo, etc.) o si el
 *    seguro es cesantía, retorna los valores guardados en el snapshot.
 *  - Las fórmulas son las mismas usadas en el tooltip de Detail y en
 *    `calcularDevolucion()`:
 *      currentMonthlyPremium = (montoTotal × tasaBanco) / cuotasOriginales
 *      newMonthlyPremium     = saldoInsoluto × tasaTDV
 *      monthlySaving         = currentMonthlyPremium − newMonthlyPremium
 */
import tasasSeguro from '@/data/tasas_formateadas_te_devuelvo.json'
import { obtenerTasaPreferencialTDV } from '@/lib/calculadoraUtils'

const MAPEO_INSTITUCIONES: Record<string, string> = {
  santander: 'BANCO SANTANDER', bci: 'BANCO BCI', 'lider-bci': 'LIDER-BCI',
  scotiabank: 'SCOTIABANK', chile: 'BANCO CHILE', security: 'BANCO SECURITY',
  'itau-corpbanca': 'BANCO ITAU-CORPBANCA', bice: 'BANCO BICE', estado: 'BANCO ESTADO',
  ripley: 'BANCO RIPLEY', falabella: 'BANCO FALABELLA', consorcio: 'BANCO CONSORCIO',
  coopeuch: 'COOPEUCH', cencosud: 'BANCO CENCOSUD', forum: 'FORUM', tanner: 'TANNER',
  cooperativas: 'COOPERATIVAS',
}

function resolveAge(snapshot: any): number {
  if (snapshot?.age) return Number(snapshot.age) || 0
  if (!snapshot?.birthDate) return 0
  const birth = new Date(snapshot.birthDate)
  if (isNaN(birth.getTime())) return 0
  const today = new Date()
  let age = today.getFullYear() - birth.getFullYear()
  const monthDiff = today.getMonth() - birth.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) age--
  return age
}

export function getRatesForSnapshot(
  snapshot: any,
  institutionIdOverride?: string,
): { tasaBanco: number | null; tasaTDV: number | null } {
  if (!snapshot) return { tasaBanco: null, tasaTDV: null }
  const institutionId = (institutionIdOverride || snapshot.institutionId || '').toLowerCase()
  const bancoKey = MAPEO_INSTITUCIONES[institutionId] || institutionId.toUpperCase()
  const edad = resolveAge(snapshot)
  const monto = snapshot.confirmedTotalAmount || snapshot.totalAmount || 0
  const saldo =
    snapshot.confirmedAverageInsuredBalance ||
    snapshot.averageInsuredBalance ||
    monto
  const cuotas = snapshot.confirmedOriginalInstallments || snapshot.originalInstallments || 0
  const tramo = edad <= 55 ? 'hasta_55' : 'desde_56'

  let tasaBanco: number | null = null
  try {
    const datosBanco = (tasasSeguro as any)[bancoKey]
    if (datosBanco) {
      const datosTramo = datosBanco[tramo]
      const montoRedondeado = Math.min(
        Math.max(Math.round(monto / 1_000_000) * 1_000_000, 2_000_000),
        100_000_000,
      )
      const datosMonto = datosTramo?.[montoRedondeado.toString()]
      if (datosMonto) {
        tasaBanco = datosMonto[cuotas.toString()] ?? null
        if (tasaBanco === null) {
          const disponibles = Object.keys(datosMonto)
            .map(Number)
            .filter((n) => !isNaN(n))
            .sort((a, b) => a - b)
          if (disponibles.length) {
            const cercana = disponibles.reduce(
              (prev, curr) =>
                Math.abs(curr - cuotas) < Math.abs(prev - cuotas) ? curr : prev,
              disponibles[0],
            )
            tasaBanco = datosMonto[cercana.toString()] ?? null
          }
        }
      }
    }
  } catch {
    /* ignore */
  }

  const tasaTDV = saldo > 0 && edad > 0 ? obtenerTasaPreferencialTDV(saldo, edad) : null

  return { tasaBanco, tasaTDV }
}

export interface DerivedPremiums {
  currentMonthlyPremium: number
  newMonthlyPremium: number
  monthlySaving: number
  /** 'derived' = recalculado en vivo; 'snapshot' = valor persistido (fallback) */
  source: 'derived' | 'snapshot'
}

export function derivePremiumsFromSnapshot(
  snapshot: any,
  institutionId?: string,
): DerivedPremiums {
  const fallback: DerivedPremiums = {
    currentMonthlyPremium: snapshot?.currentMonthlyPremium || 0,
    newMonthlyPremium: snapshot?.newMonthlyPremium || 0,
    monthlySaving: snapshot?.monthlySaving || 0,
    source: 'snapshot',
  }
  if (!snapshot) return fallback

  // Cesantía pura: la prima es única, no aplica recálculo mensual aquí.
  // Si viene mixto (AMBOS / DESGRAVAMEN + CESANTÍA), sí debemos recalcular
  // la parte mensual de desgravamen para no caer al snapshot stale.
  const ins = (snapshot.insuranceToEvaluate || '').toUpperCase()
  const isMixedInsurance =
    ins.includes('AMBOS') ||
    ins.includes('BOTH') ||
    (ins.includes('DESGRAV') && ins.includes('CESANT'))
  const isPureCesantia = (ins === 'CESANTIA' || ins === 'CESANTÍA' || ins.includes('CESANT')) && !isMixedInsurance
  if (isPureCesantia) return fallback

  const { tasaBanco, tasaTDV } = getRatesForSnapshot(snapshot, institutionId)
  const saldo =
    snapshot.confirmedAverageInsuredBalance ||
    snapshot.averageInsuredBalance ||
    snapshot.totalAmount ||
    0
  const monto = snapshot.confirmedTotalAmount || snapshot.totalAmount || saldo
  const cuotasOrig =
    snapshot.confirmedOriginalInstallments || snapshot.originalInstallments || 0

  const canDeriveCurrent = Boolean(tasaBanco && cuotasOrig && monto)
  const canDeriveNew = Boolean(tasaTDV && saldo)

  if (!canDeriveCurrent && !canDeriveNew) return fallback

  const currentMonthlyPremium = canDeriveCurrent
    ? Math.round((monto * tasaBanco!) / cuotasOrig)
    : fallback.currentMonthlyPremium
  const newMonthlyPremium = canDeriveNew
    ? Math.round(saldo * tasaTDV!)
    : fallback.newMonthlyPremium
  const monthlySaving = currentMonthlyPremium > 0 && newMonthlyPremium > 0
    ? Math.max(0, currentMonthlyPremium - newMonthlyPremium)
    : fallback.monthlySaving

  return {
    currentMonthlyPremium,
    newMonthlyPremium,
    monthlySaving,
    source: 'derived',
  }
}