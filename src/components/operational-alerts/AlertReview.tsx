import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Tabs,TabsList,TabsTrigger,TabsContent } from '@/components/ui/tabs'
import { Select,SelectTrigger,SelectValue,SelectContent,SelectItem } from '@/components/ui/select'
import { AlertDialog,AlertDialogContent,AlertDialogHeader,AlertDialogTitle,AlertDialogDescription,AlertDialogFooter,AlertDialogCancel,AlertDialogAction } from '@/components/ui/alert-dialog'
import { ExternalLink, Loader2, UserCheck } from 'lucide-react'
import { AlertsApiError, operationalAlertsApi as api, type EvidenceItem, type HistoryItem } from '@/services/operationalAlertsApi'
import { actionSchemas, alertDate, alertMoney, ruleLabels,statusLabels,priorityLabels, type AlertAction } from '@/lib/operationalAlerts'
import { usersApi } from '@/pages/Usuarios/services/usersApi'
import { AlertDisclosure, AlertError, Pagination, SafeFields } from './AlertCommon'
import { AlertEvidence } from './AlertEvidenceComparison'
import { AlertTrigger } from './AlertTrigger'

// Draft and the exact uncertain request survive cut refreshes, but never a session change.
export function AlertReview({id,token,scope,admin,onClose,refresh,deny}:{id:string;token?:string;scope:string;admin:boolean;onClose:()=>void;refresh:()=>void;deny:()=>void}) {
  const [tab,setTab]=useState('requests')
  const [page,setPage]=useState(1)
  const [historyPage,setHistoryPage]=useState(1)
  const [comment,setComment]=useState('')
  const [followUp,setFollowUp]=useState(true)
  const [outcome,setOutcome]=useState('VALIDATED_NO_ANOMALY')
  const [destination,setDestination]=useState('')
  const [referenceUrl,setReferenceUrl]=useState('')
  const [assigneeId,setAssignee]=useState('')
  const [userSearch,setUserSearch]=useState('')
  const [userPage,setUserPage]=useState(1)
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState<Error|null>(null)
  const [conflict,setConflict]=useState<string|null>(null)
  const [confirmation,setConfirmation]=useState(false)
  const [success,setSuccess]=useState('')
  const pending=useRef<{action:AlertAction;body:unknown;key:string}|null>(null)
  const options={enabled:Boolean(token),retry:false as const,staleTime:Infinity,gcTime:0,refetchOnWindowFocus:false}
  const detail=useQuery({...options,queryKey:['operational-alerts',scope,token,id,'detail'],queryFn:({signal})=>api.detail(id,token??'',signal)})
  const requests=useQuery({...options,enabled:Boolean(token)&&tab==='requests',queryKey:['operational-alerts',scope,token,id,'requests',page],queryFn:({signal})=>api.page<EvidenceItem>(`/alerts/${id}/requests`,token??'',page,{},signal)})
  const history=useQuery({...options,enabled:Boolean(token)&&tab==='history',queryKey:['operational-alerts',scope,token,id,'history',historyPage],queryFn:({signal})=>api.page<HistoryItem>(`/alerts/${id}/history`,token??'',historyPage,{},signal)})
  const users=useQuery({queryKey:['operational-alerts',scope,'active-users',userSearch,userPage],queryFn:()=>usersApi.list({status:'active',search:userSearch,page:userPage,limit:25}),enabled:admin&&Boolean(detail.data?.actions?.canReassign),retry:false})
  const readError=detail.error??requests.error??history.error
  useEffect(()=>{ if(readError instanceof AlertsApiError) { if(readError.code==='SNAPSHOT_EXPIRED') refresh(); if([401,403].includes(readError.status)) deny() } },[readError])
  const a=detail.data
  async function execute(action:AlertAction,body:unknown,retry=false) {
    if (busy || !a || !token) return
    setBusy(true);setError(null);setSuccess('')
    try {
      const saved = retry ? pending.current : {action,body:actionSchemas[action].parse(body),key:crypto.randomUUID()}
      if (!saved) return
      pending.current=saved
      await api.action(id,saved.action,saved.body,saved.key)
      pending.current=null;setComment('');setSuccess('Revisión guardada. Se están consultando los resultados actualizados.');refresh()
    } catch(e) {
      const err=e instanceof Error?e:new Error('No se pudo guardar.')
      setError(err)
      if(err instanceof AlertsApiError) {
        if (err.status < 500) pending.current=null
        if(err.code==='ALERT_VERSION_CONFLICT' || err.code==='ALERT_ALREADY_ASSIGNED') {setConflict(token);refresh()}
        if(err.code==='SNAPSHOT_EXPIRED') {setConflict(token);refresh()}
        if([401,403].includes(err.status)) deny()
      } else if (!(err instanceof TypeError) && err.name !== 'AbortError' && err.name !== 'TimeoutError') pending.current=null
    } finally {setBusy(false);setConfirmation(false)}
  }
  const locked=busy||Boolean(pending.current)||Boolean(conflict)||!a||!token
  const body={expectedVersion:a?.version,comment}
  return <Sheet open onOpenChange={open=>{if(!open&&!busy&&!pending.current)onClose()}}><SheetContent className="w-full sm:max-w-4xl overflow-y-auto p-4 sm:p-6">
    <SheetHeader className="pr-8"><SheetTitle>{a?ruleLabels[a.ruleCode]:'Revisión de alerta'}</SheetTitle><SheetDescription>Revisión del caso · No modifica cuentas, solicitudes ni pagos.</SheetDescription></SheetHeader>
    <div className="mt-5 space-y-5">
      <AlertError error={readError} retry={refresh}/>
      {!a && !readError && <p role="status" className="flex gap-2"><Loader2 className="h-4 w-4 animate-spin"/>Cargando el caso…</p>}
      {success&&<p role="status" className="text-primary">{success}</p>}
      {a&&<>
        <div className="flex flex-wrap gap-2 text-sm font-medium"><span className="rounded border px-2 py-1">Prioridad {priorityLabels[a.priority]??'No definida'}</span><span className="rounded border px-2 py-1">{statusLabels[a.status]}</span></div>
        <AlertTrigger alert={a}/>
        <div className="space-y-2"><p className="text-sm">Responsable: <strong>{a.assignedTo?.name??a.assignedTo?.id??'Sin asignar'}</strong> · {alertDate(a.assignedAt)}</p><p className="text-xs text-muted-foreground">Primera detección: {alertDate(a.firstDetectedAt)} · Última detección: {alertDate(a.lastDetectedAt)}</p><p className="text-sm">Situación detectada: {a.conditionActive?'Sigue presente':'Ya no está presente'}{a.requiresFollowUp?' · Requiere seguimiento':''}</p>{a.resolvedAt&&<p className="text-sm">Resuelta por {a.resolvedBy?.name??a.resolvedBy?.id??'No disponible'} · {alertDate(a.resolvedAt)}</p>}{a.resolutionComment&&<p className="text-sm">Conclusión: {a.resolutionComment}</p>}</div>
        {a.conditionEvaluation==='INCOMPLETE'&&<p role="alert" className="border-l-4 border-destructive pl-3 text-sm">Faltan datos para confirmar si la situación sigue presente. Se conserva el último resultado disponible.</p>}
        {a.previousAlertId&&<Button variant="link" className="px-0" onClick={()=>{onClose();window.dispatchEvent(new CustomEvent('open-operational-alert',{detail:a.previousAlertId}))}}>Ver el caso anterior relacionado</Button>}
        <section className="border-y py-3"><AlertDisclosure title="Criterios del análisis y datos disponibles"><div className="space-y-3"><SafeFields value={a.thresholds??{}}/><SafeFields value={a.conditions??{}}/><SafeFields value={a.changeConditions??{}}/>{a.limitations?.map((v,i)=><p key={i} className="text-sm text-muted-foreground">{v}</p>)}{a.changeEventsTruncated&&<p role="alert" className="text-destructive text-sm">Historial parcial: se muestran {a.changeEvents?.length??0} de {a.changeEventCount}. Hay más cambios que no se muestran aquí.</p>}{a.changeEvents?.map((v,i)=><SafeFields key={i} value={v}/>)}</div></AlertDisclosure></section>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 border-y py-3 text-sm"><div><p className="text-xs text-muted-foreground">Solicitudes relacionadas</p><p className="font-semibold mt-1">{a.relatedRequestCount}</p></div><div><p className="text-xs text-muted-foreground">Cuentas distintas detectadas</p><p className="font-semibold mt-1">{a.distinctAccountCount??'No informado'}</p></div><div><p className="text-xs text-muted-foreground">Monto registrado al detectar</p><p className="font-semibold mt-1">{alertMoney(a.knownTotalAmountCLP)}</p>{!a.isAmountTotalComplete&&<p className="text-xs text-destructive">Monto parcial · {a.missingAmountCount} sin monto</p>}</div></div>
        {a.missingAccountCount>0&&<p role="alert" className="text-sm text-destructive">{a.missingAccountCount} solicitudes sin datos de cuenta completos.</p>}
        <Tabs value={tab} onValueChange={setTab}><TabsList className="w-full sm:w-auto h-auto"><TabsTrigger className="flex-1 whitespace-normal" value="requests">Solicitudes ({a.relatedRequestCount})</TabsTrigger><TabsTrigger className="flex-1 whitespace-normal" value="history">Historial de revisión</TabsTrigger></TabsList>
          <TabsContent value="requests" className="space-y-4"><div className="space-y-1"><p className="text-xs text-muted-foreground">El estado Pagado no confirma una transferencia bancaria. Los números están ocultos parcialmente; terminaciones iguales no prueban que sea la misma cuenta.</p></div>{requests.isLoading&&<p role="status">Cargando solicitudes…</p>}{requests.data?.data.map((r,i)=><article key={r.publicId} className="border rounded-md p-3 sm:p-4 space-y-3"><header className="space-y-1 min-w-0"><p className="text-xs text-muted-foreground">Solicitud {(page-1)*25+i+1}</p><Link target="_blank" rel="noopener noreferrer" to={`/solicitudes/${encodeURIComponent(r.publicId)}`} className="text-primary font-medium inline-flex items-center gap-2 max-w-full"><span className="min-w-0 break-words">{r.evidenceAtDetection.fullName??r.publicId}</span><ExternalLink className="h-4 w-4 shrink-0"/><span className="sr-only">Abrir solicitud en otra pestaña</span></Link><p className="text-sm">RUT: {r.evidenceAtDetection.rut??'No informado'}</p><p className="text-xs text-muted-foreground break-all">N.º de solicitud: {r.publicId}</p></header><AlertEvidence detected={r.evidenceAtDetection}/></article>)}{requests.data?.data.length===0&&<p className="py-4 text-sm text-muted-foreground">No hay solicitudes disponibles en este caso.</p>}{requests.data&&<Pagination page={page} total={requests.data.meta.total} totalPages={requests.data.meta.totalPages} onChange={setPage} disabled={requests.isFetching}/>}</TabsContent>
          <TabsContent value="history" className="space-y-3">{history.isLoading&&<p>Cargando historial…</p>}{history.data?.data.map(h=><article key={h.id} className="border-l-2 pl-3 py-2"><p className="font-medium text-sm">{historyLabels[h.type]??h.type}</p><p className="text-xs text-muted-foreground">{alertDate(h.at)} · {h.actor?.name??h.actor?.id??'Sistema'}</p><SafeFields value={h.data}/></article>)}{history.data&&<Pagination page={historyPage} total={history.data.meta.total} totalPages={history.data.meta.totalPages} onChange={setHistoryPage}/>}</TabsContent>
        </Tabs>
        <section className="border-t pt-4 space-y-3"><h3 className="font-semibold">Revisión del caso</h3>
          <AlertError error={error} retry={refresh}/>
          {conflict&&<div role="alert" className="space-y-2 text-sm"><p>El caso cambió. Conservamos tu borrador; revisa responsable y los datos antes de continuar.</p><Button variant="outline" disabled={token===conflict||detail.isFetching} onClick={()=>{setConflict(null);setError(null)}}>Ya revisé los datos actualizados</Button></div>}
          {pending.current&&<div role="alert" className="space-y-2 text-sm"><p>No se pudo confirmar si el cambio se guardó. Consulta el caso antes de continuar; si repites, se conserva la misma operación para evitar duplicados.</p><Button disabled={busy} variant="outline" onClick={refresh}>Consultar estado</Button><Button disabled={busy} onClick={()=>{const p=pending.current;if(p)void execute(p.action,p.body,true)}}>Repetir la misma acción</Button><Button disabled={busy||detail.isFetching} variant="ghost" onClick={()=>{pending.current=null;setConflict(token??null);setError(null);refresh()}}>Revisar antes de una nueva acción</Button></div>}
          {a.actions?.canClaim&&<Button disabled={locked} onClick={()=>void execute('claim',{expectedVersion:a.version})}><UserCheck className="h-4 w-4 mr-2"/>Tomar caso</Button>}
          {(a.actions?.canComment||a.actions?.canResolve||admin&&a.actions?.canReassign)&&<><label className="block text-sm">Observación<Textarea aria-label="Observación de revisión" maxLength={2000} value={comment} disabled={busy||Boolean(pending.current)} onChange={e=>setComment(e.target.value)} className="mt-1"/></label><p className="text-xs text-muted-foreground">{comment.length}/2.000 · No incluyas cuentas completas.</p></>}
          {a.actions?.canComment&&<><label className="flex items-center gap-2 text-sm"><Checkbox checked={followUp} disabled={locked} onCheckedChange={v=>setFollowUp(v===true)}/>Requiere seguimiento</label><Button variant="outline" disabled={locked||!comment.trim()} onClick={()=>void execute('comments',{...body,requiresFollowUp:followUp})}>Guardar observación</Button></>}
          {a.actions?.canResolve&&<div className="space-y-3"><Select value={outcome} onValueChange={setOutcome} disabled={locked}><SelectTrigger aria-label="Resultado de revisión"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="VALIDATED_NO_ANOMALY">Validada y justificada</SelectItem><SelectItem value="ERROR_CORRECTED">Corregida fuera de la alerta</SelectItem><SelectItem value="ESCALATED">Derivada a otro equipo</SelectItem></SelectContent></Select>{outcome==='ESCALATED'&&<><Input aria-label="Destino de escalamiento" placeholder="Destino" value={destination} onChange={e=>setDestination(e.target.value)} disabled={locked}/><Input aria-label="Referencia HTTPS" placeholder="Enlace de referencia autorizado (https://)" value={referenceUrl} onChange={e=>setReferenceUrl(e.target.value)} disabled={locked}/><p className="text-xs text-muted-foreground">Si no tienes un enlace autorizado, guarda una observación y mantén el caso en revisión.</p></>}<Button disabled={locked||!comment.trim()} onClick={()=>setConfirmation(true)}>Resolver alerta</Button></div>}
          {admin&&a.actions?.canReassign&&<div className="space-y-3 border-t pt-3"><h4 className="font-medium text-sm">Reasignar responsable</h4><Input aria-label="Buscar responsable activo" placeholder="Buscar usuario activo" value={userSearch} onChange={e=>{setUserSearch(e.target.value);setUserPage(1)}}/><AlertError error={users.error} retry={()=>void users.refetch()}/><Select value={assigneeId} onValueChange={setAssignee} disabled={locked}><SelectTrigger aria-label="Nuevo responsable"><SelectValue placeholder="Selecciona usuario activo"/></SelectTrigger><SelectContent>{users.data?.data.filter(u=>u.status==='active'&&Boolean(u.id??u._id)).map(u=><SelectItem key={u.id??u._id} value={u.id??u._id??''}>{u.fullName} · {u.email}</SelectItem>)}</SelectContent></Select>{users.data&&<Pagination page={userPage} total={users.data.pagination.total} totalPages={users.data.pagination.totalPages} onChange={setUserPage}/>}<p className="text-xs text-muted-foreground">El responsable debe tener permiso para revisar alertas.</p><Button variant="outline" disabled={locked||!assigneeId||!comment.trim()} onClick={()=>void execute('reassign',{expectedVersion:a.version,assigneeId,reason:comment})}>Reasignar caso</Button></div>}
        </section>
      </>}
    </div>
    <AlertDialog open={confirmation} onOpenChange={setConfirmation}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>¿Confirmar resolución?</AlertDialogTitle><AlertDialogDescription>Se cerrará la revisión de esta alerta. No se modificarán solicitudes ni pagos.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Volver</AlertDialogCancel><AlertDialogAction onClick={()=>void execute('resolve',{...body,outcome,...(outcome==='ESCALATED'?{escalation:{destination,referenceUrl}}:{})})}>Confirmar resolución</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </SheetContent></Sheet>
}
const historyLabels:Record<string,string>={DETECTED:'Detectada',DETECTED_AGAIN:'Detectada nuevamente',EVIDENCE_UPDATED:'Evidencia actualizada',CONDITION_INACTIVE:'Condición inactiva',EVALUATION_INCOMPLETE:'Evaluación incompleta',RECURRENCE:'Recurrencia',CLAIMED:'Caso tomado',COMMENTED:'Observación registrada',REASSIGNED:'Reasignación',RESOLVED:'Resuelta'}