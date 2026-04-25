import { Badge } from '@/components/ui/badge'
import type { MovementStatus } from '../types'

const map: Record<MovementStatus, { label: string; className: string }> = {
  pending: {
    label: 'Pendiente',
    className: 'bg-amber-100 text-amber-700 border-amber-300 hover:bg-amber-100',
  },
  partial: {
    label: 'Parcial',
    className: 'bg-blue-100 text-blue-700 border-blue-300 hover:bg-blue-100',
  },
  reconciled: {
    label: 'Conciliado',
    className: 'bg-emerald-100 text-emerald-700 border-emerald-300 hover:bg-emerald-100',
  },
  ignored: {
    label: 'Ignorado',
    className: 'bg-muted text-muted-foreground border-border hover:bg-muted',
  },
}

export function MovementStatusBadge({ status }: { status: MovementStatus }) {
  const cfg = map[status]
  return (
    <Badge variant="outline" className={cfg.className}>
      {cfg.label}
    </Badge>
  )
}