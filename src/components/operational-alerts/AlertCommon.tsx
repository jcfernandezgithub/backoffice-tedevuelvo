import { Button } from '@/components/ui/button'
import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { AlertCircle, ChevronDown, ChevronLeft, ChevronRight, RefreshCw, CheckCircle2, Clock3, Info } from 'lucide-react'
import { AlertsApiError, type AlertMeta } from '@/services/operationalAlertsApi'
import { alertDate, ruleLabels, statusLabels } from '@/lib/operationalAlerts'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { requestStatusLabels } from '@/lib/alertEvidencePresentation'

export function AlertError({error,retry}:{error:Error|null;retry:()=>void}) {
  const [waiting,setWaiting] = useState(false)
  useEffect(() => {
    if (!(error instanceof AlertsApiError) || error.status !== 429) { setWaiting(false); return }
    setWaiting(true)
    const timer = setTimeout(()=>setWaiting(false),error.retryAfterMs)
    return ()=>clearTimeout(timer)
  },[error])
  if (!error) return null
  const unavailable = error instanceof AlertsApiError && error.status === 403
  return <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/5 p-4 space-y-2 text-sm">
    <p className="font-semibold flex gap-2 items-center"><AlertCircle className="h-4 w-4" />{unavailable ? 'Acceso denegado a alertas operativas' : 'No se pudo completar la consulta'}</p>
    <p>{error.message}</p>{error instanceof AlertsApiError && error.requestId && <p className="text-xs text-muted-foreground">Referencia: {error.requestId}</p>}
    {!unavailable && <Button variant="outline" size="sm" onClick={retry} disabled={waiting}><RefreshCw className="h-4 w-4 mr-2" />Reintentar</Button>}
    {error instanceof AlertsApiError && error.status === 429 && <p>Espera el plazo indicado por el servicio antes de actualizar: {error.retryAfterMs/1000} segundos.</p>}
  </div>
}
export function Pagination({page,totalPages,total,onChange,disabled=false}:{page:number;totalPages:number;total:number;onChange:(page:number)=>void;disabled?:boolean}) {
  return <div className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"><span className="text-muted-foreground">{total} registros · Página {totalPages ? page : 0} de {totalPages}</span><div className="flex gap-2"><Button variant="outline" size="icon" aria-label="Página anterior" disabled={disabled || page<=1} onClick={()=>onChange(page-1)}><ChevronLeft className="h-4 w-4" /></Button><Button variant="outline" size="icon" aria-label="Página siguiente" disabled={disabled || page>=totalPages} onClick={()=>onChange(page+1)}><ChevronRight className="h-4 w-4" /></Button></div></div>
}
export function AlertDisclosure({title,children}:{title:string;children:React.ReactNode}) {
  return <Collapsible className="min-w-0"><CollapsibleTrigger asChild><Button variant="ghost" size="sm" className="group gap-2 px-0 text-muted-foreground hover:bg-transparent"><ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]:rotate-180 motion-reduce:transition-none"/>{title}</Button></CollapsibleTrigger><CollapsibleContent className="pt-3 pb-2">{children}</CollapsibleContent></Collapsible>
}
export function AlertMetadata({meta}:{meta:AlertMeta}) {
  const omissions = Object.entries(meta.dataQuality ?? {}).filter(([key,v])=>key!=='scanned'&&v>0)
  const attention = meta.stale || ['FAILED','NOT_CONFIGURED'].includes(meta.evaluationStatus)
  const running = meta.evaluationStatus === 'RUNNING'
  const title = meta.evaluationStatus === 'NOT_CONFIGURED' ? 'Alertas aún no disponibles' : meta.evaluationStatus === 'FAILED' ? 'No se pudo actualizar el análisis' : running ? 'Analizando nuevos movimientos' : meta.stale ? 'Hay información pendiente de actualizar' : 'Análisis actualizado'
  const Icon = attention ? AlertCircle : running ? Clock3 : CheckCircle2
  return <section aria-label="Estado del análisis" className="border-y py-4 space-y-3">
    <div className="flex items-start gap-3"><Icon className={`h-5 w-5 shrink-0 mt-0.5 ${attention?'text-destructive':'text-primary'}`}/><div className="min-w-0 space-y-1"><h3 className="text-sm font-semibold">{title}</h3>
      {attention && <p role="alert" className="text-sm text-muted-foreground">{meta.evaluationStatus === 'NOT_CONFIGURED' ? 'El equipo técnico debe completar la puesta en marcha.' : running ? 'Mientras termina el análisis, se muestran los últimos resultados disponibles.' : 'Los casos disponibles pueden no incluir los movimientos más recientes.'}</p>}
      {!attention && running && <p className="text-sm text-muted-foreground">Se muestran los últimos resultados disponibles mientras termina el análisis.</p>}
      <p className="text-xs text-muted-foreground">Último análisis completado: {alertDate(meta.lastSuccessfulEvaluationAt)}</p>
    </div></div>
    {omissions.length>0 && <div className="flex gap-2 text-sm" role="alert"><Info className="h-4 w-4 shrink-0 mt-0.5 text-muted-foreground"/><p>Hay datos faltantes o incompletos. Algunos casos pueden requerir una revisión adicional.</p></div>}
    <AlertDisclosure title="Detalles del análisis"><div className="space-y-3 text-sm"><p className="text-muted-foreground">Información revisada hasta: {alertDate(meta.dataAsOf)}</p>{meta.coverage && <SafeFields value={meta.coverage}/>}{omissions.length>0&&<div className="space-y-2"><h4 className="font-medium">Datos que requieren atención</h4><SafeFields value={Object.fromEntries(omissions)}/></div>}{meta.dataQuality?.scanned!=null&&<p className="text-xs text-muted-foreground">Registros revisados: {meta.dataQuality.scanned.toLocaleString('es-CL')}</p>}</div></AlertDisclosure>
  </section>
}
const labels:Record<string,string> = {monthlyPaidFrom:'Pagos mensuales revisados desde',initialLoadCompleted:'Revisión inicial completada',states:'Estados incluidos',enabledRules:'Tipos de alerta activos',source:'Origen de la información',historicalPaidAccountAvailable:'Cuenta histórica del pago disponible',reconciliationLinksUsedAsTransfers:'Conciliaciones usadas como comprobante de transferencia',retention:'Conservación de alertas',scanned:'Registros revisados',paidAccountUnknown:'Pagos sin cuenta histórica conocida',invalidAccount:'Cuentas con datos no válidos',missingAmount:'Registros sin monto',paidReentries:'Reingresos al estado Pagada',outsideEvaluationWindows:'Registros fuera del período analizado',paidWindowDays:'Período de pagos revisado (días)',minPaidRequests:'Cantidad mínima de pagos',minTotalPaidAmountCLP:'Monto mínimo mensual ($)',minDistinctRuts:'Cantidad mínima de RUT',nearPaymentHours:'Cercanía al pago (horas)',repeatedChangeDays:'Período de cambios revisado (días)',minChanges:'Cantidad mínima de cambios',comment:'Observación',reason:'Motivo',requiresFollowUp:'Requiere seguimiento',outcome:'Resultado',assigneeId:'Responsable',previousAssigneeId:'Responsable anterior',from:'Desde',to:'Hasta',toExclusive:'Hasta (exclusivo)',month:'Mes',timezone:'Zona horaria',activeRules:'Reglas activas',monthlyFrom:'Cobertura mensual desde',monthlyCoverageFrom:'Cobertura mensual desde',invalidRutCount:'RUT inválidos',missingAmountCount:'Montos faltantes',missingAccountCount:'Cuentas faltantes',paidReentryCount:'Reingresos a Pagada',amountCondition:'Condición de monto',countCondition:'Condición de cantidad',destination:'Destino',referenceUrl:'Referencia',expectedVersion:'Versión revisada'}
const valueLabels:Record<string,string> = {...ruleLabels,...statusLabels,...requestStatusLabels,ADMINISTRATIVE_STATUS_HISTORY:'Historial de estados de las solicitudes',NO_AUTOMATIC_DELETION_PENDING_BUSINESS_POLICY:'Sin eliminación automática',VALIDATED_NO_ANOMALY:'Validada y justificada',ERROR_CORRECTED:'Error corregido',ESCALATED:'Derivada para revisión',HIGH:'Alta',MEDIUM:'Media',LOW:'Baja',OR:'Se cumple al menos una condición',AND:'Se cumplen ambas condiciones'}
function fieldValue(value:unknown):React.ReactNode {
  if(value==null)return 'No disponible'
  if(typeof value==='boolean')return value?'Sí':'No'
  if(Array.isArray(value))return <ul className="pl-4 list-disc space-y-1">{value.map((v,i)=><li key={i}>{fieldValue(v)}</li>)}</ul>
  if(typeof value==='object')return <SafeFields value={value as Record<string,unknown>}/>
  return valueLabels[String(value)]??String(value)
}
export function SafeFields({value}:{value:Record<string,unknown>}) {
  return <dl className="space-y-2 text-xs">{Object.entries(value).map(([key,v]) => <div key={key} className="min-w-0"><dt className="font-medium">{labels[key] ?? 'Información adicional'}</dt><dd className="text-muted-foreground break-words mt-0.5">{fieldValue(v)}</dd></div>)}</dl>
}
