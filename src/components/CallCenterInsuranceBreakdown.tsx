import { Money } from '@/components/common/Money'
import { ShieldCheck, BriefcaseBusiness, Layers, CircleHelp, DollarSign, Receipt } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { countDelta, moneyDelta } from '@/lib/dashboardComparison'
import { DashboardComparison } from '@/components/DashboardComparison'

type Groups = { key: string; label: string; count: number; premiums: number; ticket: number; sharePct: number }[]
type GroupComparison = Record<string, { count: number; premiums: number; ticket: number }>
const icons = { desgravamen: ShieldCheck, cesantia: BriefcaseBusiness, ambos: Layers, unknown: CircleHelp }

export function CallCenterInsuranceBreakdown({ groups, comparison }: { groups: Groups; comparison?: GroupComparison }) {
  return (
    <div className="md:col-span-3 min-w-0 pt-2">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h3 className="text-sm font-semibold">Desglose por seguro</h3>
        <span className="text-xs text-muted-foreground">Primera gestión</span>
      </div>
      <div className="space-y-5">
            {groups.filter(group => group.count > 0 || ['desgravamen', 'cesantia'].includes(group.key)).map(group => {
              const Icon = icons[group.key as keyof typeof icons]
              return (
                <section key={group.key} aria-label={`Métricas de ${group.label}`}>
                    <div className="flex items-center gap-2 mb-2 text-sm font-medium">
                      <Icon className="h-4 w-4 text-callcenter-foreground shrink-0" /><h4>{group.label}</h4>
                      <span className="ml-auto text-xs font-normal text-muted-foreground">{group.sharePct}% de las gestionadas</span>
                      {group.key === 'ambos' && <Tooltip><TooltipTrigger asChild><CircleHelp aria-label="Criterio de ambos seguros" className="h-3.5 w-3.5 text-muted-foreground" tabIndex={0} /></TooltipTrigger><TooltipContent className="max-w-64">Solicitudes con ambos seguros, contadas una sola vez y con su prima registrada, sin duplicarlas en los otros grupos.</TooltipContent></Tooltip>}
                    </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {[
                      { label: 'Solicitudes gestionadas', value: group.count.toLocaleString('es-CL'), icon: Icon, large: true, delta: comparison?.[group.key] ? countDelta(group.count, comparison[group.key].count) : undefined },
                      { label: 'Total primas estimadas', value: <Money value={group.premiums} />, icon: DollarSign, delta: comparison?.[group.key] ? moneyDelta(group.premiums, comparison[group.key].premiums) : undefined },
                      { label: 'Ticket promedio', value: <Money value={group.ticket} />, icon: Receipt, delta: comparison?.[group.key] ? moneyDelta(group.ticket, comparison[group.key].ticket) : undefined },
                    ].map(metric => (
                      <div key={metric.label} className="min-w-0 rounded-lg border border-callcenter-border bg-callcenter p-4">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="text-xs text-muted-foreground">{metric.label}</span>
                          <metric.icon className="h-4 w-4 shrink-0 text-muted-foreground/60" aria-hidden="true" />
                        </div>
                        <div className={`${metric.large ? 'text-2xl' : 'text-lg'} font-bold tabular-nums text-callcenter-foreground break-words`}>{metric.value}</div>
                        {metric.delta && <DashboardComparison delta={metric.delta} />}
                      </div>
                    ))}
                  </div>
                </section>
              )
            })}
      </div>
    </div>
  )
}