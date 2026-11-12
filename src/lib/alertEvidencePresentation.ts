import { DEFAULT_NOMINA_CATALOGS, findBancoInCatalog } from '@/pages/NominaDevoluciones/logic/nomina_logic_complete'

export const requestStatusLabels: Record<string, string> = {
  SIMULATED: 'Simulado', REQUESTED: 'Solicitado', QUALIFYING: 'En calificación',
  DOCS_PENDING: 'Documentos pendientes', DOCS_RECEIVED: 'Documentos recibidos',
  SUBMITTED: 'Ingresado', APPROVED: 'Aprobado', REJECTED: 'Rechazado',
  PAYMENT_SCHEDULED: 'Pago programado', PAID: 'Pagado', CANCELED: 'Cancelado',
  CANCELLED: 'Cancelado', DATOS_SIN_SIMULACION: 'Datos (sin simulación)',
}
const accountTypeLabels: Record<string, string> = {
  CURRENT: 'Cuenta corriente', CHECKING: 'Cuenta corriente', CURRENT_ACCOUNT: 'Cuenta corriente',
  SAVINGS: 'Cuenta de ahorro', SAVINGS_ACCOUNT: 'Cuenta de ahorro',
  VISTA: 'Cuenta vista', VIEW: 'Cuenta vista', SIGHT: 'Cuenta vista', SIGHT_ACCOUNT: 'Cuenta vista',
  RUT: 'Cuenta RUT', CUENTA_RUT: 'Cuenta RUT', PREPAID: 'Cuenta prepago',
}
export function requestStatusLabel(status?: string, label?: string) {
  const value = status?.trim().toUpperCase()
  const translated = value ? requestStatusLabels[value] : undefined
  if (translated) return translated
  if (label?.trim() && !/^[A-Z_]+$/.test(label.trim())) return label
  return 'Estado no reconocido'
}
export function alertAccountType(value?: string) {
  if (!value?.trim()) return 'Tipo de cuenta no informado'
  return accountTypeLabels[value.trim().toUpperCase().replace(/\s+/g, '_')] ?? value
}
export function alertBank(value?: string) {
  if (!value?.trim()) return 'Banco no informado'
  const bank = findBancoInCatalog(value, DEFAULT_NOMINA_CATALOGS.bancos)
  return bank ? bank.name : /^\d+$/.test(value.trim()) ? `Banco no identificado (código ${value})` : value
}