import type { RuleCode, AlertAction } from '@/lib/operationalAlerts'
import { actionSchemas, validateRuleUpdate } from '@/lib/operationalAlerts'
import { authenticatedFetch } from './apiClient'
import { configuredApiBaseUrl } from './apiConfig'

export interface AlertMeta { schemaVersion: string; snapshotToken: string; evaluationStatus: 'READY'|'RUNNING'|'FAILED'|'NOT_CONFIGURED'; stale: boolean; detectorEnabled?: boolean; dataAsOf?: string|null; lastSuccessfulEvaluationAt?: string|null; coverage?: Record<string, unknown>|null; dataQuality?: Record<string,number>|null; currentDataAsOf?: string; page: number; limit: number; total: number; totalPages: number }
export interface Actor { id: string; name?: string|null }
export type ConditionStatus = 'CONFIRMED_ACTIVE'|'CONFIRMED_INACTIVE'|'INCOMPLETE'|'PENDING_REEVALUATION'|'RULE_DISABLED'
export interface AlertEvaluation {
  ruleVersion?: string|number; evaluatedAt?: string; dataAsOf?: string; priority?: OperationalAlert['priority']|null;
  parameters?: Record<string,number|null>; result?: string; reasons?: (string|{code?:string;message?:string;reason?:string})[];
  metrics?: Record<string,unknown>; conditions?: Record<string,unknown>; scope?: Record<string,unknown>;
}
export interface OperationalAlert {
  id: string; ruleCode: RuleCode; ruleVersion: string; title?: string; reason?: string; priority: 'HIGH'|'MEDIUM'|'LOW'; status: 'PENDING'|'IN_REVIEW'|'RESOLVED'; version: number;
  subjects: { rut: string; fullName: string|null }[]; subjectCount: number; relatedRequestCount: number; distinctAccountCount: number; missingAccountCount: number;
  knownTotalAmountCLP: number; missingAmountCount: number; isAmountTotalComplete: boolean; period?: { month?: string; from?: string; toExclusive?: string }|null;
  firstDetectedAt?: string; lastDetectedAt?: string; conditionActive: boolean; conditionEvaluation?: string; assignedTo?: Actor|null; assignedAt?: string|null; requiresFollowUp?: boolean; previousAlertId?: string|null; resolvedBy?: Actor|null; resolvedAt?: string|null; resolutionComment?: string;
  conditionStatus?: ConditionStatus; currentRule?: AlertRule|null; lastEvaluation?: AlertEvaluation|null; evaluationRunStatus?: EvaluationRun['status'];
  thresholds?: Record<string, number|null>; conditions?: Record<string,unknown>; limitations?: string[]; changeEvents?: Record<string,unknown>[]; changeEventCount?: number; changeEventsTruncated?: boolean; changeConditions?: Record<string,unknown>|null;
  actions?: { canClaim: boolean; canComment: boolean; canResolve: boolean; canReassign: boolean }; meta: AlertMeta;
}
export interface AlertSummary { totals: {pending:number;inReview:number;resolved:number;open:number}; globalOpenCount:number; byPriority: Record<'HIGH'|'MEDIUM'|'LOW',number>; byRule:{ruleCode:RuleCode;open:number}[]; meta:AlertMeta }
export interface Evidence { rut?:string;fullName?:string|null;status?:string;statusLabel?:string;bank?:string;accountType?:string;maskedAccountNumber?:string;accountIdentityId?:string|null;accountSource?:string;amountCLP?:number|null;amountSource?:string|null;paidAt?:string|null;paymentDateSource?:string|null;scheduledAt?:string|null;administrativePaymentOnly?:boolean;paidReentryCount?:number }
export interface EvidenceItem { publicId:string; evidenceAtDetection:Evidence; currentData:Evidence|null }
export interface HistoryItem {id:string;type:string;at:string;actor:Actor|null;data:Record<string,unknown>}
export interface AlertRule {ruleCode:RuleCode;version:number;enabled:boolean;priority:'HIGH'|'MEDIUM'|'LOW'|null;parameters:Record<string,number|null>;updatedAt?:string;updatedBy?:string}
export interface AlertPage<T> {data:T[];meta:AlertMeta}
export type AlertFilters = Partial<Record<'from'|'to'|'ruleCode'|'priority'|'search'|'assigneeId'|'conditionActive'|'conditionStatus'|'status'|'sort',string>>
export interface EvaluationRun {
  evaluationId: string; status: 'QUEUED'|'RUNNING'|'SUCCEEDED'|'FAILED'|'INTERRUPTED'|'DISCARDED';
  origin: 'MANUAL'|'DAILY'|'CLI'|'INITIAL_LOAD'; requestedAt: string; requestedBy: {id:string}|null;
  startedAt: string|null; finishedAt: string|null; resultsMayBePartial: boolean;
  scope: {type:'ALL_ENABLED_RULES'; timezone:'America/Santiago'; coverageFrom:string};
  appliedRules: {ruleCode:string;version:number;priority:string|null;parameters:Record<string,unknown>}[]|null;
  progress: {stage?:string;scanned?:number;groupsProcessed?:number;elapsedMs?:number}|null;
  error: {code:string;message:string}|null; pollAfterSeconds: number;
}
export interface EvaluationRecovery {active:EvaluationRun|null;latestRequestedByMe:EvaluationRun|null;pollAfterSeconds:number}
function validEvaluation(value:unknown):value is EvaluationRun {
  if(!value||typeof value!=='object')return false
  const run=value as Partial<EvaluationRun>
  return typeof run.evaluationId==='string' && Boolean(run.evaluationId) && ['QUEUED','RUNNING','SUCCEEDED','FAILED','INTERRUPTED','DISCARDED'].includes(run.status??'') && ['MANUAL','DAILY','CLI','INITIAL_LOAD'].includes(run.origin??'') && typeof run.resultsMayBePartial==='boolean' && typeof run.pollAfterSeconds==='number'
}
export class AlertsApiError extends Error {
  constructor(public status:number, public code:string, message:string,public requestId?:string,public retryAfterMs=0,public evaluationId?:string) { super(message) }
}
export function alertsQuery(filters: Record<string,string|number|undefined>) { const q = new URLSearchParams(); Object.entries(filters).forEach(([k,v]) => { if (v !== undefined && v !== '') q.set(k,String(v)) }); return q.size ? `?${q}` : '' }
export function createAlertsClient(fetcher: typeof authenticatedFetch, baseUrl?:string) {
  async function request<T>(path:string, init:RequestInit = {}):Promise<T> {
    if (!baseUrl) throw new AlertsApiError(0,'MISSING_API_URL','Falta configurar la dirección del servicio de alertas.')
    const res = await fetcher(`/backoffice-alerts${path}`, {...init,cache:'no-store'},baseUrl)
    const body = await res.json().catch(() => null)
    if (!res.ok) {
      const retryAfter=res.headers.get('Retry-After')
      const retryAfterMs=retryAfter ? (/^\d+$/.test(retryAfter)?Number(retryAfter)*1000:Math.max(0,Date.parse(retryAfter)-Date.now())):0
      throw new AlertsApiError(res.status,body?.error?.code ?? `HTTP_${res.status}`,body?.error?.message ?? 'No se pudo consultar el servicio de alertas.',body?.error?.requestId,retryAfterMs || Number(body?.error?.retryAfterSeconds ?? 0)*1000,body?.error?.evaluationId)
    }
    if (!body || typeof body !== 'object') throw new AlertsApiError(500,'INVALID_RESPONSE','Respuesta de alertas no compatible.')
    if (path.startsWith('/evaluations')) {
      const valid = 'evaluationId' in body ? validEvaluation(body) : 'active' in body && 'latestRequestedByMe' in body && (body.active===null||validEvaluation(body.active)) && (body.latestRequestedByMe===null||validEvaluation(body.latestRequestedByMe)) && typeof body.pollAfterSeconds==='number'
      if(!valid)throw new AlertsApiError(500,'INVALID_RESPONSE','Respuesta de evaluación incompleta. Consulta el estado antes de volver a iniciar.')
      const retryAfter = res.headers.get('Retry-After')
      if (retryAfter) body.pollAfterSeconds = Math.max(10,/^\d+$/.test(retryAfter) ? Number(retryAfter) : Math.ceil((Date.parse(retryAfter)-Date.now())/1000))
    }
    return body as T
  }
  return {
    recoverEvaluations: (signal?:AbortSignal) => request<EvaluationRecovery>('/evaluations',{signal}),
    evaluation: (id:string,signal?:AbortSignal) => request<EvaluationRun>(`/evaluations/${encodeURIComponent(id)}`,{signal}),
    startEvaluation: (key:string) => request<EvaluationRun>('/evaluations',{method:'POST',headers:{'Idempotency-Key':key,'Content-Type':'application/json'},body:'{}'}),
    async summary(filters:AlertFilters,signal?:AbortSignal) {
      const {status,sort,...common} = filters
      const body = await request<AlertSummary>(`/summary${alertsQuery(common)}`,{signal})
      if (body.meta?.schemaVersion !== '1.0' || !body.meta.snapshotToken || !['READY','RUNNING','FAILED','NOT_CONFIGURED'].includes(body.meta.evaluationStatus) || typeof body.meta.stale !== 'boolean' || !body.totals || !['pending','inReview','resolved','open'].every(k => Number.isInteger(body.totals[k as keyof typeof body.totals])) || typeof body.globalOpenCount !== 'number' || !body.byPriority || !Array.isArray(body.byRule)) throw new AlertsApiError(500,'INVALID_RESPONSE','Resumen de alertas incompleto.')
      return body
    },
    async page<T>(path:string,token:string,page=1,filters:AlertFilters={},signal?:AbortSignal) {
      const body = await request<AlertPage<T>>(`${path}${alertsQuery({...filters,snapshotToken:token,page,limit:25})}`,{signal})
      if (!Array.isArray(body.data) || !Number.isInteger(body.meta?.total) || !Number.isInteger(body.meta?.totalPages) || body.meta.snapshotToken !== token) throw new AlertsApiError(500,'INVALID_RESPONSE','Listado o corte de alertas no compatible.')
      return body
    },
    async detail(id:string,token:string,signal?:AbortSignal) {
      const body = await request<OperationalAlert>(`/alerts/${encodeURIComponent(id)}${alertsQuery({snapshotToken:token})}`,{signal})
      if (body.id !== id || !Number.isInteger(body.version) || !body.actions || body.meta?.snapshotToken !== token) throw new AlertsApiError(500,'INVALID_RESPONSE','Detalle o corte de alertas no compatible.')
      return body
    },
    async rules(signal?:AbortSignal) {
      const body=await request<{data:AlertRule[];meta:Record<string,unknown>}>('/rules',{signal})
      if (!Array.isArray(body.data) || body.data.some(rule=>!Number.isInteger(rule.version)||!rule.parameters)) throw new AlertsApiError(500,'INVALID_RESPONSE','Configuración de reglas incompleta.')
      return body
    },
    action:(id:string,action:AlertAction,body:unknown,key:string) => request<OperationalAlert>(`/alerts/${encodeURIComponent(id)}/${action}`,{method:'POST',headers:{'Idempotency-Key':key},body:JSON.stringify(actionSchemas[action].parse(body))}),
    updateRule:(rule:RuleCode,body:unknown,key:string) => request<AlertRule>(`/rules/${rule}`,{method:'PATCH',headers:{'Idempotency-Key':key},body:JSON.stringify(validateRuleUpdate(rule,body))}),
  }
}
export const operationalAlertsApi = createAlertsClient(authenticatedFetch,configuredApiBaseUrl)