import type { EvaluationRun } from '@/services/operationalAlertsApi'

export const evaluationIsActive = (run?: EvaluationRun|null) => run?.status === 'QUEUED' || run?.status === 'RUNNING'
export const evaluationPollMs = (run?: {pollAfterSeconds:number}|null) => Math.max(10,run?.pollAfterSeconds ?? 10)*1000
export const evaluationStatusLabels: Record<EvaluationRun['status'],string> = {
  QUEUED:'Evaluación registrada, esperando inicio', RUNNING:'Evaluación en curso',
  SUCCEEDED:'Evaluación completada', FAILED:'La evaluación no pudo completarse',
  INTERRUPTED:'Evaluación interrumpida', DISCARDED:'La configuración cambió durante la evaluación',
}
export interface PendingEvaluation {key:string;body:'{}';evaluationId?:string}
export function pendingEvaluationStorageKey(project:string,userId:string) {
  return `operational-alert-evaluation:${JSON.stringify([project,userId])}`
}
export function readPendingEvaluation(storage:Pick<Storage,'getItem'>,storageKey:string):PendingEvaluation|null {
  const raw=storage.getItem(storageKey)
  if(!raw)return null
  const value:unknown=JSON.parse(raw)
  if(!value || typeof value!=='object' || !('key' in value) || typeof value.key!=='string' || !/^[\w-]{16,128}$/.test(value.key) || !('body' in value) || value.body!=='{}')throw new Error('No se pudo recuperar la petición pendiente. No se iniciará otra evaluación automáticamente.')
  return {key:value.key,body:'{}',...('evaluationId' in value && typeof value.evaluationId==='string'?{evaluationId:value.evaluationId}:{})}
}