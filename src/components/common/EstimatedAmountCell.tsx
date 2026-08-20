import { RefreshCw } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { resolveDisplayAmount } from '@/lib/refundDisplayAmount'

/**
 * Monto estimado del listado: muestra el monto recalculado cuando existe,
 * con una marca visual + tooltip que explica simulado vs recalculado.
 * Sin recálculo, se muestra el monto de simulación tal cual.
 */
export function EstimatedAmountCell({ refund, align = 'right' }: { refund: any; align?: 'right' | 'left' }) {
  const info = resolveDisplayAmount(refund)
  const fmt = (n: number) => `$${Math.round(n).toLocaleString('es-CL')}`

  if (!info.isRecalculated) {
    return <span className="tabular-nums">{fmt(info.amount)}</span>
  }

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={`inline-flex items-center gap-1.5 cursor-help ${align === 'right' ? 'justify-end' : ''}`}
          >
            <span className="tabular-nums font-semibold text-sky-700 dark:text-sky-400">
              {fmt(info.amount)}
            </span>
            <span className="inline-flex items-center gap-0.5 rounded-full border border-sky-500/30 bg-sky-500/10 px-1.5 py-[1px] text-[10px] font-medium leading-none text-sky-700 dark:text-sky-400">
              <RefreshCw className="h-2.5 w-2.5" />
              Recalc.
            </span>
          </span>
        </TooltipTrigger>
        <TooltipContent side="left" className="max-w-[260px]">
          <p className="text-xs font-semibold mb-1">Monto recalculado</p>
          <div className="space-y-0.5 text-xs">
            <p className="flex justify-between gap-4">
              <span className="text-muted-foreground">Simulado</span>
              <span className="tabular-nums line-through">{fmt(info.simulatedAmount)}</span>
            </p>
            <p className="flex justify-between gap-4">
              <span className="text-muted-foreground">Recalculado</span>
              <span className="tabular-nums font-semibold">{fmt(info.amount)}</span>
            </p>
          </div>
          <p className="mt-1.5 text-[11px] text-muted-foreground">
            Se recalculó con los datos confirmados del crédito. Se muestra el monto vigente.
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
