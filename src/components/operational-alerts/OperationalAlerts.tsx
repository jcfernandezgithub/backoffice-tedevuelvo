import { useEffect,useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select,SelectTrigger,SelectValue,SelectContent,SelectItem } from '@/components/ui/select'
import { Table,TableHeader,TableBody,TableRow,TableHead,TableCell } from '@/components/ui/table'
import { RefreshCw,ShieldAlert,Settings2,Loader2,Search,SlidersHorizontal } from 'lucide-react'
import { useOperationalAlerts } from '@/hooks/useOperationalAlerts'
import { alertDate,alertMoney,defaultAlertFilters,priorityLabels,ruleLabels,statusLabels } from '@/lib/operationalAlerts'
import type { AlertFilters } from '@/services/operationalAlertsApi'
import { alertConditionLabel, conditionLabels } from '@/lib/alertConditionPresentation'
import { AlertReview } from './AlertReview'
import { AlertRules } from './AlertRules'
import { ManualAlertEvaluation } from './ManualAlertEvaluation'
import { AlertError,AlertMetadata,Pagination } from './AlertCommon'
import { AlertOverview } from './AlertOverview'

export function OperationalAlerts() {
  const [filters,setFilters]=useState<AlertFilters>(()=>({...defaultAlertFilters}))
  const [page,setPage]=useState(1)
  const [search,setSearch]=useState('')
  const [selected,setSelected]=useState<string|null>(null)
  const [rules,setRules]=useState(false)
  const [advanced,setAdvanced]=useState(false)
  const h=useOperationalAlerts(filters,page)
  const update=(key:keyof AlertFilters,value:string)=>{setFilters(f=>({...f,[key]:value==='all'?'':value}));setPage(1)}
  useEffect(()=>{const listener=(e:Event)=>setSelected((e as CustomEvent<string>).detail);window.addEventListener('open-operational-alert',listener);return()=>window.removeEventListener('open-operational-alert',listener)},[])
  if(!h.allowed)return <p role="alert" className="border-l-4 border-destructive pl-4 py-3">No tienes acceso a alertas operativas.</p>
  const s=h.summary.data
  return <section className="space-y-5 min-w-0">
    <header className="flex flex-wrap gap-3 items-center"><div className="flex items-center gap-3 min-w-0"><ShieldAlert className="h-6 w-6 shrink-0 text-primary"/><div className="min-w-0"><h2 className="font-semibold text-xl">Alertas operativas</h2><p className="text-sm text-muted-foreground">Revisión de movimientos · Los pagos no se bloquean automáticamente</p></div></div><div className="sm:ml-auto flex flex-wrap gap-2">{h.admin&&<Button variant="outline" onClick={()=>setRules(v=>!v)}><Settings2 className="h-4 w-4 mr-2"/>{rules?'Volver a los casos':'Configurar alertas'}</Button>}<Button variant="outline" disabled={h.summary.isFetching||h.list.isFetching} onClick={h.refresh}><RefreshCw className="h-4 w-4 mr-2"/>Consultar novedades</Button></div></header>
    {h.admin&&<ManualAlertEvaluation scope={h.scope} detectorEnabled={s?.meta.detectorEnabled} refresh={h.refresh} deny={h.deny}/>}
    {rules?<AlertRules scope={h.scope} refresh={h.refresh} deny={h.deny}/>:<>
      {s&&<>
        <AlertMetadata meta={s.meta}/>
        <AlertOverview summary={s} filters={filters} onStatus={v=>update('status',v)} onRule={v=>update('ruleCode',v)}/>
      </>}
      <form className="space-y-4 border-t pt-4" onSubmit={e=>{e.preventDefault();update('search',search.trim())}}>
        <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">Casos para revisar</h3><Button type="button" variant="ghost" size="sm" onClick={()=>{setFilters({...defaultAlertFilters});setSearch('');setPage(1)}}>Restablecer filtros</Button></div>
        <div className="flex gap-2"><Input className="flex-1 min-w-0" aria-label="Buscar alertas" maxLength={120} placeholder="Buscar por nombre, RUT o número de solicitud" value={search} onChange={e=>setSearch(e.target.value)}/><Button type="submit" variant="outline"><Search className="h-4 w-4 sm:mr-2"/><span className="hidden sm:inline">Buscar</span><span className="sr-only sm:hidden">Buscar</span></Button></div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3"><Filter label="Estado de revisión" value={filters.status} change={v=>update('status',v)} options={statusLabels}/><Filter label="Tipo de alerta" value={filters.ruleCode} change={v=>update('ruleCode',v)} options={ruleLabels}/><Filter label="Prioridad" value={filters.priority} change={v=>update('priority',v)} options={priorityLabels}/><Filter label="Situación detectada" value={filters.conditionStatus} change={v=>update('conditionStatus',v)} options={conditionLabels}/></div>
        <Button type="button" variant="ghost" size="sm" className="gap-2 px-0" aria-expanded={advanced} aria-controls="alert-extra-filters" onClick={()=>setAdvanced(v=>!v)}><SlidersHorizontal className="h-4 w-4"/>{advanced?'Ocultar filtros adicionales':'Más filtros'}{[filters.from,filters.to,filters.assigneeId].filter(Boolean).length>0&&<Badge variant="secondary">{[filters.from,filters.to,filters.assigneeId].filter(Boolean).length}</Badge>}</Button>
        {advanced&&<div id="alert-extra-filters" className="space-y-3"><div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3"><label className="text-sm space-y-1 block">Última detección desde<Input aria-label="Alertas desde" type="date" value={filters.from??''} max={filters.to||undefined} onChange={e=>update('from',e.target.value)}/></label><label className="text-sm space-y-1 block">Última detección hasta<Input aria-label="Alertas hasta" type="date" value={filters.to??''} min={filters.from||undefined} onChange={e=>update('to',e.target.value)}/></label><Filter label="Ordenar por" value={filters.sort} change={v=>update('sort',v)} options={{PRIORITY_DESC:'Mayor prioridad',DETECTED_DESC:'Más recientes'}}/><label className="text-sm space-y-1 block">Identificador del responsable<Input aria-label="Filtrar responsable" placeholder="Identificador de usuario" value={filters.assigneeId??''} onChange={e=>update('assigneeId',e.target.value)}/></label></div><p className="text-xs text-muted-foreground">Las fechas corresponden a la detección de la alerta, no a la creación de la solicitud ni al pago.</p></div>}
      </form>
      <AlertError error={h.error} retry={h.refresh}/>
      {(h.summary.isLoading||h.list.isLoading)&&<p role="status" className="flex items-center gap-2 text-sm"><Loader2 className="h-4 w-4 animate-spin"/>Consultando alertas…</p>}
      {!h.error&&h.list.data&&<><Table horizontalScroll><TableHeader><TableRow>{['Alerta y situación','Cliente y RUT','Antecedentes','Monto registrado','Período y detección','Revisión',''].map((v,i)=><TableHead key={i}>{v}</TableHead>)}</TableRow></TableHeader><TableBody>{h.list.data.data.map(a=><TableRow key={a.id}><TableCell className="min-w-60 max-w-80 whitespace-normal"><Badge variant={a.priority==='HIGH'?'destructive':'secondary'}>Detección · {priorityLabels[a.priority]??'Sin definir'}</Badge><p className="font-medium mt-2">{ruleLabels[a.ruleCode]}</p><p className="text-xs text-muted-foreground mt-1">{a.reason??a.title}</p><p className="text-xs font-medium mt-2">{alertConditionLabel(a)}</p></TableCell><TableCell>{a.subjects.map((c,i)=><p key={i} className="text-xs"><strong>{c.fullName??'Sin nombre'}</strong><br/>{c.rut}</p>)}{a.subjectCount>a.subjects.length&&<p className="text-xs text-primary">+{a.subjectCount-a.subjects.length} clientes en el detalle</p>}</TableCell><TableCell className="whitespace-nowrap text-xs"><p>{a.relatedRequestCount} solicitudes</p><p className="mt-1 text-muted-foreground">{a.distinctAccountCount??'No disponible'} cuentas distintas</p>{a.missingAccountCount>0&&<p className="text-xs text-muted-foreground">{a.missingAccountCount} sin cuenta</p>}</TableCell><TableCell className="whitespace-nowrap font-medium">{alertMoney(a.knownTotalAmountCLP)}{!a.isAmountTotalComplete&&<p className="text-xs font-normal text-destructive">Monto parcial · {a.missingAmountCount} sin monto</p>}</TableCell><TableCell>{a.period?.month??(a.period?.from?alertDate(a.period.from):'No aplica')}<p className="text-xs text-muted-foreground mt-1 whitespace-nowrap">{alertDate(a.lastDetectedAt)}</p></TableCell><TableCell><Badge variant="outline">{statusLabels[a.status]}</Badge>{a.requiresFollowUp&&<p className="text-xs mt-1">Seguimiento</p>}<p className="text-xs text-muted-foreground mt-2">{a.assignedTo?.name??a.assignedTo?.id??'Sin asignar'}</p></TableCell><TableCell><Button variant="outline" size="sm" onClick={()=>setSelected(a.id)}>Ver caso</Button></TableCell></TableRow>)}</TableBody></Table>
        {h.list.data.meta.total===0&&<div className="py-10 text-center space-y-2"><ShieldAlert className="h-8 w-8 mx-auto text-muted-foreground"/><h3 className="font-medium">No hay alertas para estos filtros</h3><p className="text-sm text-muted-foreground">{s?.meta.evaluationStatus==='READY'&&!s.meta.stale?'No se encontraron casos con los filtros seleccionados.':'El análisis está pendiente de actualizar; podrían aparecer nuevos casos.'}</p></div>}
        <Pagination page={page} total={h.list.data.meta.total} totalPages={h.list.data.meta.totalPages} onChange={setPage} disabled={h.list.isFetching}/></>}
    </>}
    {selected&&<AlertReview key={`${h.scope}-${selected}`} id={selected} token={h.token} scope={h.scope} admin={h.admin} onClose={()=>setSelected(null)} refresh={h.refresh} deny={h.deny}/>} 
  </section>
}
function Filter({label,value,options,change}:{label:string;value?:string;options:Record<string,string>;change:(v:string)=>void}) {return <label className="text-sm block space-y-1">{label}<Select value={value||'all'} onValueChange={change}><SelectTrigger aria-label={label}><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">Sin filtro</SelectItem>{Object.entries(options).map(([k,v])=><SelectItem value={k} key={k}>{v}</SelectItem>)}</SelectContent></Select></label>}