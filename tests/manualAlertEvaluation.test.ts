import {describe,test,expect} from 'bun:test'
import {createAlertsClient} from '../src/services/operationalAlertsApi'
import {evaluationIsActive,evaluationPollMs,pendingEvaluationStorageKey,readPendingEvaluation} from '../src/lib/manualAlertEvaluation'
import {alertsAccess} from '../src/lib/operationalAlerts'
import type {EvaluationRun} from '../src/services/operationalAlertsApi'
import type {Usuario} from '../src/types/domain'
const run:EvaluationRun={evaluationId:'eval-1',status:'QUEUED',origin:'MANUAL',requestedAt:'2026-11-12T22:00:00Z',requestedBy:{id:'admin'},startedAt:null,finishedAt:null,resultsMayBePartial:false,scope:{type:'ALL_ENABLED_RULES',timezone:'America/Santiago',coverageFrom:'2026-01-01'},appliedRules:null,progress:null,error:null,pollAfterSeconds:10}
describe('Manual alert evaluation contract',()=>{
  test('ADMIN only, preserving inactive and callcenter exclusions',()=>{
    const user:Usuario={id:'admin',nombre:'Admin',email:'admin@example.test',rol:'ADMIN',roles:['ADMIN'],activo:true,pages:['ALERTAS_OPERATIVAS']}
    expect(alertsAccess(user).admin).toBe(true)
    expect(alertsAccess({...user,rol:'OPERACIONES',roles:['OPERADOR']}).admin).toBe(false)
    expect(alertsAccess({...user,email:'admin@callcenter.cl'}).admin).toBe(false)
    expect(alertsAccess({...user,activo:false}).admin).toBe(false)
  })
  test('POST uses empty body, explicit key, no snapshots and no automatic retry',async()=>{
    const seen:{path:string;init:RequestInit}[]=[]
    const api=createAlertsClient(async(path,init)=>{seen.push({path,init:init??{}});throw new TypeError('timeout')},'https://example.test/api/v1')
    await expect(api.startEvaluation('original-key-123456')).rejects.toThrow('timeout')
    expect(seen).toHaveLength(1)
    await expect(api.startEvaluation('original-key-123456')).rejects.toThrow('timeout')
    expect(seen[0]).toEqual(seen[1])
    expect(seen[0].path).toBe('/backoffice-alerts/evaluations')
    expect(seen[0].init.body).toBe('{}')
    expect(seen[0].init.headers).toEqual({'Idempotency-Key':'original-key-123456','Content-Type':'application/json'})
    expect(seen[0].init.cache).toBe('no-store')
  })
  test('recovery and status are independent of filters and alert snapshots',async()=>{
    const seen:string[]=[];const api=createAlertsClient(async(path)=>{seen.push(path);return Response.json(path.endsWith('eval-1')?run:{active:run,latestRequestedByMe:null,pollAfterSeconds:10})},'https://example.test/api/v1')
    expect((await api.recoverEvaluations()).active?.origin).toBe('MANUAL')
    expect((await api.evaluation('eval-1')).status).toBe('QUEUED')
    expect(seen).toEqual(['/backoffice-alerts/evaluations','/backoffice-alerts/evaluations/eval-1'])
  })
  test('only queued and running are polled, terminal replay remains terminal',async()=>{
    for(const status of ['QUEUED','RUNNING'] as const)expect(evaluationIsActive({...run,status})).toBe(true)
    for(const status of ['SUCCEEDED','FAILED','INTERRUPTED','DISCARDED'] as const){
      expect(evaluationIsActive({...run,status})).toBe(false)
      const api=createAlertsClient(async()=>Response.json({...run,status},{status:202}),'https://example.test/api/v1')
      expect((await api.startEvaluation('original-key-123456')).status).toBe(status)
    }
    expect(evaluationPollMs(run)).toBe(10000)
    expect(evaluationPollMs({pollAfterSeconds:30})).toBe(30000)
  })
  test('server Retry-After controls polling and conflict carries real execution ID',async()=>{
    const api=createAlertsClient(async()=>Response.json(run,{headers:{'Retry-After':'30'}}),'https://example.test/api/v1')
    expect(evaluationPollMs(await api.evaluation('eval-1'))).toBe(30000)
    const conflict=createAlertsClient(async()=>Response.json({error:{code:'EVALUATION_IN_PROGRESS',message:'En curso',evaluationId:'existing-id'}},{status:409}),'https://example.test/api/v1')
    await expect(conflict.startEvaluation('original-key-123456')).rejects.toMatchObject({code:'EVALUATION_IN_PROGRESS',evaluationId:'existing-id'})
    const limit=createAlertsClient(async()=>Response.json({error:{code:'EVALUATION_RATE_LIMITED',message:'Espera',retryAfterSeconds:60}},{status:429}),'https://example.test/api/v1')
    await expect(limit.startEvaluation('original-key-123456')).rejects.toMatchObject({retryAfterMs:60000})
  })
  test('invalid acceptance is uncertain, never treated as a completed execution',async()=>{
    const api=createAlertsClient(async()=>Response.json({status:'SUCCEEDED'},{status:202}),'https://example.test/api/v1')
    await expect(api.startEvaluation('original-key-123456')).rejects.toMatchObject({code:'INVALID_RESPONSE'})
  })
  test('pending key/body is identity and project scoped and excludes unexpected stored fields',()=>{
    const key=pendingEvaluationStorageKey('project-a','admin-a')
    expect(key).not.toBe(pendingEvaluationStorageKey('project-b','admin-a'))
    expect(key).not.toBe(pendingEvaluationStorageKey('project-a','admin-b'))
    expect(readPendingEvaluation({getItem:()=>JSON.stringify({key:'original-key-123456',body:'{}',evaluationId:'eval-1',token:'not-preserved'})},key)).toEqual({key:'original-key-123456',body:'{}',evaluationId:'eval-1'})
    expect(()=>readPendingEvaluation({getItem:()=>JSON.stringify({key:'original-key-123456',body:'{"filters":1}'})},key)).toThrow()
  })
})