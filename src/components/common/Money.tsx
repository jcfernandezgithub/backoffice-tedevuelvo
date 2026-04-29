import { cn } from '@/lib/utils'

export function Money({ value, className }: { value: number; className?: string }) {
  const safeValue = typeof value === 'number' && !isNaN(value) ? value : 0
  // Detecta si el valor tiene decimales relevantes (evita mostrar ".00" en enteros)
  const hasDecimals = Math.abs(safeValue - Math.trunc(safeValue)) > 0.0049
  const f = new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    minimumFractionDigits: hasDecimals ? 2 : 0,
    maximumFractionDigits: hasDecimals ? 2 : 0,
  })
  return <span className={cn('tabular-nums', className)}>{f.format(safeValue)}</span>
}
