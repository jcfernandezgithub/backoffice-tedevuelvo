import { Badge } from '@/components/ui/badge'
import { CheckCircle2, AlertTriangle, XCircle } from 'lucide-react'

export type ResultStatus = 'success' | 'skipped' | 'error'

export function statusBadge(s: ResultStatus) {
  if (s === 'success') {
    return (
      <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800">
        <CheckCircle2 className="h-3 w-3 mr-1" /> Generada
      </Badge>
    )
  }
  if (s === 'skipped') {
    return (
      <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800">
        <AlertTriangle className="h-3 w-3 mr-1" /> Omitida
      </Badge>
    )
  }
  return (
    <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-300 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800">
      <XCircle className="h-3 w-3 mr-1" /> Error
    </Badge>
  )
}

export function formatDuration(ms: number) {
  if (ms < 1000) return `${ms} ms`
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  const rs = s % 60
  return `${m}m ${rs}s`
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function StepDot({ active, done, label }: { active: boolean; done: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <div
        className={
          'h-2.5 w-2.5 rounded-full ' +
          (done ? 'bg-emerald-500' : active ? 'bg-primary animate-pulse' : 'bg-muted-foreground/30')
        }
      />
      <span className={active || done ? 'text-foreground font-medium' : ''}>{label}</span>
    </div>
  )
}

export function KpiCard({
  label, value, total, variant,
}: {
  label: string
  value: number | string
  total?: number
  variant: 'success' | 'warning' | 'danger' | 'info'
}) {
  const styles: Record<string, string> = {
    success: 'border-emerald-300 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200 dark:border-emerald-800',
    warning: 'border-amber-300 bg-amber-50 text-amber-900 dark:bg-amber-950/30 dark:text-amber-200 dark:border-amber-800',
    danger: 'border-rose-300 bg-rose-50 text-rose-900 dark:bg-rose-950/30 dark:text-rose-200 dark:border-rose-800',
    info: 'border-sky-300 bg-sky-50 text-sky-900 dark:bg-sky-950/30 dark:text-sky-200 dark:border-sky-800',
  }
  const pct = typeof value === 'number' && total && total > 0 ? Math.round((value / total) * 100) : null
  return (
    <div className={`rounded-lg border p-4 ${styles[variant]}`}>
      <p className="text-xs font-medium uppercase tracking-wide opacity-80">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
      {pct !== null && (
        <p className="text-xs opacity-70 mt-0.5">{pct}% del total</p>
      )}
    </div>
  )
}