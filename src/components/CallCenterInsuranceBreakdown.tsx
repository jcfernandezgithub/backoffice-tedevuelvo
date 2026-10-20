import { callCenterInsuranceBreakdown } from '@/lib/callCenterMetrics'
import { Money } from '@/components/common/Money'
import { ShieldCheck, BriefcaseBusiness, Layers, CircleHelp } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

type Groups = ReturnType<typeof callCenterInsuranceBreakdown>
const icons = { desgravamen: ShieldCheck, cesantia: BriefcaseBusiness, ambos: Layers, unknown: CircleHelp }

export function CallCenterInsuranceBreakdown({ groups, total }: { groups: Groups; total: number }) {
  return (
    <div className="md:col-span-3 min-w-0 pt-2">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h3 className="text-sm font-semibold">Desglose por seguro</h3>
        <span className="text-xs text-muted-foreground">Primera gestión</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm" aria-label="Métricas Call Center por seguro">
          <thead className="text-xs text-muted-foreground border-b border-border">
            <tr>
              <th className="py-3 pr-4 text-left font-medium">Seguro</th>
              <th className="py-3 px-3 text-right font-medium">Gestionadas</th>
              <th className="py-3 px-3 text-right font-medium whitespace-nowrap">Primas estimadas</th>
              <th className="py-3 pl-3 text-right font-medium whitespace-nowrap">Ticket promedio</th>
            </tr>
          </thead>
          <tbody>
            {groups.filter(group => group.count > 0 || ['desgravamen', 'cesantia'].includes(group.key)).map(group => {
              const Icon = icons[group.key as keyof typeof icons]
              return (
                <tr key={group.key} className="border-b border-border/60 last:border-0 hover:bg-muted/40 transition-colors">
                  <th scope="row" className="py-4 pr-4 text-left font-medium">
                    <div className="flex items-center gap-2 whitespace-nowrap">
                      <Icon className="h-4 w-4 text-primary shrink-0" />{group.label}
                      {group.key === 'ambos' && <Tooltip><TooltipTrigger asChild><CircleHelp aria-label="Criterio de ambos seguros" className="h-3.5 w-3.5 text-muted-foreground" tabIndex={0} /></TooltipTrigger><TooltipContent className="max-w-64">Solicitudes con ambos seguros, contadas una sola vez y con su prima registrada, sin duplicarlas en los otros grupos.</TooltipContent></Tooltip>}
                    </div>
                  </th>
                  <td className="py-4 px-3 text-right tabular-nums"><span className="font-semibold">{group.count.toLocaleString('es-CL')}</span><span className="text-xs text-muted-foreground ml-2">{total ? Math.round(group.count / total * 100) : 0}%</span></td>
                  <td className="py-4 px-3 text-right font-semibold tabular-nums whitespace-nowrap"><Money value={group.premiums} /></td>
                  <td className="py-4 pl-3 text-right tabular-nums whitespace-nowrap"><Money value={group.ticket} /></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}