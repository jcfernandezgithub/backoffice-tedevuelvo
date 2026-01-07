import { cn } from '@/lib/utils'

export function Money({ value, className }: { value: number; className?: string }) {
  const f = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 })
  const safeValue = typeof value === 'number' && !isNaN(value) ? value : 0
  return <span className={cn('tabular-nums', className)}>{f.format(safeValue)}</span>
}
