import { useEffect,useRef,useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Select,SelectTrigger,SelectValue,SelectContent,SelectItem } from '@/components/ui/select'
import { AlertDialog,AlertDialogContent,AlertDialogHeader,AlertDialogTitle,AlertDialogDescription,AlertDialogFooter,AlertDialogCancel,AlertDialogAction } from '@/components/ui/alert-dialog'
import { operationalAlertsApi as api,AlertsApiError,type AlertRule } from '@/services/operationalAlertsApi'
import { ruleLabels,ruleFields,fieldLabels,validateRuleUpdate } from '@/lib/operationalAlerts'
import { AlertError } from './AlertCommon'

export function AlertRules({scope,refresh,deny}:{scope:string;refresh:()=>void;deny:()=>void}) {
  const q=useQuery({queryKey:['operational-alerts',scope,'rules'],queryFn:({signal})=>api.rules(signal),retry:false})
  useEffect(()=>{if(q.error instanceof AlertsApiError&&[401,403].includes(q.error.status))deny()},[q.error])
  if(q.error instanceof AlertsApiError&&[401,403].includes(q.error.status)) return <AlertError error={q.error} retry={deny}/>
  return <section className="space-y-4"><h2 className="text-lg font-semibold">Configuración de reglas</h2><p className="text-sm text-muted-foreground">La revisión inicial y el análisis automático están a cargo del equipo técnico.</p><AlertError error={q.error} retry={()=>void q.refetch()}/>{q.isLoading&&<p>Cargando reglas…</p>}{q.data?.data.map(rule=><RuleForm key={rule.ruleCode} rule={rule} refresh={refresh} reload={()=>void q.refetch()}/>)}</section>
}
function RuleForm({rule,refresh,reload}:{rule:AlertRule;refresh:()=>void;reload:()=>void}) {
  const [enabled,setEnabled]=useState(rule.enabled)
  const [priority,setPriority]=useState(rule.priority??'none')
  const [parameters,setParameters]=useState<Record<string,string>>(()=>Object.fromEntries(ruleFields[rule.ruleCode].map(k=>[k,rule.parameters[k]==null?'':String(rule.parameters[k])])))
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState<Error|null>(null)
  const [conflict,setConflict]=useState(false)
  const [reviewedVersion,setReviewedVersion]=useState(rule.version)
  const [saved,setSaved]=useState(false)
  const [confirm,setConfirm]=useState(false)
  const pending=useRef<{body:unknown;key:string}|null>(null)
  async function save(retry=false) {
    setBusy(true);setError(null)
    try {
      const request=retry?pending.current:{body:validateRuleUpdate(rule.ruleCode,{expectedVersion:reviewedVersion,enabled,priority:priority==='none'?null:priority,parameters:Object.fromEntries(Object.entries(parameters).map(([k,v])=>[k,v===''?null:Number(v)]))}),key:crypto.randomUUID()}
      if(!request)return
      pending.current=request
      const updated=await api.updateRule(rule.ruleCode,request.body,request.key)
      setReviewedVersion(updated.version);setSaved(true);pending.current=null;refresh();reload()
    }catch(e){const err=e instanceof Error?e:new Error('No se pudo guardar.');setError(err);if(err instanceof AlertsApiError){if(err.status<500)pending.current=null;if(err.status===409){setConflict(true);reload()}}else if(!(err instanceof TypeError)&&!['TimeoutError','AbortError'].includes(err.name))pending.current=null}
    finally{setBusy(false);setConfirm(false)}
  }
  return <form onSubmit={e=>{e.preventDefault();setConfirm(true)}} className="border-t pt-4 space-y-3">
    <div className="flex flex-wrap gap-3 items-center justify-between"><h3 className="font-semibold">{ruleLabels[rule.ruleCode]}</h3><label className="flex gap-2 text-sm items-center"><Switch checked={enabled} disabled={busy||conflict||Boolean(pending.current)} onCheckedChange={setEnabled}/>{enabled?'Activada':'Desactivada'}</label></div>
    {['SAME_ACCOUNT_MULTIPLE_RUTS','BANK_ACCOUNT_CHANGE_NEAR_PAYMENT'].includes(rule.ruleCode)&&<p className="text-sm text-destructive">Esta alerta requiere una aprobación adicional antes de activarla. Si revisa cambios de cuenta, el equipo técnico debe confirmar las fechas efectivas de esos cambios.</p>}
    <div className="grid sm:grid-cols-3 gap-3"><label className="text-sm">Prioridad<Select value={priority} onValueChange={setPriority} disabled={busy||conflict||Boolean(pending.current)}><SelectTrigger aria-label={`Prioridad ${ruleLabels[rule.ruleCode]}`}><SelectValue/></SelectTrigger><SelectContent><SelectItem value="none">Sin aprobar</SelectItem><SelectItem value="HIGH">Alta</SelectItem><SelectItem value="MEDIUM">Media</SelectItem><SelectItem value="LOW">Baja</SelectItem></SelectContent></Select></label>{ruleFields[rule.ruleCode].map(k=><label key={k} className="text-sm">{fieldLabels[k]}<Input type="number" step="1" value={parameters[k]} aria-label={`${fieldLabels[k]} ${ruleLabels[rule.ruleCode]}`} placeholder="Sin aprobar" disabled={busy||conflict||Boolean(pending.current)} onChange={e=>setParameters(p=>({...p,[k]:e.target.value}))}/></label>)}</div>
    {saved&&<p role="status" className="text-sm text-primary">Configuración guardada.</p>}
    <AlertError error={error} retry={reload}/>{conflict&&<div role="alert" className="text-sm space-y-2"><p>La regla cambió. Conservamos el borrador; revisa la configuración vigente antes de continuar.</p><p>Versión {rule.version} · {rule.enabled?'Activada':'Desactivada'} · Prioridad {rule.priority??'Sin aprobar'}</p>{Object.entries(rule.parameters).map(([k,v])=><p key={k}>{fieldLabels[k]??k}: {v??'Sin aprobar'}</p>)}<Button type="button" variant="outline" disabled={busy||rule.version===reviewedVersion} onClick={()=>{setReviewedVersion(rule.version);setConflict(false);setError(null)}}>Ya revisé la configuración actualizada</Button></div>}
    {pending.current&&<div role="alert" className="text-sm space-y-2"><p>No se pudo confirmar si se guardó. Consulta la configuración antes de continuar; al repetir se conserva la misma operación para evitar duplicados.</p><Button type="button" disabled={busy} onClick={()=>void save(true)}>Repetir la misma acción</Button><Button type="button" variant="outline" disabled={busy} onClick={reload}>Consultar configuración</Button></div>}
    <Button disabled={busy||conflict||Boolean(pending.current)} type="submit">Guardar configuración</Button>
    <AlertDialog open={confirm} onOpenChange={setConfirm}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>¿Guardar configuración de la regla?</AlertDialogTitle><AlertDialogDescription>{enabled?'Confirma que estos parámetros y la prioridad fueron aprobados por negocio.':'La regla permanecerá desactivada.'} Guardar no inicia un análisis inmediato.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Volver</AlertDialogCancel><AlertDialogAction onClick={()=>void save()}>Confirmar</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </form>
}