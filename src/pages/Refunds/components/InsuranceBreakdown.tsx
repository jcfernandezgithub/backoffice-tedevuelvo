import { useMemo } from 'react'
import { Shield, Briefcase, TrendingDown } from 'lucide-react'
import { Money } from '@/components/common/Money'
import tasasCesantiaBanco from '@/data/tasas_cesantia_banco.json'
import tasasCesantiaTeDevuelvo from '@/data/tasas_cesantia_te_devuelvo.json'

/** Maps institutionId (lowercase) to cesantía JSON key */
const INSTITUTION_MAP: Record<string, string> = {
  santander: 'BANCO SANTANDER',
  bci: 'BANCO BCI',
  scotiabank: 'SCOTIABANK',
  chile: 'BANCO CHILE',
  security: 'BANCO SECURITY',
  'itau-corpbanca': 'BANCO ITAU-CORPBANCA',
  itau: 'BANCO ITAÚ',
  bice: 'BANCO BICE',
  estado: 'BANCO ESTADO',
  ripley: 'BANCO RIPLEY',
  falabella: 'BANCO FALABELLA',
  consorcio: 'BANCO CONSORCIO',
  coopeuch: 'COOPEUCH',
  cencosud: 'BANCO CENCOSUD',
  'lider-bci': 'LIDER-BCI',
  forum: 'FORUM',
  tanner: 'TANNER',
  cooperativas: 'COOPERATIVAS',
}

function getTramo(monto: number): string {
  if (monto <= 1000000) return 'tramo_1'
  if (monto <= 3000000) return 'tramo_2'
  if (monto <= 5000000) return 'tramo_3'
  if (monto <= 7000000) return 'tramo_4'
  return 'tramo_5'
}

interface BreakdownResult {
  desgravamen: {
    primaBanco: number
    primaTDV: number
    devolucion: number
  }
  cesantia: {
    primaBanco: number
    primaTDV: number
    devolucion: number
  }
  totalDevolucion: number
  totalConMargen: number
  margen: number
}

function computeBreakdown(snapshot: any): BreakdownResult | null {
  if (!snapshot) return null

  const tipo = (snapshot.insuranceToEvaluate || snapshot.tipoSeguro || '').toLowerCase()
  if (tipo !== 'ambos') return null

  const {
    totalAmount,
    remainingInstallments,
    currentMonthlyPremium,
    newMonthlyPremium,
    totalSaving,
    institutionId,
  } = snapshot

  if (!totalAmount || !remainingInstallments) return null

  // --- Desgravamen (from snapshot) ---
  const desgPrimaBanco = currentMonthlyPremium || 0
  const desgPrimaTDV = newMonthlyPremium || 0
  const desgDevolucion = (desgPrimaBanco - desgPrimaTDV) * remainingInstallments

  // --- Cesantía (on-the-fly) ---
  const bankKey = INSTITUTION_MAP[(institutionId || '').toLowerCase()] || (institutionId || '').toUpperCase()
  const tramo = getTramo(totalAmount)

  let cesantiaTasaBanco = 0
  let cesantiaTasaTDV = 0

  const bankData = tasasCesantiaBanco[bankKey as keyof typeof tasasCesantiaBanco]
  if (bankData) {
    const tramoData = bankData[tramo as keyof typeof bankData] as any
    if (tramoData) cesantiaTasaBanco = tramoData.tasa_mensual
  }

  const tdvData = tasasCesantiaTeDevuelvo.TE_DEVUELVO_CESANTIA
  const tdvTramo = tdvData[tramo as keyof typeof tdvData] as any
  if (tdvTramo) cesantiaTasaTDV = tdvTramo.tasa_mensual

  const cesantiaPrimaBanco = Math.round(totalAmount * cesantiaTasaBanco)
  const cesantiaPrimaTDV = Math.round(totalAmount * cesantiaTasaTDV)
  const cesantiaDevolucion = (cesantiaPrimaBanco - cesantiaPrimaTDV) * remainingInstallments

  const totalDevolucion = desgDevolucion + cesantiaDevolucion

  // Derive margin from totalSaving if available
  let margen = 10
  if (totalSaving && totalDevolucion > 0) {
    margen = Math.round((1 - totalSaving / totalDevolucion) * 100)
    if (margen < 0) margen = 0
  }

  const totalConMargen = Math.round(totalDevolucion * (1 - margen / 100))

  return {
    desgravamen: {
      primaBanco: desgPrimaBanco,
      primaTDV: desgPrimaTDV,
      devolucion: Math.max(0, Math.round(desgDevolucion)),
    },
    cesantia: {
      primaBanco: cesantiaPrimaBanco,
      primaTDV: cesantiaPrimaTDV,
      devolucion: Math.max(0, Math.round(cesantiaDevolucion)),
    },
    totalDevolucion: Math.round(totalDevolucion),
    totalConMargen,
    margen,
  }
}

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
