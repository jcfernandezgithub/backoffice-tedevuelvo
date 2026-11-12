import type { OperationalAlert } from '@/services/operationalAlertsApi'
import { alertDate, priorityLabels } from '@/lib/operationalAlerts'
import { alertConditionLabel, alertConditionStatus, evaluationResultLabels } from '@/lib/alertConditionPresentation'
import { AlertDisclosure, SafeFields } from './AlertCommon'

export function AlertEvaluation({alert}:{alert:OperationalAlert}) {
  const status=alertConditionStatus(alert)
  const evaluation=alert.lastEvaluation
  const rule=alert.currentRule
  return <section aria-label="Situación actual de la alerta" className="border-y py-4 space-y-3">
    <div className="space-y-1">
      <h3 className="font-semibold">{alertConditionLabel(alert)}</h3>
      {status==='CONFIRMED_INACTIVE'&&<p className="text-sm text-muted-foreground">La situación ya no cumple los criterios evaluados. La alerta conserva sus antecedentes y su estado de revisión.</p>}
      {status==='PENDING_REEVALUATION'&&<p className="text-sm text-muted-foreground">Aún no hay un resultado confirmado con la configuración vigente. La detección anterior no confirma que la situación siga presente.</p>}
      {status==='RULE_DISABLED'&&<p className="text-sm text-muted-foreground">Este tipo de alerta está desactivado. Se conservan los antecedentes y la revisión del caso.</p>}
      {!status&&<p className="text-sm text-muted-foreground">El servicio no informó una situación confirmada para este caso.</p>}
      {status==='INCOMPLETE'&&<div role="alert" className="text-sm space-y-2"><p>No fue posible confirmar si cumple los criterios.</p>{evaluation?.reasons?.length ? <ul className="list-disc pl-5 space-y-1">{evaluation.reasons.map((reason,i)=><li key={i}><SafeFields value={{reason}}/></li>)}</ul> : <p className="text-muted-foreground">El servicio no informó el motivo de la evaluación inconclusa.</p>}</div>}
    </div>
    <div className="space-y-2 text-sm">
      <h4 className="font-medium">Última evaluación aplicada</h4>
      {evaluation ? <><p className="text-muted-foreground">{alertDate(evaluation.evaluatedAt)} · Versión {evaluation.ruleVersion??'No informada'}</p><p>Resultado: <strong>{evaluationResultLabels[evaluation.result??'']??'No informado'}</strong></p><AlertDisclosure title="Parámetros y resultados de esta evaluación"><div className="grid sm:grid-cols-2 gap-4"><div className="space-y-2"><h5 className="font-medium">Criterios aplicados</h5><SafeFields value={evaluation.parameters??{}}/></div><div className="space-y-2"><h5 className="font-medium">Datos evaluados</h5><SafeFields value={evaluation.metrics??{}}/><SafeFields value={evaluation.conditions??{}}/></div></div><p className="text-xs text-muted-foreground mt-3">Información revisada hasta: {alertDate(evaluation.dataAsOf)}</p></AlertDisclosure></> : <p className="text-muted-foreground">No hay una evaluación aplicada informada.</p>}
    </div>
    <AlertDisclosure title="Configuración vigente"><div className="space-y-3 text-sm">{rule ? <><p>Versión {rule.version} · {rule.enabled?'Activada':'Desactivada'} · Prioridad {rule.priority?priorityLabels[rule.priority]:'Sin definir'}</p><SafeFields value={rule.parameters}/><p className="text-xs text-muted-foreground">Actualizada: {alertDate(rule.updatedAt)}</p></> : <p>El servicio no informó la configuración vigente.</p>}</div></AlertDisclosure>
  </section>
}