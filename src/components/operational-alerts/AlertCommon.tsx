import { Button } from '@/components/ui/button'
import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { AlertCircle, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react'
import { AlertsApiError, type AlertMeta } from '@/services/operationalAlertsApi'
import { alertDate } from '@/lib/operationalAlerts'

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
const evaluationLabels = { READY:'Evaluación disponible',RUNNING:'Actualización en curso',FAILED:'Evaluación fallida',NOT_CONFIGURED:'Configuración pendiente' }
export function AlertMetadata({meta}:{meta:AlertMeta}) {
  const omissions = Object.entries(meta.dataQuality ?? {}).filter(([,v])=>v>0)
  return <div className="border-y py-3 space-y-2 text-xs text-muted-foreground">
    <div className="flex flex-wrap gap-3 items-center"><Badge variant={meta.evaluationStatus === 'READY' && !meta.stale ? 'secondary':'destructive'}>{evaluationLabels[meta.evaluationStatus]}</Badge><span>Cobertura actualizada: {alertDate(meta.dataAsOf)}</span><span>Última evaluación completa: {alertDate(meta.lastSuccessfulEvaluationAt)}</span></div>
    {(meta.stale || ['FAILED','NOT_CONFIGURED'].includes(meta.evaluationStatus)) && <p role="alert" className="font-medium text-destructive">{meta.evaluationStatus === 'NOT_CONFIGURED' ? 'El equipo backend debe completar la configuración y carga inicial.' : 'Los datos pueden estar desactualizados; no permiten descartar comportamientos inusuales.'}</p>}
    {meta.evaluationStatus === 'RUNNING' && <p>Evaluación aún en curso. Se mantiene el corte consultado.</p>}
    {meta.coverage && <SafeFields value={meta.coverage} />}
    {omissions.length>0 && <div role="alert"><p className="font-medium text-destructive">Existen omisiones o limitaciones de datos.</p><SafeFields value={Object.fromEntries(omissions)} /></div>}
  </div>
}
const labels:Record<string,string> = {paidWindowDays:'Ventana de pagos (días)',minPaidRequests:'Cantidad mínima de pagos',minTotalPaidAmountCLP:'Monto mínimo mensual (CLP)',minDistinctRuts:'Cantidad mínima de RUT',nearPaymentHours:'Cercanía al pago (horas)',repeatedChangeDays:'Ventana de cambios (días)',minChanges:'Cantidad mínima de cambios',comment:'Observación',reason:'Motivo',requiresFollowUp:'Requiere seguimiento',outcome:'Resultado',assigneeId:'Responsable',previousAssigneeId:'Responsable anterior',from:'Desde',to:'Hasta',toExclusive:'Hasta (exclusivo)',month:'Mes',timezone:'Zona horaria',activeRules:'Reglas activas',monthlyFrom:'Cobertura mensual desde',monthlyCoverageFrom:'Cobertura mensual desde',invalidRutCount:'RUT inválidos',missingAmountCount:'Montos faltantes',missingAccountCount:'Cuentas faltantes',paidReentryCount:'Reingresos a Pagada',amountCondition:'Condición de monto',countCondition:'Condición de cantidad',destination:'Destino',referenceUrl:'Referencia',expectedVersion:'Versión revisada'}
export function SafeFields({value}:{value:Record<string,unknown>}) {
  return <dl className="space-y-1 text-xs">{Object.entries(value).map(([key,v]) => <div key={key} className="min-w-0"><dt className="inline font-medium">{labels[key] ?? key.replace(/([A-Z])/g,' $1')}: </dt><dd className="inline break-words">{v == null ? 'No disponible' : typeof v === 'boolean' ? (v ? 'Sí':'No') : typeof v === 'object' ? <SafeFields value={v as Record<string,unknown>} /> : String(v)}</dd></div>)}</dl>
}