import { useMemo } from 'react'
import { Shield, Briefcase, TrendingDown } from 'lucide-react'
import { Money } from '@/components/common/Money'
import { computeBreakdown } from '@/lib/insuranceBreakdownUtils'

interface InsuranceBreakdownProps {
  snapshot: any
}

export function InsuranceBreakdown({ snapshot }: InsuranceBreakdownProps) {
  const breakdown = useMemo(() => computeBreakdown(snapshot), [snapshot])

  if (!breakdown) return null

  return (
    <div className="col-span-2 mt-2 space-y-3">
      <p className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
        <TrendingDown className="h-4 w-4" />
        Desglose por tipo de seguro
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Desgravamen */}
        <div className="rounded-lg border bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800 p-4 space-y-3">
          <div className="flex items-center gap-2 text-blue-700 dark:text-blue-400 font-medium text-sm">
            <Shield className="h-4 w-4" />
            Desgravamen
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="text-xs text-muted-foreground">Prima Banco</p>
              <p className="font-medium">
                <Money value={breakdown.desgravamen.primaBanco} /> <span className="text-xs text-muted-foreground">/mes</span>
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Prima TDV</p>
              <p className="font-medium text-green-600 dark:text-green-400">
                <Money value={breakdown.desgravamen.primaTDV} /> <span className="text-xs text-muted-foreground">/mes</span>
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="text-xs text-muted-foreground">Prima Total Banco</p>
              <p className="font-medium text-sm">
                <Money value={breakdown.desgravamen.primaTotalBanco} />
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Prima Total TDV</p>
              <p className="font-medium text-sm text-green-600 dark:text-green-400">
                <Money value={breakdown.desgravamen.primaTotalTDV} />
              </p>
            </div>
          </div>
          <div className="pt-2 border-t border-blue-200 dark:border-blue-800">
            <p className="text-xs text-muted-foreground">Devolución estimada</p>
            <p className="font-semibold text-blue-700 dark:text-blue-400">
              <Money value={breakdown.desgravamen.devolucion} />
            </p>
          </div>
        </div>

        {/* Cesantía */}
        <div className="rounded-lg border bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800 p-4 space-y-3">
          <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-medium text-sm">
            <Briefcase className="h-4 w-4" />
            Cesantía
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="text-xs text-muted-foreground">Prima Banco</p>
              <p className="font-medium">
                <Money value={breakdown.cesantia.primaBanco} /> <span className="text-xs text-muted-foreground">/mes</span>
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Prima TDV</p>
              <p className="font-medium text-green-600 dark:text-green-400">
                <Money value={breakdown.cesantia.primaTDV} /> <span className="text-xs text-muted-foreground">/mes</span>
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="text-xs text-muted-foreground">Prima Total Banco</p>
              <p className="font-medium text-sm">
                <Money value={breakdown.cesantia.primaTotalBanco} />
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Prima Total TDV</p>
              <p className="font-medium text-sm text-green-600 dark:text-green-400">
                <Money value={breakdown.cesantia.primaTotalTDV} />
              </p>
            </div>
          </div>
          <div className="pt-2 border-t border-amber-200 dark:border-amber-800">
            <p className="text-xs text-muted-foreground">Devolución estimada</p>
            <p className="font-semibold text-amber-700 dark:text-amber-400">
              <Money value={breakdown.cesantia.devolucion} />
            </p>
          </div>
        </div>
      </div>

      {/* Totals */}
      <div className="rounded-lg bg-muted/50 border p-3 flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Total sin margen: <span className="font-medium text-foreground"><Money value={breakdown.totalDevolucion} /></span>
        </div>
        <div className="text-sm">
          Margen ({breakdown.margen}%) →{' '}
          <span className="font-semibold text-green-600 dark:text-green-400">
            <Money value={breakdown.totalConMargen} />
          </span>
        </div>
      </div>
    </div>
  )
}
