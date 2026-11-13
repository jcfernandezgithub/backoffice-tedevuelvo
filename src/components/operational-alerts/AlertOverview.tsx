import { ArrowRight, Circle, Clock3, CheckCircle2, Layers } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { alertTypeDistribution } from '@/lib/alertSummaryPresentation'
import { priorityLabels, ruleLabels } from '@/lib/operationalAlerts'
import type { AlertFilters, AlertSummary } from '@/services/operationalAlertsApi'

const number = (value: number) => value.toLocaleString('es-CL')
const percent = (value: number) => `${value.toLocaleString('es-CL', {maximumFractionDigits:1})}%`

export function AlertOverview({summary,filters,onStatus,onRule}:{summary:AlertSummary;filters:AlertFilters;onStatus:(value:string)=>void;onRule:(value:string)=>void}) {
  const distribution = alertTypeDistribution(summary)
  const states = [
    {label:'Todos los estados',count:summary.totals.open+summary.totals.resolved,value:'all',Icon:Layers},
    {label:'Pendientes',count:summary.totals.pending,value:'PENDING',Icon:Circle},
    {label:'En revisión',count:summary.totals.inReview,value:'IN_REVIEW',Icon:Clock3},
    {label:'Resueltas',count:summary.totals.resolved,value:'RESOLVED',Icon:CheckCircle2},
  ]
  return <section aria-label="Panorama de alertas" className="space-y-4">
    <div className="flex flex-wrap items-baseline justify-between gap-2"><h3 className="font-semibold">Panorama de alertas</h3><p className="text-xs text-muted-foreground">Sin cerrar en total, sin filtros: <strong className="text-foreground tabular-nums">{number(summary.globalOpenCount)}</strong></p></div>
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{states.map(({label,count,value,Icon}) => {
      const active = value === 'all' ? !filters.status : filters.status === value
      return <Button key={value} variant="outline" aria-pressed={active} onClick={()=>onStatus(value)} className={`h-auto min-h-28 flex-col items-start whitespace-normal p-4 gap-2 ${active?'border-primary bg-primary/5 text-primary':'bg-card'}`}>
        <span className="flex w-full justify-between items-center gap-2 text-sm"><span>{label}</span><Icon className="h-4 w-4 shrink-0"/></span>
        <span className="text-3xl font-semibold tabular-nums">{number(count)}</span>
      </Button>
    })}</div>
    <div className="grid lg:grid-cols-[2fr_1fr] gap-6 border-y py-5">
      <div className="min-w-0 space-y-3"><div className="flex flex-wrap items-baseline justify-between gap-2"><h4 className="text-sm font-semibold">Tipos de alerta</h4><span className="text-xs text-muted-foreground">% de {number(summary.totals.open)} casos sin cerrar · filtros actuales</span></div>
        {summary.totals.open === 0 ? <p className="text-sm text-muted-foreground py-3">No hay casos sin cerrar con estos filtros.</p> : <div className="grid sm:grid-cols-2 gap-x-5 gap-y-2">{distribution.map(row => <Button key={row.ruleCode} variant="ghost" aria-pressed={filters.ruleCode===row.ruleCode} onClick={()=>onRule(filters.ruleCode===row.ruleCode?'all':row.ruleCode)} className={`h-auto min-h-20 w-full flex-col items-stretch gap-2 px-2 py-2 whitespace-normal ${filters.ruleCode===row.ruleCode?'bg-primary/5':''}`}>
          <span className="flex items-start justify-between gap-3 text-left"><span className="text-xs font-medium leading-5">{ruleLabels[row.ruleCode]}</span><span className="text-base font-semibold tabular-nums shrink-0">{percent(row.percentage)}</span></span>
          <span className="h-1.5 w-full overflow-hidden rounded-sm bg-muted"><span className="block h-full bg-primary" style={{width:`${Math.min(100,Math.max(0,row.percentage))}%`}}/></span>
          <span className="flex items-center justify-between text-xs text-muted-foreground"><span>{number(row.open)} casos</span><ArrowRight className="h-3 w-3"/></span>
        </Button>)}</div>}
      </div>
      <div className="min-w-0 space-y-3 lg:border-l lg:pl-6"><h4 className="text-sm font-semibold">Prioridad al detectar · sin cerrar</h4><dl className="space-y-3">{(['HIGH','MEDIUM','LOW'] as const).map(priority=><div key={priority} className="flex items-center justify-between gap-3 text-sm"><dt className="flex items-center gap-2"><span className={`h-2 w-2 rounded-full ${priority==='HIGH'?'bg-destructive':priority==='MEDIUM'?'bg-primary':'bg-muted-foreground'}`}/>{priorityLabels[priority]}</dt><dd className="font-semibold tabular-nums">{number(summary.byPriority[priority])}</dd></div>)}</dl></div>
    </div>
  </section>
}