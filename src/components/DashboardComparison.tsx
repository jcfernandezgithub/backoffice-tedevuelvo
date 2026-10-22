import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import type { DeltaInfo } from '@/lib/dashboardComparison'
import { cn } from '@/lib/utils'

export function DashboardComparison({ delta, compact = false }: { delta: DeltaInfo; compact?: boolean }) {
  const Icon = delta.tone === 'up' ? TrendingUp : delta.tone === 'down' ? TrendingDown : Minus
  const toneClass = delta.tone === 'up' ? 'dashboard-variation-up' : delta.tone === 'down' ? 'dashboard-variation-down' : 'dashboard-variation-flat'
  return (
    <div className={cn('min-w-0 tabular-nums', compact ? 'mt-2 space-y-1' : 'mt-3 border-t border-border/70 pt-3 space-y-2')}>
      <div className={cn('inline-flex max-w-full items-center gap-2 rounded-md px-2.5 py-1.5', toneClass)}>
        <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span className={cn('font-bold leading-tight break-words', compact ? 'text-base' : 'text-lg')}>
          {delta.deltaLabel.replace(/^[▲▼]\s*/, '')}
        </span>
        <span className="sr-only">{delta.tone === 'up' ? 'de aumento' : delta.tone === 'down' ? 'de disminución' : 'sin variación'}</span>
      </div>
      <div className="flex flex-wrap items-baseline gap-x-1.5 text-sm leading-snug">
        <span className="text-muted-foreground">vs.</span>
        <span className="font-medium text-foreground break-all">{delta.previousText}</span>
        <span className="text-muted-foreground">en comparación</span>
      </div>
    </div>
  )
}