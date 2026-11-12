import { useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { operationalAlertsApi as api, AlertsApiError, type EvaluationRun } from '@/services/operationalAlertsApi'
import { evaluationIsActive, evaluationPollMs, readPendingEvaluation, type PendingEvaluation } from '@/lib/manualAlertEvaluation'

// Mounted with an identity/permission key by the ADMIN-only view.
export function useManualAlertEvaluation({scope,storageKey,refresh,deny}:{scope:string;storageKey:string;refresh:()=>Promise<void>;deny:()=>void}) {
  const client=useQueryClient()
  const [pending,setPending]=useState<PendingEvaluation|null>(null)
  const [storageReady,setStorageReady]=useState(false)
  const [id,setId]=useState<string|null>(null)
  const [sending,setSending]=useState(false)
  const [error,setError]=useState<Error|null>(null)
  const [waitUntil,setWaitUntil]=useState(0)
  const [waiting,setWaiting]=useState(false)
  const [reserved,setReserved]=useState(false)
  const [denied,setDenied]=useState(false)
  const inFlight=useRef(false)
  const cooldownUntil=useRef(0)
  const mounted=useRef(true)
  const completed=useRef(new Set<string>())
  const prefix=['operational-alert-evaluations',scope]
  useEffect(()=>{
    mounted.current=true
    try {const saved=readPendingEvaluation(localStorage,storageKey);setPending(saved);setId(saved?.evaluationId??null);setStorageReady(true)} catch(e){setError(e instanceof Error?e:new Error('No se pudo recuperar la petición pendiente.'))}
    return ()=>{mounted.current=false;void client.cancelQueries({queryKey:prefix});client.removeQueries({queryKey:prefix})}
  },[scope,storageKey,client])
  const recovery=useQuery({queryKey:[...prefix,'recovery'],queryFn:({signal})=>api.recoverEvaluations(signal),enabled:storageReady&&!denied,retry:false,gcTime:0,refetchOnWindowFocus:false,staleTime:Infinity})
  useEffect(()=>{
    if(!recovery.data)return
    const recovered=recovery.data.active
    if(recovered){setReserved(false);setId(recovered.evaluationId)}
    else if(!pending?.evaluationId)setId(recovery.data.latestRequestedByMe?.evaluationId??null)
  },[recovery.data])
  const job=useQuery({queryKey:[...prefix,'job',id],queryFn:({signal})=>api.evaluation(id??'',signal),enabled:storageReady&&!denied&&Boolean(id),retry:false,gcTime:0,refetchOnWindowFocus:false,
    refetchInterval:q=>!q.state.error&&evaluationIsActive(q.state.data)?evaluationPollMs(q.state.data):false,
  })
  const run=job.data ?? (recovery.data?.active?.evaluationId===id?recovery.data.active:recovery.data?.latestRequestedByMe?.evaluationId===id?recovery.data.latestRequestedByMe:null)
  const queryError=job.error??recovery.error
  const currentError=error??queryError
  useEffect(()=>{
    if(!(currentError instanceof AlertsApiError))return
    if([401,403].includes(currentError.status)){setDenied(true);void client.cancelQueries({queryKey:prefix});client.removeQueries({queryKey:prefix});deny()}
    if(currentError.retryAfterMs>0){cooldownUntil.current=Date.now()+currentError.retryAfterMs;setWaiting(true);setWaitUntil(cooldownUntil.current)}
  },[currentError])
  useEffect(()=>{
    const remaining=waitUntil-Date.now()
    setWaiting(remaining>0)
    if(remaining<=0)return
    const timer=setTimeout(()=>setWaiting(false),remaining)
    return ()=>clearTimeout(timer)
  },[waitUntil])
  useEffect(()=>{
    if(!run||evaluationIsActive(run))return
    if(pending?.evaluationId===run.evaluationId){
      try{localStorage.removeItem(storageKey);setPending(null)}catch{setError(new Error('No se pudo liberar la petición guardada. Consulta su estado antes de solicitar otra.'))}
    }
    if(run.status==='SUCCEEDED'&&!completed.current.has(run.evaluationId)){
      completed.current.add(run.evaluationId)
      void refresh()
    }
  },[run,pending,storageKey])
  const recover=async()=>{
    if(waiting||Date.now()<cooldownUntil.current||denied)return
    setError(null)
    const recovered=await recovery.refetch()
    if(!recovered.error)setReserved(false)
    if(id)await job.refetch()
  }
  const start=async()=>{
    if(inFlight.current||waiting||Date.now()<cooldownUntil.current||denied||!storageReady||recovery.isPending||recovery.error||job.error||evaluationIsActive(run)||reserved)return
    inFlight.current=true;setSending(true);setError(null)
    let request=pending
    try{
      request=request??{key:crypto.randomUUID(),body:'{}'}
      localStorage.setItem(storageKey,JSON.stringify(request))
      setPending(request)
      const accepted=await api.startEvaluation(request.key)
      // Persist acceptance even if the user has navigated away; never store session tokens.
      localStorage.setItem(storageKey,JSON.stringify({...request,evaluationId:accepted.evaluationId}))
      if(!mounted.current)return
      setPending({...request,evaluationId:accepted.evaluationId});setId(accepted.evaluationId)
      client.setQueryData([...prefix,'job',accepted.evaluationId],accepted)
    }catch(e){
      if(!mounted.current)return
      const failure=e instanceof Error?e:new Error('No se pudo confirmar el inicio de la evaluación.')
      if(failure instanceof AlertsApiError&&failure.retryAfterMs>0){cooldownUntil.current=Date.now()+failure.retryAfterMs;setWaiting(true);setWaitUntil(cooldownUntil.current)}
      setError(failure)
      if(failure instanceof AlertsApiError){
        if(failure.code==='EVALUATION_IN_PROGRESS'){
          // This request was rejected; following somebody else's job is not an acceptance.
          localStorage.removeItem(storageKey);setPending(null);setReserved(!failure.evaluationId)
          if(failure.evaluationId)setId(failure.evaluationId)
          await recovery.refetch()
        }else if([401,403,422,429].includes(failure.status)){
          localStorage.removeItem(storageKey);setPending(null)
        }
        // Network/503/invalid replies and idempotency conflicts retain the original key.
      }
    }finally{inFlight.current=false;if(mounted.current)setSending(false)}
  }
  return {run,pending,sending,error:currentError,waiting,reserved,recover,start,
    loading:recovery.isPending||job.isFetching,blocked:!storageReady||denied||sending||waiting||reserved||error instanceof AlertsApiError&&error.code==='IDEMPOTENCY_CONFLICT'||recovery.isPending||Boolean(recovery.error)||Boolean(job.error)||evaluationIsActive(run)}
}