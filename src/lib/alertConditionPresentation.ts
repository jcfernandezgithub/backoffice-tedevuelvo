import type { ConditionStatus, OperationalAlert } from '@/services/operationalAlertsApi'

export const conditionLabels: Record<ConditionStatus,string> = {
  CONFIRMED_ACTIVE: 'Sigue presente',
  CONFIRMED_INACTIVE: 'Ya no cumple los criterios',
  INCOMPLETE: 'Evaluación inconclusa',
  PENDING_REEVALUATION: 'Pendiente de evaluar con la regla vigente',
  RULE_DISABLED: 'Regla desactivada',
}

// Only the server's explicit condition status confirms the present result.
export function alertConditionStatus(alert: Pick<OperationalAlert,'conditionStatus'>): ConditionStatus|null {
  return alert.conditionStatus && Object.prototype.hasOwnProperty.call(conditionLabels,alert.conditionStatus) ? alert.conditionStatus : null
}

export function alertConditionLabel(alert: Pick<OperationalAlert,'conditionStatus'>) {
  const status = alertConditionStatus(alert)
  return status ? conditionLabels[status] : 'Situación sin confirmar'
}

export const evaluationResultLabels: Record<string,string> = {
  ACTIVE:'Cumple los criterios', INACTIVE:'No cumple los criterios', INCOMPLETE:'Evaluación inconclusa',
  ...conditionLabels,
}