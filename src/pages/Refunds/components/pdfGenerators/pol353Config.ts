/**
 * Configuración para Póliza N° 353 - Seguro de Desgravamen Colectivo
 * Augustar Seguros de Vida S.A. / TDV Servicios SpA
 *
 * Reemplaza a la Póliza N° 347: todo certificado nuevo se emite bajo la 353.
 * Misma vigencia y estructura; agrega el Plan 4 ($100.000.001 – $150.000.000).
 *
 * Tasas Brutas Mensuales (por mil):
 * | Edad    | Plan 1 | Plan 2 | Plan 3 | Plan 4 |
 * |---------|--------|--------|--------|--------|
 * | 18 - 55 | 0,3400 | 0,4400 | 0,4400 | 0,8800 |
 * | 56 - 65 | 0,4400 | 0,4400 | 0,5000 | 1,0000 |
 */

export type Pol353Plan = 1 | 2 | 3 | 4

export const POL353_CONFIG = {
  numero: '353',
  codigoCMF: 'POL 2 2015 0573',
  codigoCMFCompacto: 'POL220150573',
  vigenciaInicio: '04/05/2026',
  vigenciaFin: '03/05/2029',
  vigenciaInicioLargo: '04 de mayo de 2026',
  vigenciaFinLargo: '03 de mayo de 2029',
  capitalMaximo: 150_000_000,
  edadMinimaIngreso: 18,
  edadMaximaIngreso: 64,
  edadMaximaPermanenciaTexto: '71 años y 364 días',
  plazoMaximoMeses: 80,
  contratante: { nombre: 'TDV SERVICIOS SPA', rut: '78.168.126-1' },
  aseguradora: { nombre: 'Augustar Seguros de Vida S.A.', rut: '76.632.384-7' },
  corredor: { nombre: 'Prime Corredores de Seguro SPA.', rut: '76.196.802-5' },
  tasas: {
    '18-55': [0.3400, 0.4400, 0.4400, 0.8800] as const,
    '56-65': [0.4400, 0.4400, 0.5000, 1.0000] as const,
  },
} as const

/** Tope de capital asegurado por plan */
const PLAN_TOPES: Record<Pol353Plan, number> = {
  1: 20_000_000,
  2: 60_000_000,
  3: 100_000_000,
  4: 150_000_000,
}

/** Determina el plan según el saldo insoluto (capital asegurado) */
export function getPlanByAmount(saldoInsoluto: number): Pol353Plan {
  if (saldoInsoluto <= PLAN_TOPES[1]) return 1
  if (saldoInsoluto <= PLAN_TOPES[2]) return 2
  if (saldoInsoluto <= PLAN_TOPES[3]) return 3
  return 4
}

/** Tasa Bruta Mensual (por mil) según edad y plan */
export function getTBM(edad: number, plan: Pol353Plan): number {
  const tramo = edad <= 55 ? POL353_CONFIG.tasas['18-55'] : POL353_CONFIG.tasas['56-65']
  return tramo[plan - 1]
}

/**
 * Prima Única Neta = TBM/1000 × Saldo Insoluto × Cuotas
 * Prima Única Bruta = Neta / 0,80645  (recargo 24%: 1/1,24 = 0,80645…)
 * Prima Única Total = Bruta × 1,19   (IVA 19%)
 */
export function calcPrimaUnicaPol353(saldoInsoluto: number, edad: number, cuotas: number) {
  const plan = getPlanByAmount(saldoInsoluto)
  const tbm = getTBM(edad, plan)
  const neta = Math.round((tbm / 1000) * saldoInsoluto * cuotas)
  const bruta = Math.round(neta / 0.80645)
  const total = Math.round(bruta * 1.19)
  return { plan, tbm, neta, bruta, total }
}

/** Formatea un monto CLP: 5000000 → "$5.000.000" */
export function formatCLP(n: number): string {
  return '$' + Math.round(n).toLocaleString('es-CL')
}

/** Formatea una tasa por mil: 0.44 → "0,4400" */
export function formatTasa(tasa: number): string {
  return tasa.toFixed(4).replace('.', ',')
}