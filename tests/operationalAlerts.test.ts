import {describe,expect,test} from 'bun:test'
import {alertsAccess,alertsEntryAccess,actionSchemas,alertMoney,validateRuleUpdate,isAlertAssignee} from '../src/lib/operationalAlerts'
import {firstAllowedRoute} from '../src/lib/pageAccess'
import {createAlertsClient} from '../src/services/operationalAlertsApi'
import type {Usuario} from '../src/types/domain'
const user:Usuario={id:'admin',nombre:'Prueba',email:'test@example.test',rol:'ADMIN',roles:['ADMIN'],activo:true,pages:['DASHBOARD']}
describe('Operational alerts permissions',()=>{
  test('reassignment only lists active administrators and operations users with backend roles',()=>{
    const candidate={id:'candidate',fullName:'Prueba',email:'test@example.test',status:'active' as const}
    for(const name of ['ADMIN','administrador','Operaciones','OPERADOR']) expect(isAlertAssignee({...candidate,role:{name}})).toBe(true)
    for(const name of ['CALLCENTER','CUSTOMER','ALIANZAS','READONLY','ALIANZA_OPERADOR','OTRO']) expect(isAlertAssignee({...candidate,role:{name,pages:['ALERTAS_OPERATIVAS']}})).toBe(false)
    expect(isAlertAssignee({...candidate,role:{name:'CALLCENTER',normalizedName:'operador'}})).toBe(true)
    expect(isAlertAssignee({...candidate,role:{name:'ADMIN',normalizedName:'CUSTOMER'}})).toBe(false)
    expect(isAlertAssignee({...candidate,role:null})).toBe(false)
    expect(isAlertAssignee({...candidate,role:{label:'Administrador'}})).toBe(false)
    for(const status of ['inactive','invited','blocked'] as const) expect(isAlertAssignee({...candidate,status,role:{name:'ADMIN'}})).toBe(false)
    expect(isAlertAssignee({...candidate,email:'admin@callcenter.cl',role:{name:'ADMIN'}})).toBe(false)
    expect(isAlertAssignee({...candidate,id:undefined,role:{name:'ADMIN'}})).toBe(false)
    expect(isAlertAssignee({...candidate,id:undefined,_id:'mongo-id',role:{name:'ADMIN'}})).toBe(true)
  })
  test('alerts-only access opens Operación, never grants Dashboard',()=>{
    const operator:Usuario={...user,rol:'OPERACIONES',roles:['OPERADOR'],pages:['ALERTAS_OPERATIVAS']}
    expect(alertsEntryAccess(operator,'/operacion')).toBe(true)
    expect(alertsEntryAccess(operator,'/dashboard')).toBe(false)
    expect(firstAllowedRoute(operator.pages)).toBe('/operacion')
  })
  test('moving alerts preserves role exclusions at the new entry',()=>{
    expect(alertsEntryAccess({...user,rol:'CALLCENTER',roles:['CALLCENTER'],pages:['ALERTAS_OPERATIVAS']},'/operacion')).toBe(false)
    expect(alertsEntryAccess({...user,roles:['ADMIN']},'/operacion')).toBe(true)
    expect(alertsEntryAccess({...user,activo:false},'/operacion')).toBe(false)
  })
  test('ADMIN can access without dashboard grant',()=>expect(alertsAccess({...user,pages:[]}).allowed).toBe(true))
  test('OPERADOR needs explicit ALERTAS_OPERATIVAS, DASHBOARD alone is insufficient',()=>{
    expect(alertsAccess({...user,rol:'OPERACIONES',roles:['OPERADOR']}).allowed).toBe(false)
    expect(alertsAccess({...user,rol:'OPERACIONES',roles:['OPERADOR'],pages:['ALERTAS_OPERATIVAS']}).allowed).toBe(true)
    expect(alertsAccess({...user,rol:'OPERACIONES',roles:['OPERADOR'],pages:['ALERTAS_OPERATIVAS']}).admin).toBe(false)
  })
  test('excludes inactive, readonly, alliances and call center',()=>{
    expect(alertsAccess({...user,activo:false}).allowed).toBe(false)
    for(const rol of ['READONLY','ALIANZAS','CALLCENTER'] as const)expect(alertsAccess({...user,rol}).allowed).toBe(false)
    expect(alertsAccess({...user,email:'admin@callcenter.cl'}).allowed).toBe(false)
  })
  test('does not infer admin from mapped role or empty backend roles',()=>expect(alertsAccess({...user,roles:[]}).allowed).toBe(false))
})
describe('Operational review rules',()=>{
  test('comment requires text and maximum 2000 characters',()=>{
    expect(()=>actionSchemas.comments.parse({expectedVersion:1,comment:' ',requiresFollowUp:true})).toThrow()
    expect(()=>actionSchemas.comments.parse({expectedVersion:1,comment:'a'.repeat(2001),requiresFollowUp:true})).toThrow()
  })
  test('actor and bank changes cannot be submitted',()=>expect(()=>actionSchemas.claim.parse({expectedVersion:1,actor:'other'})).toThrow())
  test('version must be a JSON positive integer',()=>{
    expect(()=>actionSchemas.claim.parse({expectedVersion:'1'})).toThrow()
    expect(()=>actionSchemas.claim.parse({expectedVersion:1.5})).toThrow()
  })
  test('escalation requires safe HTTPS reference and destination',()=>{
    expect(()=>actionSchemas.resolve.parse({expectedVersion:2,comment:'Revisado',outcome:'ESCALATED'})).toThrow()
    for(const referenceUrl of ['http://tickets.test/case/1','https://tickets.test/case/1?account=123','https://u:p@tickets.test/case/1','https://tickets.test/case/1#account'])expect(()=>actionSchemas.resolve.parse({expectedVersion:2,comment:'Revisado',outcome:'ESCALATED',escalation:{destination:'Equipo',referenceUrl}})).toThrow()
  })
  test('null amounts remain unknown rather than zero',()=>{expect(alertMoney(null)).toBe('Monto desconocido');expect(alertMoney(0)).not.toBe('Monto desconocido')})
  test('R1 requires paidWindowDays and priority for activation',()=>expect(()=>validateRuleUpdate('SAME_RUT_MULTIPLE_ACCOUNTS',{expectedVersion:1,enabled:true,priority:null,parameters:{paidWindowDays:null}})).toThrow())
  test('R2 requires at least one approved monthly criterion',()=>expect(()=>validateRuleUpdate('SAME_RUT_MONTHLY_PAID_VOLUME',{expectedVersion:1,enabled:true,priority:'HIGH',parameters:{minPaidRequests:null,minTotalPaidAmountCLP:null}})).toThrow())
  test('R4 repetition requires paired fields',()=>expect(()=>validateRuleUpdate('BANK_ACCOUNT_CHANGE_NEAR_PAYMENT',{expectedVersion:1,enabled:false,priority:null,parameters:{nearPaymentHours:null,repeatedChangeDays:2,minChanges:null}})).toThrow())
  test('disabled rules preserve null parameters without numeric defaults',()=>expect(validateRuleUpdate('SAME_RUT_MONTHLY_PAID_VOLUME',{expectedVersion:1,enabled:false,priority:null,parameters:{minPaidRequests:null,minTotalPaidAmountCLP:null}}).parameters).toEqual({minPaidRequests:null,minTotalPaidAmountCLP:null}))
})
describe('Operational alerts transport',()=>{
  const meta={schemaVersion:'1.0',snapshotToken:'cut-1',evaluationStatus:'READY',stale:false,page:1,limit:25,total:0,totalPages:0}
  test('summary omits status, preserves civil dates; global count is server-provided',async()=>{
    let url='';const api=createAlertsClient(async(path)=>{url=path;return Response.json({totals:{pending:0,inReview:0,resolved:0,open:0},globalOpenCount:12,byPriority:{HIGH:0,MEDIUM:0,LOW:0},byRule:[],meta})},'https://example.test/api/v1')
    expect((await api.summary({from:'2026-11-01',status:'PENDING',sort:'PRIORITY_DESC'})).globalOpenCount).toBe(12)
    expect(url).toBe('/backoffice-alerts/summary?from=2026-11-01')
  })
  test('pagination sends 25 and common snapshot; uses metadata total',async()=>{
    let url='';const api=createAlertsClient(async(path)=>{url=path;return Response.json({data:[],meta:{...meta,total:41,totalPages:2}})},'https://example.test/api/v1')
    expect((await api.page('/alerts','cut-1',2)).meta.total).toBe(41)
    expect(url).toContain('snapshotToken=cut-1&page=2&limit=25')
  })
  test('rejects mixed snapshots',async()=>{
    const api=createAlertsClient(async()=>Response.json({data:[],meta}),'https://example.test/api/v1')
    await expect(api.page('/alerts','other')).rejects.toMatchObject({code:'INVALID_RESPONSE'})
  })
  test('expired snapshot and denied access are real errors, not empty lists',async()=>{
    for(const [status,code] of [[409,'SNAPSHOT_EXPIRED'],[403,'FORBIDDEN'],[503,'ALERT_EVALUATION_UNAVAILABLE']] as const){const api=createAlertsClient(async()=>Response.json({error:{code,message:'Test',requestId:'ref'}},{status}),'https://example.test/api/v1');await expect(api.summary({})).rejects.toMatchObject({status,code,requestId:'ref'})}
  })
  test('rate limit preserves Retry-After 60 seconds',async()=>{
    const api=createAlertsClient(async()=>Response.json({error:{code:'RATE_LIMITED',message:'Espera',requestId:'ref'}},{status:429,headers:{'Retry-After':'60'}}),'https://example.test/api/v1')
    await expect(api.summary({})).rejects.toMatchObject({status:429,retryAfterMs:60000})
  })
  test('same explicit write retry preserves key and body without automatic retries',async()=>{
    const seen:RequestInit[]=[];const api=createAlertsClient(async(_,init)=>{seen.push(init??{});return Response.json({id:'one'})},'https://example.test/api/v1')
    await api.action('one','claim',{expectedVersion:2},'same-key-12345678');await api.action('one','claim',{expectedVersion:2},'same-key-12345678')
    expect(seen).toHaveLength(2);expect(seen[0].body).toBe('{"expectedVersion":2}');expect(seen[0].headers).toEqual({'Idempotency-Key':'same-key-12345678'});expect(seen[0]).toEqual(seen[1])
  })
})