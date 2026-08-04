/**
 * Configuración compartida para Póliza N° 353 - Seguro de Desgravamen
 *
 * Reemplaza a la Póliza N° 347: todo certificado nuevo se emite bajo la 353,
 * con la misma lógica y vigencia. Se agrega el Plan 4 para capitales entre
 * $100.000.001 y $150.000.000.
 *
 * Tramos por monto del crédito (Plan):
 *   Plan 1: ≤ $20.000.000
 *   Plan 2: $20.000.001 – $60.000.000
 *   Plan 3: $60.000.001 – $100.000.000
 *   Plan 4: $100.000.001 – $150.000.000
 *
 * Tasa Comercial Bruta Mensual (TBM) por Plan y rango de edad (por mil):
 *                 18 – 55     56 – 65
 *   Plan 1        0,3400      0,4400
 *   Plan 2        0,4400      0,4400
 *   Plan 3        0,4400      0,5000
 *   Plan 4        0,8800      1,0000
 */

export type Pol353Plan = 1 | 2 | 3 | 4

export const POL353_CONFIG = {
  numero: '353',
  codigoCMF: 'POL 2 2015 0573',
  codigoCMFCompacto: 'POL220150573',
  // Vigencia colectiva (misma de la Póliza 347: 04/05/2026 – 03/05/2029)
  vigenciaInicio: '04/05/2026',
  vigenciaFin: '03/05/2029',
  vigenciaInicioLargo: '04 de mayo de 2026',
  vigenciaFinLargo: '03 de mayo de 2029',
  capitalMaximo: 150_000_000,
  edadMinimaIngreso: 18,
  edadMaximaIngreso: 64,
  edadMaximaPermanenciaTexto: '71 años y 364 días',
  plazoMaximoMeses: 80,
  contratante: {
    nombre: 'TDV SERVICIOS SPA',
    rut: '78.168.126-1',
  },
  aseguradora: {
    nombre: 'Augustar Seguros de Vida S.A.',
    rut: '76.632.384-7',
  },
  corredor: {
    nombre: 'Prime Corredores de Seguro SPA.',
    rut: '76.196.802-5',
  },
  tasas: {
    // [planIndex 0=Plan 1, 1=Plan 2, 2=Plan 3, 3=Plan 4]
    '18-55': [0.3400, 0.4400, 0.4400, 0.8800],
    '56-65': [0.4400, 0.4400, 0.5000, 1.0000],
  },
}

/** Tope de cada plan (inclusive). Plan 4 = capital máximo total. */
const PLAN_TOPES: Record<Pol353Plan, number> = {
  1: 20_000_000,
  2: 60_000_000,
  3: 100_000_000,
  4: 150_000_000,
}

/** Devuelve el Plan (1, 2, 3 o 4) según el monto del crédito (saldo insoluto inicial). */
export const getPlanByAmount = (monto: number): Pol353Plan => {
  if (monto <= PLAN_TOPES[1]) return 1
  if (monto <= PLAN_TOPES[2]) return 2
  if (monto <= PLAN_TOPES[3]) return 3
  return 4
}

/** Devuelve la TBM (por mil) según Plan y edad. Si edad indefinida, asume tramo 18-55. */
export const getTBM = (plan: Pol353Plan, age?: number): number => {
  const tramo: '18-55' | '56-65' = age && age >= 56 ? '56-65' : '18-55'
  return POL353_CONFIG.tasas[tramo][plan - 1]
}

/**
 * Calcula la Prima Única exacta según fórmula legal:
 *   Prima Única = Saldo Insoluto × (TBM / 1000) × Nper
 */
export const calcPrimaUnicaPol353 = (
  saldoInsoluto: number,
  age: number | undefined,
  cuotasPendientes: number,
): { plan: Pol353Plan; tbm: number; primaUnica: number } => {
  const plan = getPlanByAmount(saldoInsoluto)
  const tbm = getTBM(plan, age)
  const primaUnica = Math.round(saldoInsoluto * (tbm / 1000) * cuotasPendientes)
  return { plan, tbm, primaUnica }
}

/** Formato CLP con separadores de miles. */
export const formatCLP = (value: number): string =>
  `$${Math.round(value).toLocaleString('es-CL')}`

/** Tasa formateada con coma decimal y 4 decimales (ej: 0,3400) */
export const formatTasa = (tasa: number): string =>
  tasa.toFixed(4).replace('.', ',')