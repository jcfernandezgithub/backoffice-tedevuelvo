import { useState } from 'react'
import { Play, Loader2, RefreshCw, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog'
import { useManualAlertEvaluation } from '@/hooks/useManualAlertEvaluation'
import { evaluationIsActive, evaluationStatusLabels, pendingEvaluationStorageKey } from '@/lib/manualAlertEvaluation'
import { configuredApiBaseUrl } from '@/services/apiConfig'
import { AlertsApiError } from '@/services/operationalAlertsApi'
import { useAuth } from '@/state/AuthContext'
import { alertsAccess, alertDate } from '@/lib/operationalAlerts'

export function ManualAlertEvaluation({scope,detectorEnabled,refresh,deny}:{scope:string;detectorEnabled?:boolean;refresh:()=>Promise<void>;deny:()=>void}) {
  const {user}=useAuth()
  if(!user||!alertsAccess(user).admin)return null
  return <EvaluationControl key={scope} scope={scope} storageKey={pendingEvaluationStorageKey(configuredApiBaseUrl??location.origin,user.id)} detectorEnabled={detectorEnabled} refresh={refresh} deny={deny}/>
}
function EvaluationControl({scope,storageKey,detectorEnabled,refresh,deny}:{scope:string;storageKey:string;detectorEnabled?:boolean;refresh:()=>Promise<void>;deny:()=>void}) {
  const [confirm,setConfirm]=useState(false)
  const h=useManualAlertEvaluation({scope,storageKey,refresh,deny})
  const run=h.run
  const active=evaluationIsActive(run)
  const disabled=h.blocked||detectorEnabled===false
  return <section aria-label="Evaluación manual" className="border-y py-3 space-y-3 text-sm min-w-0">
    <div className="flex flex-wrap gap-3 items-center justify-between">
      <div className="min-w-0"><h3 className="font-medium">Evaluación de alertas</h3><p className="text-xs text-muted-foreground">Evaluación diaria: 07:00 · Santiago</p></div>
      <div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" disabled={h.sending||h.waiting} onClick={()=>void h.recover()}><RefreshCw className="h-4 w-4 mr-2"/>Consultar evaluación</Button><Button size="sm" disabled={disabled} onClick={()=>setConfirm(true)}>{h.sending||active?<Loader2 className="h-4 w-4 mr-2 animate-spin motion-reduce:animate-none"/>:<Play className="h-4 w-4 mr-2"/>}{h.sending?'Registrando…':h.pending?'Reintentar misma solicitud':'Evaluar ahora'}</Button></div>
    </div>
    {detectorEnabled===false&&<p role="alert" className="text-destructive">El detector está desactivado. No se puede iniciar una evaluación desde aquí.</p>}
    {h.loading&&!run&&<p role="status" className="text-muted-foreground">Consultando evaluaciones existentes…</p>}
    {run&&<div role="status" className="space-y-2 min-w-0">
      <p className="font-semibold">{evaluationStatusLabels[run.status]}</p>
      <p className="text-xs text-muted-foreground">Origen: {{MANUAL:'Manual',DAILY:'Diaria',CLI:'Equipo técnico',INITIAL_LOAD:'Carga inicial'}[run.origin]} · Solicitada: {alertDate(run.requestedAt)}</p>
      {active&&<p>Puedes seguir trabajando mientras termina. Se mantienen los últimos resultados disponibles.</p>}
      {run.progress&&<div className="flex flex-wrap gap-x-5 gap-y-1 text-muted-foreground">{run.progress.stage&&<span>Etapa: {run.progress.stage}</span>}{run.progress.scanned!=null&&<span>Registros revisados: {run.progress.scanned.toLocaleString('es-CL')}</span>}{run.progress.groupsProcessed!=null&&<span>Grupos procesados: {run.progress.groupsProcessed.toLocaleString('es-CL')}</span>}{run.progress.elapsedMs!=null&&<span>Tiempo transcurrido: {Math.floor(run.progress.elapsedMs/60000)} min {Math.floor(run.progress.elapsedMs/1000)%60} s</span>}</div>}
      {run.status==='SUCCEEDED'&&<p>La evaluación global terminó; algunos casos pueden seguir con datos incompletos.</p>}
      {['FAILED','INTERRUPTED','DISCARDED'].includes(run.status)&&<p className="text-destructive">No terminó una evaluación global válida. No se reiniciará automáticamente.</p>}
      {run.resultsMayBePartial&&<p role="alert" className="text-destructive">Pudieron aplicarse revisiones parciales. Esto no confirma una actualización global completa.</p>}
      {run.error&&<p role="alert">{run.error.message} <span className="text-muted-foreground">({run.error.code})</span></p>}
      <p className="text-xs text-muted-foreground break-all">ID de evaluación: {run.evaluationId}</p>
    </div>}
    {h.error&&<div role="alert" className="border-l-4 border-destructive pl-3 space-y-1"><p className="font-medium flex items-center gap-2"><AlertTriangle className="h-4 w-4 shrink-0"/>No se pudo confirmar la operación</p><p>{h.error.message}</p>{h.error instanceof AlertsApiError&&<p className="text-xs break-words">Código: {h.error.code}{h.error.requestId&&` · Referencia: ${h.error.requestId}`}</p>}{h.waiting&&<p>Espera el plazo indicado por el servicio antes de volver a consultar o solicitar.</p>}</div>}
    {h.reserved&&<p role="alert">Hay una evaluación o reserva vigente. Consulta su estado antes de iniciar otra.</p>}
    {h.pending&&!h.pending.evaluationId&&!active&&<p role="alert" className="text-muted-foreground">El inicio no está confirmado. La petición original se conserva; reintentar no crea una solicitud diferente.</p>}
    <AlertDialog open={confirm} onOpenChange={setConfirm}><AlertDialogContent className="max-w-[calc(100%-2rem)] sm:max-w-lg"><AlertDialogHeader><AlertDialogTitle>¿Evaluar alertas ahora?</AlertDialogTitle><AlertDialogDescription>La evaluación puede tardar y aumentar la carga del sistema. Se recomienda ejecutarla fuera del horario operativo. Puedes seguir trabajando mientras termina. No se modificarán solicitudes, cuentas bancarias ni pagos.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction disabled={disabled} onClick={()=>void h.start()}>Confirmar y evaluar</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </section>
}