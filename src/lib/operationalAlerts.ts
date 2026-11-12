import { z } from 'zod'
import type { Usuario } from '@/types/domain'
import type { BackendUser } from '@/pages/Usuarios/services/usersApi'

export const ruleLabels = {
  SAME_RUT_MULTIPLE_ACCOUNTS: 'Un RUT con cuentas distintas',
  SAME_RUT_MONTHLY_PAID_VOLUME: 'Volumen mensual de pagos por RUT',
  SAME_ACCOUNT_MULTIPLE_RUTS: 'Una cuenta con distintos RUT',
  BANK_ACCOUNT_CHANGE_NEAR_PAYMENT: 'Cambios de cuenta cercanos al pago',
} as const
export type RuleCode = keyof typeof ruleLabels
export const statusLabels = { PENDING: 'Pendiente', IN_REVIEW: 'En revisión', RESOLVED: 'Resuelta' } as const
export const priorityLabels = { HIGH: 'Alta', MEDIUM: 'Media', LOW: 'Baja' } as const
export function alertsAccess(user: Usuario | null) {
  const roles = (user?.roles ?? []).map(r => r.toUpperCase())
  const excluded = !user?.activo || user.email.toLowerCase() === 'admin@callcenter.cl' || ['ALIANZAS', 'CALLCENTER', 'READONLY'].includes(user.rol)
  const admin = !excluded && roles.includes('ADMIN')
  const allowed = admin || (!excluded && roles.includes('OPERADOR') && Boolean(user?.pages?.includes('ALERTAS_OPERATIVAS')))
  return { allowed, admin }
}
export const alertsEntryAccess = (user: Usuario | null, pathname: string) => pathname === '/operacion' && alertsAccess(user).allowed
export function isAlertAssigneeRole(role: { normalizedName?: string; name?: string }) {
  const name = (role.normalizedName ?? role.name ?? '').trim().toUpperCase()
  return ['ADMIN', 'ADMINISTRADOR', 'OPERADOR', 'OPERACIONES', 'OPERATOR', 'OPERATIONS'].includes(name)
}
// Candidate filtering is presentation-only; the alerts service authorizes reassignment.
export function isAlertAssignee(user: BackendUser) {
  return user.status === 'active' && Boolean(user.id ?? user._id)
    && user.email.trim().toLowerCase() !== 'admin@callcenter.cl'
    && isAlertAssigneeRole(user.role ?? {})
}
export const ruleFields: Record<RuleCode, string[]> = {
  SAME_RUT_MULTIPLE_ACCOUNTS: ['paidWindowDays'],
  SAME_RUT_MONTHLY_PAID_VOLUME: ['minPaidRequests', 'minTotalPaidAmountCLP'],
  SAME_ACCOUNT_MULTIPLE_RUTS: ['paidWindowDays', 'minDistinctRuts'],
  BANK_ACCOUNT_CHANGE_NEAR_PAYMENT: ['nearPaymentHours', 'repeatedChangeDays', 'minChanges'],
}
export const fieldLabels: Record<string, string> = { paidWindowDays: 'Ventana de pagos (días)', minPaidRequests: 'Cantidad mínima de pagos', minTotalPaidAmountCLP: 'Monto mínimo mensual (CLP)', minDistinctRuts: 'Cantidad mínima de RUT', nearPaymentHours: 'Cercanía al pago (horas)', repeatedChangeDays: 'Ventana de cambios (días)', minChanges: 'Cantidad mínima de cambios' }
const version = z.number().int().min(1)
const comment = z.string().trim().min(1, 'Escribe una observación.').max(2000).refine(v => !/\d{8,}/.test(v), 'No incluyas números completos de cuenta.')
const reference = z.string().max(500).url().refine(v => { const u = new URL(v); return u.protocol === 'https:' && !u.username && !u.password && !u.search && !u.hash }, 'La referencia debe ser HTTPS, sin credenciales, parámetros ni fragmentos.')
export const actionSchemas = {
  claim: z.object({ expectedVersion: version }).strict(),
  comments: z.object({ expectedVersion: version, comment, requiresFollowUp: z.boolean() }).strict(),
  resolve: z.object({ expectedVersion: version, comment, outcome: z.enum(['VALIDATED_NO_ANOMALY', 'ERROR_CORRECTED', 'ESCALATED']), escalation: z.object({ destination: z.string().trim().min(1).max(160), referenceUrl: reference }).strict().optional() }).strict().superRefine((v,c) => { if (v.outcome === 'ESCALATED' && !v.escalation) c.addIssue({ code: 'custom', message: 'La escalada requiere destino y referencia aprobada.' }) }),
  reassign: z.object({ expectedVersion: version, assigneeId: z.string().regex(/^[a-fA-F0-9]{24}$/), reason: comment }).strict(),
}
export type AlertAction = keyof typeof actionSchemas
export function validateRuleUpdate(rule: RuleCode, body: unknown) {
  const fields = Object.fromEntries(ruleFields[rule].map(k => [k, z.number().int().min(['minPaidRequests','minDistinctRuts','minChanges'].includes(k) ? 2 : 1).max(k === 'minTotalPaidAmountCLP' ? 1e12 : 10000).nullable()]))
  const value = z.object({ expectedVersion: version, enabled: z.boolean(), priority: z.enum(['HIGH','MEDIUM','LOW']).nullable(), parameters: z.object(fields).strict() }).strict().parse(body)
  if (value.enabled) {
    if (!value.priority) throw new Error('Selecciona una prioridad antes de activar.')
    const p = value.parameters
    if (rule === 'SAME_RUT_MONTHLY_PAID_VOLUME' ? p.minPaidRequests == null && p.minTotalPaidAmountCLP == null : rule === 'BANK_ACCOUNT_CHANGE_NEAR_PAYMENT' ? p.nearPaymentHours == null : p.paidWindowDays == null || (rule === 'SAME_ACCOUNT_MULTIPLE_RUTS' && p.minDistinctRuts == null)) throw new Error('Completa los parámetros requeridos antes de activar.')
  }
  if (rule === 'BANK_ACCOUNT_CHANGE_NEAR_PAYMENT' && (value.parameters.minChanges != null) !== (value.parameters.repeatedChangeDays != null)) throw new Error('La ventana y cantidad de cambios se configuran juntas.')
  return value
}
export const alertsScope = (user: Usuario | null) => JSON.stringify([user?.id, user?.activo, user?.rol, user?.roles, user?.pages])
export const alertMoney = (value: number | null | undefined) => value == null ? 'Monto desconocido' : value.toLocaleString('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 })
export const alertDate = (value?: string | null) => value ? new Date(value).toLocaleString('es-CL', { timeZone: 'America/Santiago' }) : 'No disponible'