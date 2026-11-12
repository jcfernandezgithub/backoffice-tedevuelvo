import {describe,expect,test} from 'bun:test'
import {alertConditionStatus} from '../src/lib/alertConditionPresentation'
import {createAlertsClient,type OperationalAlert} from '../src/services/operationalAlertsApi'

describe('Server-owned current alert condition',()=>{
  test('conditionActive alone never confirms the current situation',()=>{
    for (const conditionActive of [true,false]) {
      const legacy={conditionStatus:undefined,conditionActive}
      expect(alertConditionStatus(legacy)).toBeNull()
    }
  })
  for(const conditionStatus of ['CONFIRMED_ACTIVE','CONFIRMED_INACTIVE','INCOMPLETE','PENDING_REEVALUATION','RULE_DISABLED'] as const) {
    test(`${conditionStatus} is authoritative independently of the historical boolean`,()=>{
      for(const conditionActive of [true,false]) {
        const alert={conditionStatus,conditionActive}
        expect(alertConditionStatus(alert)).toBe(conditionStatus)
      }
    })
  }
  const meta={schemaVersion:'1.0',snapshotToken:'updated-cut',evaluationStatus:'READY',stale:false,page:1,limit:25,total:1,totalPages:1}
  test('uncertain-condition filters are sent to both summary and list',async()=>{
    const paths:string[]=[]
    const api=createAlertsClient(async path=>{
      paths.push(path)
      return Response.json(path.includes('/summary')?{totals:{pending:1,inReview:0,resolved:0,open:1},globalOpenCount:1,byPriority:{HIGH:1,MEDIUM:0,LOW:0},byRule:[],meta}:{data:[],meta})
    },'https://example.test/api/v1')
    await api.summary({conditionStatus:'PENDING_REEVALUATION',status:'PENDING'})
    await api.page('/alerts','updated-cut',1,{conditionStatus:'PENDING_REEVALUATION',status:'PENDING'})
    expect(paths[0]).toBe('/backoffice-alerts/summary?conditionStatus=PENDING_REEVALUATION')
    expect(paths[1]).toContain('conditionStatus=PENDING_REEVALUATION')
    expect(paths.every(path=>!path.includes('conditionActive='))).toBe(true)
  })
  test('case remains Pending while inactive; historical and evaluation versions stay separate',async()=>{
    const id='16237f66-877d-45ae-b583-5ce31e2553c7'
    const record={id,version:4,status:'PENDING',conditionStatus:'CONFIRMED_INACTIVE',conditionActive:false,ruleVersion:'2',priority:'HIGH',currentRule:{version:4,priority:'MEDIUM',parameters:{minPaidRequests:2,minTotalPaidAmountCLP:1000000}},lastEvaluation:{ruleVersion:'4',result:'INACTIVE',metrics:{count:1,knownAmountCLP:801583}},actions:{canClaim:true},meta}
    const api=createAlertsClient(async()=>Response.json(record),'https://example.test/api/v1')
    const alert:OperationalAlert=await api.detail(id,'updated-cut')
    expect(alertConditionStatus(alert)).toBe('CONFIRMED_INACTIVE')
    expect(alert.status).toBe('PENDING')
    expect(alert.ruleVersion).toBe('2')
    expect(alert.priority).toBe('HIGH')
    expect(alert.currentRule?.version).toBe(4)
    expect(alert.currentRule?.parameters.minTotalPaidAmountCLP).toBe(1000000)
    expect(alert.lastEvaluation?.ruleVersion).toBe('4')
    expect(alert.lastEvaluation?.metrics).toEqual({count:1,knownAmountCLP:801583})
  })
})