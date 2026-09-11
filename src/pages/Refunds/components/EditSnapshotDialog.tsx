import { useState, useCallback, useEffect, useMemo, useRef, memo } from 'react'
import type { Control } from 'react-hook-form'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { refundAdminApi } from '@/services/refundAdminApi'
import type { RefundRequest } from '@/types/refund'
import { calcularDevolucion, type TasaOverrides } from '@/lib/calculadoraUtils'
import { getSafetyMarginByInstitutionId } from '@/hooks/useSafetyMargins'
import { useInstitutionMargin } from '@/hooks/useInstitutions'
import { computeBreakdown, computePureCesantiaTotalTDV } from '@/lib/insuranceBreakdownUtils'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Calculator, CreditCard, Shield, TrendingUp, Settings2, Lock, Unlock, AlertTriangle, CheckCircle2, Copy, RefreshCw, Percent, Info } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Textarea } from '@/components/ui/textarea'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { toast } from '@/hooks/use-toast'
import { ConfirmChangesStep, type FieldChange } from './ConfirmChangesStep'


/* ------------------------------------------------------------------ */
/*  Schema                                                             */
/* ------------------------------------------------------------------ */

const snapshotSchema = z.object({
  creditType: z.string().trim().max(50).optional().or(z.literal('')),
  insuranceToEvaluate: z.string().trim().max(50).optional().or(z.literal('')),
  totalAmount: z.coerce.number().min(0).optional(),
  averageInsuredBalance: z.coerce.number().min(0).optional(),
  originalInstallments: z.coerce.number().int().min(0).optional(),
  remainingInstallments: z.coerce.number().int().min(0).optional(),
  // Confirmed credit fields (required - must be filled before saving)
  confirmedTotalAmount: z.coerce.number({ required_error: 'Requerido' }).positive('Debe ser mayor a 0'),
  confirmedAverageInsuredBalance: z.coerce.number({ required_error: 'Requerido' }).positive('Debe ser mayor a 0'),
  confirmedOriginalInstallments: z.coerce.number({ required_error: 'Requerido' }).int().positive('Debe ser mayor a 0'),
  confirmedRemainingInstallments: z.coerce.number({ required_error: 'Requerido' }).int().positive('Debe ser mayor a 0'),
  nroPoliza: z.string().trim().max(50).optional().or(z.literal('')),
  nroCredito: z.string().trim().max(50).optional().or(z.literal('')),
  currentMonthlyPremium: z.coerce.number().min(0).optional(),
  newMonthlyPremium: z.coerce.number().min(0).optional(),
  newTotalPremium: z.coerce.number().min(0).optional(),
  monthlySaving: z.coerce.number().min(0).optional(),
  totalSaving: z.coerce.number().min(0).optional(),
  birthDate: z.string().trim().optional().or(z.literal('')),
  age: z.coerce.number().int().min(0).max(120).optional(),
  rateSet: z.string().trim().max(100).optional().or(z.literal('')),
  // Tasas manuales (fracción mensual, ej: 0.00085). Se usan en lugar de las tasas del servicio.
  manualBankRateDesgravamen: z.coerce.number().min(0).optional(),
  manualBankRateCesantia: z.coerce.number().min(0).optional(),
  manualRateReason: z.string().trim().max(200).optional().or(z.literal('')),
  // Campos root-level del refund
  estimatedAmountCLP: z.coerce.number().min(0).optional(),
  realAmount: z.coerce.number().min(0).optional(),
})


type SnapshotFormValues = z.infer<typeof snapshotSchema>

const FIELD_LABELS: Record<keyof SnapshotFormValues, string> = {
  creditType: 'Tipo de crédito',
  insuranceToEvaluate: 'Seguro a evaluar',
  totalAmount: 'Monto total crédito',
  averageInsuredBalance: 'Saldo insoluto',
  originalInstallments: 'Cuotas originales',
  remainingInstallments: 'Cuotas restantes',
  confirmedTotalAmount: 'Monto total crédito (confirmado)',
  confirmedAverageInsuredBalance: 'Saldo insoluto (confirmado)',
  confirmedOriginalInstallments: 'Cuotas originales (confirmado)',
  confirmedRemainingInstallments: 'Cuotas restantes (confirmado)',
  nroPoliza: 'Nro. Póliza',
  nroCredito: 'Nro. Crédito',
  currentMonthlyPremium: 'Prima mensual actual',
  newMonthlyPremium: 'Nueva prima mensual',
  newTotalPremium: 'Prima total (override manual)',
  monthlySaving: 'Ahorro mensual',
  totalSaving: 'Ahorro total',
  birthDate: 'Fecha de nacimiento',
  age: 'Edad',
  rateSet: 'Versión de tarifas',
  manualBankRateDesgravamen: 'Tasa manual banco · Desgravamen',
  manualBankRateCesantia: 'Tasa manual banco · Cesantía',
  manualRateReason: 'Motivo de la tasa manual',
  estimatedAmountCLP: 'Monto estimado devolución',
  realAmount: 'Monto real devolución',
}


/* ------------------------------------------------------------------ */
/*  Section wrapper                                                    */
/* ------------------------------------------------------------------ */

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ElementType
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-primary" />
        <h4 className="text-sm font-semibold tracking-wide uppercase text-muted-foreground">
          {title}
        </h4>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-3">{children}</div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Tasas utilizadas (solo lectura)                                    */
/* ------------------------------------------------------------------ */

const fmtPct = (tasa: number) =>
  `${(tasa * 100).toLocaleString('es-CL', { minimumFractionDigits: 4, maximumFractionDigits: 4 })}%`

const fmtCLP = (v?: number) =>
  typeof v === 'number' && !Number.isNaN(v)
    ? `$${Math.round(v).toLocaleString('es-CL')}`
    : '—'

const TRAMO_EDAD_LABEL: Record<string, string> = {
  hasta_55: 'Hasta 55 años',
  desde_56: 'Desde 56 años',
}

const TRAMO_MONTO_LABEL: Record<string, string> = {
  tramo_1: '$500.000 – $1.000.000',
  tramo_2: '$1.000.001 – $3.000.000',
  tramo_3: '$3.000.001 – $5.000.000',
  tramo_4: '$5.000.001 – $7.000.000',
  tramo_5: 'Sobre $7.000.000',
}

function RateRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums text-right">{value}</span>
    </div>
  )
}

function RateCard({
  title,
  tasa,
  rows,
  manual,
}: {
  title: string
  tasa: number
  rows: { label: string; value: React.ReactNode }[]
  manual?: boolean
}) {
  return (
    <div className={`rounded-lg border p-3 space-y-2 ${manual ? 'border-amber-500/50 bg-amber-500/5' : 'bg-card'}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </span>
        <span
          className={`rounded-md px-2 py-0.5 text-sm font-semibold tabular-nums ${
            manual ? 'bg-amber-500/20 text-amber-700 dark:text-amber-400' : 'bg-primary/10 text-primary'
          }`}
        >
          {fmtPct(tasa)}
        </span>
      </div>
      {manual && (
        <p className="text-[10px] font-medium uppercase tracking-wide text-amber-700 dark:text-amber-400">
          Tasa ingresada manualmente
        </p>
      )}
      <div className="space-y-1 pt-1 border-t">

        {rows.map((r) => (
          <RateRow key={r.label} label={r.label} value={r.value} />
        ))}
      </div>
    </div>
  )
}


/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

/* ---- Extracted NumberField to avoid re-mount on parent re-render ---- */
const NumberField = memo(function NumberField({
  name,
  label,
  prefix,
  suffix,
  className,
  control,
}: {
  name: keyof SnapshotFormValues
  label: string
  prefix?: string
  suffix?: string
  className?: string
  control: Control<SnapshotFormValues>
}) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className={className}>
          <FormLabel className="text-xs">{label}</FormLabel>
          <FormControl>
            <div className="relative">
              {prefix && (
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                  {prefix}
                </span>
              )}
              <Input
                {...field}
                value={field.value ?? ''}
                type="text"
                inputMode="numeric"
                onChange={(e) => {
                  const val = e.target.value.replace(/[^0-9.]/g, '')
                  field.onChange(val === '' ? '' : val)
                }}
                className={prefix ? 'pl-7' : ''}
              />
              {suffix && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                  {suffix}
                </span>
              )}
            </div>
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  )
})

interface EditSnapshotDialogProps {
  refund: RefundRequest
}

export function EditSnapshotDialog({ refund }: EditSnapshotDialogProps) {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<'form' | 'confirm'>('form')
  const [pendingData, setPendingData] = useState<SnapshotFormValues | null>(null)
  const [overridePrimas, setOverridePrimas] = useState(false)
  const [overrideAhorros, setOverrideAhorros] = useState(false)
  const latestSavedValuesRef = useRef<SnapshotFormValues | null>(null)
  const latestSavedAtRef = useRef<number | null>(null)
  const queryClient = useQueryClient()
  const snapshot = refund.calculationSnapshot || {}
  // Margen de seguridad reactivo desde GET /public/institutions
  const institutionMargin = useInstitutionMargin(refund.institutionId)

  // Map institutionId to calculator-compatible bank name
  const INSTITUTION_TO_CALC: Record<string, string> = {
    santander: 'Santander', bci: 'BCI', scotiabank: 'Scotiabank',
    chile: 'Chile', security: 'Security', itau: 'Itaú - Corpbanca',
    'itau-corpbanca': 'Itaú - Corpbanca', bice: 'BICE', estado: 'Estado',
    ripley: 'Banco Ripley', falabella: 'Falabella', consorcio: 'Consorcio',
    coopeuch: 'Coopeuch', cencosud: 'Cencosud', 'lider-bci': 'Lider BCI',
    forum: 'Forum', tanner: 'Tanner', cooperativas: 'Cooperativas',
    'santander-consumer': 'Santander Consumer',
    'santander consumer': 'Santander Consumer',
    'chevrolet-sf': 'Chevrolet SF', 'chevrolet sf': 'Chevrolet SF',
    marubeni: 'Marubeni', internacional: 'Internacional', condell: 'Condell',
    financoop: 'Financoop', ahorrocoop: 'Ahorrocoop', libercoop: 'Libercoop',
    capual: 'Capual', bancrece: 'Bancrece', islacoop: 'Islacoop',
  }

  // Normaliza institutionId: minúsculas, sin acentos, sin espacios alrededor de guiones,
  // y colapsa separadores (espacios/guiones) para que "Itaú - Corpbanca" matchee con "itau-corpbanca".
  const normalizeInstitutionKey = (raw: string): string => {
    const base = (raw || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
    // Intentamos varias variantes para maximizar matches
    const collapsed = base.replace(/\s*-\s*/g, '-').replace(/\s+/g, '-')
    return collapsed
  }

  const resolveBanco = (raw: string): string | undefined => {
    if (!raw) return undefined
    const direct = INSTITUTION_TO_CALC[raw.toLowerCase()]
    if (direct) return direct
    const norm = normalizeInstitutionKey(raw)
    if (INSTITUTION_TO_CALC[norm]) return INSTITUTION_TO_CALC[norm]
    // Probar también sin guiones (solo palabras)
    const firstWord = norm.split('-')[0]
    return INSTITUTION_TO_CALC[firstWord]
  }

  const calcAge = useCallback((dateStr: string): number | undefined => {
    if (!dateStr) return undefined
    const birth = new Date(dateStr)
    if (isNaN(birth.getTime())) return undefined
    const today = new Date()
    let age = today.getFullYear() - birth.getFullYear()
    const m = today.getMonth() - birth.getMonth()
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
    return age
  }, [])

  const defaults = useMemo<SnapshotFormValues>(() => {
    const currentSnapshot = refund.calculationSnapshot || {}

    return {
      creditType: (currentSnapshot.creditType || '').toLowerCase(),
      insuranceToEvaluate: (currentSnapshot.insuranceToEvaluate || '').toLowerCase(),
      totalAmount: currentSnapshot.totalAmount ?? undefined,
      averageInsuredBalance: currentSnapshot.averageInsuredBalance ?? undefined,
      originalInstallments: currentSnapshot.originalInstallments ?? undefined,
      remainingInstallments: currentSnapshot.remainingInstallments ?? undefined,
      confirmedTotalAmount: currentSnapshot.confirmedTotalAmount ?? '',
      confirmedAverageInsuredBalance: currentSnapshot.confirmedAverageInsuredBalance ?? '',
      confirmedOriginalInstallments: currentSnapshot.confirmedOriginalInstallments ?? '',
      confirmedRemainingInstallments: currentSnapshot.confirmedRemainingInstallments ?? '',
      nroPoliza: currentSnapshot.nroPoliza || '',
      nroCredito: currentSnapshot.nroCredito || '',
      currentMonthlyPremium: currentSnapshot.currentMonthlyPremium ?? undefined,
      newMonthlyPremium: currentSnapshot.newMonthlyPremium ?? undefined,
      newTotalPremium: currentSnapshot.newTotalPremium ?? undefined,
      monthlySaving: currentSnapshot.monthlySaving ?? undefined,
      totalSaving: currentSnapshot.totalSaving ?? undefined,
      birthDate: currentSnapshot.birthDate ? (() => {
        const d = new Date(currentSnapshot.birthDate)
        if (isNaN(d.getTime())) return currentSnapshot.birthDate.slice(0, 10)
        const yyyy = d.getFullYear()
        const mm = String(d.getMonth() + 1).padStart(2, '0')
        const dd = String(d.getDate()).padStart(2, '0')
        return `${yyyy}-${mm}-${dd}`
      })() : '',
      age: currentSnapshot.age ?? undefined,
      rateSet: currentSnapshot.rateSet || '',
      manualBankRateDesgravamen: (currentSnapshot as any).manualBankRateDesgravamen ?? undefined,
      manualBankRateCesantia: (currentSnapshot as any).manualBankRateCesantia ?? undefined,
      manualRateReason: (currentSnapshot as any).manualRateReason || '',

      estimatedAmountCLP: refund.estimatedAmountCLP ?? undefined,
      realAmount: (() => {
        if ((refund as any).realAmount) return (refund as any).realAmount
        const entry = [...(refund.statusHistory || [])].reverse().find(
          (e) => (e.to === 'payment_scheduled' || e.to === 'paid') && e.realAmount
        )
        return entry?.realAmount ?? undefined
      })(),
    }
  }, [refund])

  const form = useForm<SnapshotFormValues>({
    resolver: zodResolver(snapshotSchema),
    defaultValues: defaults,
  })

  const getResetValues = () => {
    const savedValues = latestSavedValuesRef.current
    const savedAt = latestSavedAtRef.current
    const isRecentSave = !!savedValues && !!savedAt && Date.now() - savedAt < 15000
    return isRecentSave ? savedValues : defaults
  }

  // Si llegan datos frescos mientras el modal está abierto, sincronizar formulario.
  useEffect(() => {
    if (!open) return
    form.reset(getResetValues())
  }, [open, defaults])

  // Watch confirmed credit fields (preferred) and simulation fields as fallback
  const watchedAge = form.watch('age')
  const watchedConfirmedTotalAmount = form.watch('confirmedTotalAmount')
  const watchedConfirmedAverageInsuredBalance = form.watch('confirmedAverageInsuredBalance')
  const watchedConfirmedOriginalInstallments = form.watch('confirmedOriginalInstallments')
  const watchedConfirmedRemainingInstallments = form.watch('confirmedRemainingInstallments')
  const watchedTotalAmount = form.watch('totalAmount')
  const watchedOriginalInstallments = form.watch('originalInstallments')
  const watchedRemainingInstallments = form.watch('remainingInstallments')
  const watchedInsuranceType = form.watch('insuranceToEvaluate')
  const watchedManualDesg = form.watch('manualBankRateDesgravamen')
  const watchedManualCes = form.watch('manualBankRateCesantia')

  /* ---- Tasas manuales (a solicitud del cliente) ---- */
  const [rateEditOpen, setRateEditOpen] = useState(false)
  const [confirmRateOpen, setConfirmRateOpen] = useState(false)
  const [draftDesg, setDraftDesg] = useState('')
  const [draftCes, setDraftCes] = useState('')
  const [draftReason, setDraftReason] = useState('')
  // Modo de obtención de la tasa de desgravamen:
  // 'directa' = el ejecutivo conoce la tasa mensual
  // 'prima'   = se calcula como prima total confirmada / monto total del crédito
  const [rateMode, setRateMode] = useState<'directa' | 'prima'>('directa')
  const [draftPrimaTotal, setDraftPrimaTotal] = useState('')
  // Base de crédito usada para la división (editable: por defecto el monto del cálculo)
  const [draftMontoCredito, setDraftMontoCredito] = useState('')


  const toFraction = (pctText: string): number | undefined => {
    const clean = (pctText || '').replace(',', '.').trim()
    if (clean === '') return undefined
    const n = Number(clean)
    if (!isFinite(n) || n < 0) return undefined
    return n / 100
  }
  const toPctText = (fraction?: number): string =>
    typeof fraction === 'number' && !Number.isNaN(fraction)
      ? String(Number((fraction * 100).toFixed(6)))
      : ''

  const activeOverrides = useMemo<TasaOverrides | undefined>(() => {
    const d = Number(watchedManualDesg)
    const c = Number(watchedManualCes)
    const ov: TasaOverrides = {}
    if (watchedManualDesg !== undefined && watchedManualDesg !== ('' as any) && isFinite(d) && d > 0) ov.tasaBancoDesgravamen = d
    if (watchedManualCes !== undefined && watchedManualCes !== ('' as any) && isFinite(c) && c > 0) ov.tasaBancoCesantia = c
    return Object.keys(ov).length > 0 ? ov : undefined
  }, [watchedManualDesg, watchedManualCes])

  const hasManualRates = !!activeOverrides


  const dirtyFields = form.formState.dirtyFields
  const hasCreditFieldEdits = Boolean(
    dirtyFields.age ||
    dirtyFields.birthDate ||
    dirtyFields.confirmedTotalAmount ||
    dirtyFields.confirmedAverageInsuredBalance ||
    dirtyFields.confirmedOriginalInstallments ||
    dirtyFields.confirmedRemainingInstallments ||
    dirtyFields.insuranceToEvaluate
  )

  const runRecalculation = useCallback((opts?: { force?: boolean; overrides?: TasaOverrides | null }): { ok: boolean; reason?: string } => {
    const banco = resolveBanco(refund.institutionId || '')
    const age = Number(form.watch('age'))
    const monto = Number(form.watch('confirmedTotalAmount') || form.watch('totalAmount'))
    const saldoInsoluto = Number(form.watch('confirmedAverageInsuredBalance') || form.watch('averageInsuredBalance'))
    const cuotasTotales = Number(form.watch('confirmedOriginalInstallments') || form.watch('originalInstallments'))
    const cuotasPendientes = Number(form.watch('confirmedRemainingInstallments') || form.watch('remainingInstallments'))
    const tipoSeguro = (form.watch('insuranceToEvaluate') || 'desgravamen') as 'desgravamen' | 'cesantia' | 'ambos'
    const ov = opts?.overrides === null ? undefined : (opts?.overrides ?? activeOverrides)

    if (!banco) return { ok: false, reason: 'Institución no soportada por la calculadora.' }
    if (!age || !monto || !cuotasTotales || !cuotasPendientes) {
      return { ok: false, reason: 'Faltan datos del crédito (edad, monto o cuotas).' }
    }

    try {
      const result = calcularDevolucion(banco, age, monto, cuotasTotales, cuotasPendientes, tipoSeguro, saldoInsoluto || undefined, ov)
      if (result.error) return { ok: false, reason: result.error }


      const force = opts?.force === true
      if (force || !overridePrimas) {
        if (result.primaBanco !== 0 || tipoSeguro !== 'cesantia') {
          form.setValue('currentMonthlyPremium', result.primaBanco, { shouldValidate: false, shouldDirty: true })
        }
        if (result.primaPreferencial !== 0 || tipoSeguro !== 'cesantia') {
          form.setValue('newMonthlyPremium', result.primaPreferencial, { shouldValidate: false, shouldDirty: true })
        }
        // Calcula prima total preferida usando las mismas fórmulas que la vista de la solicitud
        const snapForCalc = {
          ...snapshot,
          insuranceToEvaluate: tipoSeguro,
          institutionId: refund.institutionId,
          totalAmount: monto,
          averageInsuredBalance: saldoInsoluto,
          confirmedTotalAmount: monto,
          confirmedAverageInsuredBalance: saldoInsoluto,
          confirmedRemainingInstallments: cuotasPendientes,
          remainingInstallments: cuotasPendientes,
          currentMonthlyPremium: result.primaBanco,
          newMonthlyPremium: result.primaPreferencial,
          totalSaving: result.ahorroTotal,
        }
        let primaTotalAuto = 0
        const bd = computeBreakdown(snapForCalc)
        if (bd) {
          primaTotalAuto = bd.desgravamen.primaTotalTDV + bd.cesantia.primaTotalTDV
        } else {
          const cesTotal = computePureCesantiaTotalTDV(snapForCalc)
          primaTotalAuto = cesTotal !== null
            ? cesTotal
            : Math.round((result.primaPreferencial || 0) * (cuotasPendientes || 0))
        }
        form.setValue('newTotalPremium', primaTotalAuto, { shouldValidate: false, shouldDirty: true })
      }
      if (force || !overrideAhorros) {
        if (result.ahorroMensual !== 0 || tipoSeguro !== 'cesantia') {
          form.setValue('monthlySaving', result.ahorroMensual, { shouldValidate: false, shouldDirty: true })
        }
        // Aplicar el margen de seguridad configurado para la institución
        // (Ajustes → Margen de Seguridad). `calcularDevolucion` retorna la
        // devolución bruta sin margen (REFUND_MARGIN_PERCENTAGE = 0).
        const margenPct = institutionMargin
        const ahorroTotalConMargen = Math.max(
          0,
          Math.round(result.ahorroTotal * (1 - margenPct / 100)),
        )
        form.setValue('totalSaving', ahorroTotalConMargen, { shouldValidate: false, shouldDirty: true })
        // Con tasa manual la devolución estimada se sincroniza con el nuevo cálculo.
        if (ov) {
          form.setValue('estimatedAmountCLP', ahorroTotalConMargen, { shouldValidate: false, shouldDirty: true })
        }
      }
      return { ok: true }
    } catch (e) {
      return { ok: false, reason: e instanceof Error ? e.message : 'Error en el cálculo.' }
    }
  }, [form, refund.institutionId, overridePrimas, overrideAhorros, institutionMargin, activeOverrides])


  useEffect(() => {
    // Evita sobreescribir valores guardados al abrir el modal;
    // recalcula solo cuando el usuario cambia campos confirmados del crédito.
    if (!hasCreditFieldEdits) return
    runRecalculation()
  }, [
    watchedAge,
    watchedConfirmedTotalAmount,
    watchedConfirmedAverageInsuredBalance,
    watchedConfirmedOriginalInstallments,
    watchedConfirmedRemainingInstallments,
    watchedTotalAmount,
    watchedOriginalInstallments,
    watchedRemainingInstallments,
    watchedInsuranceType,
    hasCreditFieldEdits,
    refund.institutionId,
    overridePrimas,
    overrideAhorros,
  ])

  /* ---- Tasas utilizadas en el cálculo ---- */
  const computeRates = useCallback((ov?: TasaOverrides) => {
    const banco = resolveBanco(refund.institutionId || '')
    const age = Number(watchedAge)
    const monto = Number(watchedConfirmedTotalAmount || watchedTotalAmount)
    const saldoInsoluto = Number(
      watchedConfirmedAverageInsuredBalance || form.getValues('averageInsuredBalance'),
    )
    const cuotasTotales = Number(watchedConfirmedOriginalInstallments || watchedOriginalInstallments)
    const cuotasPendientes = Number(
      watchedConfirmedRemainingInstallments || watchedRemainingInstallments,
    )
    const ins = (watchedInsuranceType || 'desgravamen').toLowerCase()
    const tipoSeguro = (ins.includes('ambos')
      ? 'ambos'
      : ins.includes('cesant')
        ? 'cesantia'
        : 'desgravamen') as 'desgravamen' | 'cesantia' | 'ambos'

    if (!banco) return { error: 'La institución de esta solicitud no tiene tarifas cargadas.' }
    if (!age || !monto || !cuotasTotales || !cuotasPendientes) {
      return { error: 'Completa edad, monto y cuotas del crédito para ver las tasas.' }
    }

    try {
      const r = calcularDevolucion(
        banco, age, monto, cuotasTotales, cuotasPendientes, tipoSeguro,
        saldoInsoluto || undefined, ov,
      )
      if (r.error) return { error: r.error }
      return { banco, tipoSeguro, result: r }
    } catch (e) {
      return { error: e instanceof Error ? e.message : 'No se pudieron obtener las tasas.' }
    }
  }, [
    form,
    refund.institutionId,
    watchedAge,
    watchedConfirmedTotalAmount,
    watchedConfirmedAverageInsuredBalance,
    watchedConfirmedOriginalInstallments,
    watchedConfirmedRemainingInstallments,
    watchedTotalAmount,
    watchedOriginalInstallments,
    watchedRemainingInstallments,
    watchedInsuranceType,
  ])

  // Devolución final aplicando el margen de seguridad de la institución
  const devolucionDe = useCallback((r: any) => {
    const margenPct = typeof institutionMargin === 'number' ? institutionMargin : 0
    return Math.max(0, Math.round((r?.ahorroTotal || 0) * (1 - margenPct / 100)))
  }, [institutionMargin])

  const tasasInfo = useMemo(() => computeRates(activeOverrides), [computeRates, activeOverrides])

  // Tasas del servicio (sin override) para comparar
  const tasasServicio = useMemo(() => computeRates(undefined), [computeRates])

  // Monto total del crédito usado como base para calcular la tasa
  const montoCreditoBase = useMemo(
    () => Number(watchedConfirmedTotalAmount || watchedTotalAmount) || 0,
    [watchedConfirmedTotalAmount, watchedTotalAmount],
  )

  const primaTotalIngresada = useMemo(() => {
    const clean = (draftPrimaTotal || '').replace(/[^0-9]/g, '')
    if (!clean) return undefined
    const n = Number(clean)
    return isFinite(n) && n > 0 ? n : undefined
  }, [draftPrimaTotal])

  // Tasa de desgravamen calculada = prima total confirmada / monto total del crédito
  const tasaCalculadaDesg = useMemo(() => {
    if (!primaTotalIngresada || !montoCreditoBase) return undefined
    return primaTotalIngresada / montoCreditoBase
  }, [primaTotalIngresada, montoCreditoBase])

  // Texto de tasa desgravamen efectivo según el modo elegido
  const desgPctText = rateMode === 'prima' ? toPctText(tasaCalculadaDesg) : draftDesg

  const draftOverrides = useMemo<TasaOverrides | undefined>(() => {
    const ov: TasaOverrides = {}
    const d = toFraction(desgPctText)
    const c = toFraction(draftCes)
    if (typeof d === 'number' && d > 0) ov.tasaBancoDesgravamen = d
    if (typeof c === 'number' && c > 0) ov.tasaBancoCesantia = c
    return Object.keys(ov).length > 0 ? ov : undefined
  }, [desgPctText, draftCes])

  const draftPreview = useMemo(
    () => (rateEditOpen && draftOverrides ? computeRates(draftOverrides) : null),
    [rateEditOpen, draftOverrides, computeRates],
  )

  const openRateEditor = () => {
    const base = tasasServicio as any
    setDraftDesg(
      toPctText(
        typeof watchedManualDesg === 'number'
          ? watchedManualDesg
          : base?.result?.desgravamen?.tasaBanco,
      ),
    )
    setDraftCes(
      toPctText(
        typeof watchedManualCes === 'number'
          ? watchedManualCes
          : base?.result?.cesantia?.tasaBanco,
      ),
    )
    setDraftReason(form.getValues('manualRateReason') || '')
    setRateMode('directa')
    setDraftPrimaTotal('')
    setRateEditOpen(true)
  }


  const applyManualRates = () => {
    const ov = draftOverrides
    if (!ov) {
      toast({ title: 'Ingresa una tasa válida', variant: 'destructive' })
      return
    }
    form.setValue('manualBankRateDesgravamen', ov.tasaBancoDesgravamen as any, { shouldDirty: true })
    form.setValue('manualBankRateCesantia', ov.tasaBancoCesantia as any, { shouldDirty: true })
    const autoReason =
      rateMode === 'prima' && primaTotalIngresada
        ? `Tasa calculada: prima total ${fmtCLP(primaTotalIngresada)} ÷ crédito ${fmtCLP(montoCreditoBase)}`
        : ''
    const reasonFinal = draftReason?.trim() || autoReason
    form.setValue('manualRateReason', reasonFinal, { shouldDirty: true })

    const res = runRecalculation({ force: true, overrides: ov })
    setConfirmRateOpen(false)
    setRateEditOpen(false)
    if (!res.ok) {
      toast({ title: 'No se pudo recalcular', description: res.reason, variant: 'destructive' })
      return
    }
    toast({
      title: 'Tasa manual aplicada',
      description: 'La devolución se recalculó con la tasa ingresada. Revisa y guarda los cambios.',
    })
  }

  const clearManualRates = () => {
    form.setValue('manualBankRateDesgravamen', undefined as any, { shouldDirty: true })
    form.setValue('manualBankRateCesantia', undefined as any, { shouldDirty: true })
    form.setValue('manualRateReason', '', { shouldDirty: true })
    setRateEditOpen(false)
    const res = runRecalculation({ force: true, overrides: null })
    if (res.ok) {
      const total = Number(form.getValues('totalSaving')) || 0
      form.setValue('estimatedAmountCLP', total, { shouldDirty: true })
      toast({ title: 'Tasa del servicio restablecida', description: 'Se recalculó con las tarifas vigentes.' })
    }
  }


  const AUTO_CALCULATED_FIELDS: (keyof SnapshotFormValues)[] = [
    'currentMonthlyPremium', 'newMonthlyPremium', 'monthlySaving', 'totalSaving',
  ]


  const MANUAL_RATE_FIELDS: (keyof SnapshotFormValues)[] = [
    'manualBankRateDesgravamen', 'manualBankRateCesantia',
  ]

  const getChanges = useCallback((data: SnapshotFormValues): FieldChange[] => {
    const changes: FieldChange[] = []
    for (const [key, value] of Object.entries(data) as [keyof SnapshotFormValues, any][]) {
      const original = defaults[key]
      const isClearedManualRate =
        MANUAL_RATE_FIELDS.includes(key) &&
        (value === undefined || value === '') &&
        typeof original === 'number'
      if (!isClearedManualRate) {
        if (value === original || (value === '' && (original === '' || original === undefined)) || value === undefined) continue
      }
      const isManualRate = MANUAL_RATE_FIELDS.includes(key)
      const fmtRate = (v: any) => (typeof v === 'number' ? fmtPct(v) : '')
      const isAutoField = AUTO_CALCULATED_FIELDS.includes(key)
      const isManuallyOverridden = 
        (key === 'currentMonthlyPremium' || key === 'newMonthlyPremium') ? overridePrimas :
        (key === 'monthlySaving' || key === 'totalSaving') ? overrideAhorros : false
      changes.push({
        label: FIELD_LABELS[key] || key,
        from: isManualRate ? (fmtRate(original) || 'Tasa del servicio') : String(original ?? ''),
        to: isManualRate
          ? (isClearedManualRate ? 'Tasa del servicio' : fmtRate(value))
          : String(value),
        isAutoCalculated: isAutoField && !isManuallyOverridden,
        isManualOverride: (isAutoField && isManuallyOverridden) || isManualRate,
      })
    }
    return changes
  }, [defaults, overridePrimas, overrideAhorros])


  const mutation = useMutation({
    mutationFn: async (values: SnapshotFormValues) => {
      const snapshotPatch: Record<string, any> = {}
      const rootPatch: Record<string, any> = {}
      const ROOT_FIELDS = ['estimatedAmountCLP', 'realAmount']
      const ALWAYS_SEND_FIELDS = [
        'confirmedTotalAmount', 'confirmedAverageInsuredBalance',
        'confirmedOriginalInstallments', 'confirmedRemainingInstallments',
      ]

      for (const [key, value] of Object.entries(values) as [keyof SnapshotFormValues, any][]) {
        const original = defaults[key]
        const isAlwaysSend = ALWAYS_SEND_FIELDS.includes(key)
        if (!isAlwaysSend && (value === original || value === '' || value === undefined)) continue
        if (value === '' || value === undefined) continue
        
        if (ROOT_FIELDS.includes(key)) {
          rootPatch[key] = value
        } else {
          snapshotPatch[key] = key === 'birthDate' && typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
            ? `${value}T12:00:00`
            : value
        }
      }

      // Si se quitó una tasa manual previamente guardada, enviarla como null
      // para volver a las tarifas del servicio.
      for (const key of MANUAL_RATE_FIELDS) {
        const value = (values as any)[key]
        if ((value === undefined || value === '') && typeof (defaults as any)[key] === 'number') {
          snapshotPatch[key] = null
          snapshotPatch.manualRateReason = ''
        }
      }


      if (Object.keys(snapshotPatch).length === 0 && Object.keys(rootPatch).length === 0) {
        return Promise.reject(new Error('No hay cambios para guardar'))
      }

      const payload: Record<string, any> = { ...rootPatch }
      if (Object.keys(snapshotPatch).length > 0) {
        // Persistir el margen de seguridad vigente (consultado al servicio de
        // instituciones al momento del recálculo). El detalle lo lee de aquí
        // sin recalcular ni reconsultar el servicio.
        if (typeof institutionMargin === 'number' && !Number.isNaN(institutionMargin)) {
          snapshotPatch.safetyMarginPct = institutionMargin
        }
        payload.calculationSnapshot = { ...snapshot, ...snapshotPatch }
      }

      return refundAdminApi.updateData(refund.publicId, payload)
    },
    onSuccess: async () => {
      const changes = getChanges(pendingData!)

      if (pendingData) {
        // Guardar último estado confirmado para reapertura inmediata del modal
        latestSavedValuesRef.current = { ...pendingData }
        latestSavedAtRef.current = Date.now()

        // Aplicar patch optimista en detalle usando los datos enviados
        // (no depender de la forma de respuesta del backend)
        const rootPatch: Record<string, any> = {}
        const snapshotPatch: Record<string, any> = {}
        const ROOT_FIELDS: (keyof SnapshotFormValues)[] = ['estimatedAmountCLP', 'realAmount']

        for (const [key, value] of Object.entries(pendingData) as [keyof SnapshotFormValues, any][]) {
          const original = defaults[key]
          if (value === original || value === '' || value === undefined) continue

          if (ROOT_FIELDS.includes(key)) {
            rootPatch[key] = value
          } else {
            snapshotPatch[key] =
              key === 'birthDate' && typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
                ? `${value}T12:00:00`
                : value
          }
        }

        queryClient.setQueriesData({ queryKey: ['refund'] }, (cached: any) => {
          if (!cached || cached.publicId !== refund.publicId) return cached
          return {
            ...cached,
            ...rootPatch,
            calculationSnapshot:
              Object.keys(snapshotPatch).length > 0
                ? { ...(cached.calculationSnapshot || {}), ...snapshotPatch }
                : cached.calculationSnapshot,
          }
        })
      }

      toast({
        title: '✅ Snapshot actualizado',
        description: `${changes.length} campo${changes.length > 1 ? 's' : ''} del cálculo actualizado${changes.length > 1 ? 's' : ''}`,
      })

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['refund', refund.publicId] }),
        queryClient.invalidateQueries({ queryKey: ['refunds'] }),
        queryClient.invalidateQueries({ queryKey: ['operacion-all-refunds'] }),
      ])
      setOpen(false)
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    },
  })

  const onSubmit = (data: SnapshotFormValues) => {
    const changes = getChanges(data)
    if (changes.length === 0) {
      toast({ title: 'Sin cambios', description: 'No se detectaron modificaciones', variant: 'destructive' })
      return
    }
    setPendingData(data)
    setStep('confirm')
  }

  const handleConfirm = () => {
    if (pendingData) mutation.mutate(pendingData)
  }

  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen) {
      form.reset(getResetValues())
      setStep('form')
      setPendingData(null)
      setOverridePrimas(false)
      setOverrideAhorros(false)
      setRateEditOpen(false)
      setConfirmRateOpen(false)

    }
    setOpen(isOpen)
  }


  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Settings2 className="h-4 w-4" />
          Editar snapshot
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5 text-primary" />
            {step === 'form' ? 'Editar snapshot de cálculo' : 'Confirmar cambios'}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            {step === 'form'
              ? 'Modifica los datos del cálculo asociado a esta solicitud. Solo se enviarán los campos que cambies.'
              : 'Revisa los cambios antes de guardar.'}
          </p>
        </DialogHeader>

        {step === 'confirm' && pendingData ? (
          <ConfirmChangesStep
            changes={getChanges(pendingData)}
            onConfirm={handleConfirm}
            onBack={() => setStep('form')}
            isPending={mutation.isPending}
          />
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5 py-2">
              {/* ---- Datos del crédito (simulación - solo lectura) ---- */}
              <Section icon={CreditCard} title="Datos del crédito (simulación)">
                <FormField
                  control={form.control}
                  name="creditType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Tipo de crédito</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccionar" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="consumo">Consumo</SelectItem>
                          <SelectItem value="automotriz">Automotriz</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="insuranceToEvaluate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Seguro a evaluar</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccionar" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="desgravamen">Desgravamen</SelectItem>
                          <SelectItem value="cesantia">Cesantía</SelectItem>
                          <SelectItem value="ambos">Ambos</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="totalAmount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Monto total crédito</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
                          <Input {...field} readOnly tabIndex={-1} className="pl-7 bg-muted cursor-not-allowed" />
                        </div>
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="averageInsuredBalance"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Saldo insoluto</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
                          <Input {...field} readOnly tabIndex={-1} className="pl-7 bg-muted cursor-not-allowed" />
                        </div>
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="originalInstallments"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Cuotas originales</FormLabel>
                      <FormControl>
                        <Input {...field} readOnly tabIndex={-1} className="bg-muted cursor-not-allowed" />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="remainingInstallments"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Cuotas restantes</FormLabel>
                      <FormControl>
                        <Input {...field} readOnly tabIndex={-1} className="bg-muted cursor-not-allowed" />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </Section>

              <Separator />

              {/* ---- Datos confirmados del crédito ---- */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    <h4 className="text-sm font-semibold tracking-wide uppercase text-muted-foreground">
                      Datos confirmados del crédito
                    </h4>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 gap-1.5 text-xs"
                      onClick={() => {
                        const res = runRecalculation({ force: true })
                        if (res.ok) {
                          toast({ title: 'Cálculo actualizado', description: 'Primas y ahorros recalculados con los datos actuales.' })
                        } else {
                          toast({ title: 'No se pudo recalcular', description: res.reason, variant: 'destructive' })
                        }
                      }}
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      Recalcular ahora
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 gap-1.5 text-xs"
                      onClick={() => {
                        const simValues = form.getValues()
                        form.setValue('confirmedTotalAmount', simValues.totalAmount, { shouldDirty: true })
                        form.setValue('confirmedAverageInsuredBalance', simValues.averageInsuredBalance, { shouldDirty: true })
                        form.setValue('confirmedOriginalInstallments', simValues.originalInstallments, { shouldDirty: true })
                        form.setValue('confirmedRemainingInstallments', simValues.remainingInstallments, { shouldDirty: true })
                      }}
                    >
                      <Copy className="h-3.5 w-3.5" />
                      Confirmar datos de simulación
                    </Button>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Confirma los valores definitivos del crédito. Estos campos son <span className="font-semibold text-foreground">obligatorios</span> para guardar cambios.
                </p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                  <NumberField control={form.control} name="confirmedTotalAmount" label="Monto total crédito *" prefix="$" />
                  <NumberField control={form.control} name="confirmedAverageInsuredBalance" label="Saldo insoluto *" prefix="$" />
                  <NumberField control={form.control} name="confirmedOriginalInstallments" label="Cuotas originales *" />
                  <NumberField control={form.control} name="confirmedRemainingInstallments" label="Cuotas restantes *" />
                  <FormField
                    control={form.control}
                    name="nroPoliza"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Nro. Póliza</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Ej: 12345" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="nroCredito"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Nro. Crédito</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Ej: 67890" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <Separator />

              {/* ---- Primas y seguros ---- */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-primary" />
                    <h4 className="text-sm font-semibold tracking-wide uppercase text-muted-foreground">
                      Primas y seguros
                    </h4>
                  </div>
                  <Button
                    type="button"
                    variant={overridePrimas ? 'destructive' : 'ghost'}
                    size="sm"
                    className="h-7 gap-1.5 text-xs"
                    onClick={() => {
                      const next = !overridePrimas
                      setOverridePrimas(next)
                      if (next) {
                        // Pre-popula valores auto-calculados al desbloquear
                        runRecalculation({ force: true })
                      }
                    }}
                  >
                    {overridePrimas ? <Unlock className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
                    {overridePrimas ? 'Modo manual' : 'Desbloquear'}
                  </Button>
                </div>

                {overridePrimas && (
                  <Alert variant="destructive" className="py-2">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription className="text-xs">
                      Estás sobrescribiendo valores auto-calculados. Los cambios en datos del crédito no actualizarán estos campos.
                    </AlertDescription>
                  </Alert>
                )}

                <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                  <FormField
                    control={form.control}
                    name="currentMonthlyPremium"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Prima mensual actual</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
                            {overridePrimas ? (
                              <Input
                                {...field}
                                type="text"
                                inputMode="numeric"
                                onChange={(e) => {
                                  const val = e.target.value.replace(/[^0-9.]/g, '')
                                  field.onChange(val === '' ? '' : val)
                                }}
                                className="pl-7 border-destructive/50 focus-visible:ring-destructive/30"
                              />
                            ) : (
                              <Input {...field} readOnly tabIndex={-1} className="pl-7 bg-muted cursor-not-allowed" />
                            )}
                          </div>
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="newMonthlyPremium"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Nueva prima mensual</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
                            {overridePrimas ? (
                              <Input
                                {...field}
                                type="text"
                                inputMode="numeric"
                                onChange={(e) => {
                                  const val = e.target.value.replace(/[^0-9.]/g, '')
                                  field.onChange(val === '' ? '' : val)
                                }}
                                className="pl-7 border-destructive/50 focus-visible:ring-destructive/30"
                              />
                            ) : (
                              <Input {...field} readOnly tabIndex={-1} className="pl-7 bg-muted cursor-not-allowed" />
                            )}
                          </div>
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="newTotalPremium"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs flex items-center justify-between">
                        <span>Prima total (override manual)</span>
                        <span className="text-[10px] text-muted-foreground font-normal">
                          {overridePrimas ? 'Editable' : 'Bloqueado · desbloquea primas para editar'}
                        </span>
                      </FormLabel>
                      <FormControl>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
                          {overridePrimas ? (
                            <Input
                              {...field}
                              value={field.value ?? ''}
                              type="text"
                              inputMode="numeric"
                              onChange={(e) => {
                                const val = e.target.value.replace(/[^0-9.]/g, '')
                                field.onChange(val === '' ? '' : val)
                              }}
                              className="pl-7 border-destructive/50 focus-visible:ring-destructive/30"
                              placeholder="Auto: prima mensual × cuotas restantes"
                            />
                          ) : (
                            <Input
                              {...field}
                              value={field.value ?? ''}
                              readOnly
                              tabIndex={-1}
                              className="pl-7 bg-muted cursor-not-allowed"
                            />
                          )}
                        </div>
                      </FormControl>
                      <p className="text-[11px] text-muted-foreground">
                        Si lo dejas vacío, la lista y los reportes calcularán el total automáticamente. Úsalo solo para casos borde donde el cálculo no cuadra.
                      </p>
                    </FormItem>
                  )}
                />
              </div>

              <Separator />

              {/* ---- Ahorros calculados ---- */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-primary" />
                    <h4 className="text-sm font-semibold tracking-wide uppercase text-muted-foreground">
                      Ahorros calculados
                    </h4>
                  </div>
                  <Button
                    type="button"
                    variant={overrideAhorros ? 'destructive' : 'ghost'}
                    size="sm"
                    className="h-7 gap-1.5 text-xs"
                    onClick={() => setOverrideAhorros(!overrideAhorros)}
                  >
                    {overrideAhorros ? <Unlock className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
                    {overrideAhorros ? 'Modo manual' : 'Desbloquear'}
                  </Button>
                </div>

                {overrideAhorros && (
                  <Alert variant="destructive" className="py-2">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription className="text-xs">
                      Estás sobrescribiendo valores auto-calculados. Los cambios en datos del crédito no actualizarán estos campos.
                    </AlertDescription>
                  </Alert>
                )}

                <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                  {(() => {
                    const ins = (watchedInsuranceType || '').toLowerCase()
                    const isCesantia = ins === 'cesantia' || ins.includes('cesant')
                    if (isCesantia) return null
                    return (
                  <FormField
                    control={form.control}
                    name="monthlySaving"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Ahorro mensual</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
                            {overrideAhorros ? (
                              <Input
                                {...field}
                                type="text"
                                inputMode="numeric"
                                onChange={(e) => {
                                  const val = e.target.value.replace(/[^0-9.]/g, '')
                                  field.onChange(val === '' ? '' : val)
                                }}
                                className="pl-7 border-destructive/50 focus-visible:ring-destructive/30"
                              />
                            ) : (
                              <Input {...field} readOnly tabIndex={-1} className="pl-7 bg-muted cursor-not-allowed" />
                            )}
                          </div>
                        </FormControl>
                      </FormItem>
                    )}
                  />
                    )
                  })()}
                  <FormField
                    control={form.control}
                    name="totalSaving"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Ahorro total</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
                            {overrideAhorros ? (
                              <Input
                                {...field}
                                type="text"
                                inputMode="numeric"
                                onChange={(e) => {
                                  const val = e.target.value.replace(/[^0-9.]/g, '')
                                  field.onChange(val === '' ? '' : val)
                                }}
                                className="pl-7 border-destructive/50 focus-visible:ring-destructive/30"
                              />
                            ) : (
                              <Input {...field} readOnly tabIndex={-1} className="pl-7 bg-muted cursor-not-allowed" />
                            )}
                          </div>
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <Separator />

              {/* ---- Tasas utilizadas en el cálculo ---- */}
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Percent className="h-4 w-4 text-primary" />
                  <h4 className="text-sm font-semibold tracking-wide uppercase text-muted-foreground">
                    Tasas utilizadas en el cálculo
                  </h4>
                  <div className="ml-auto flex items-center gap-2">
                    {hasManualRates && (
                      <span className="rounded-md bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">
                        Tasa manual
                      </span>
                    )}
                    {!rateEditOpen && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 gap-1.5 text-xs"
                        onClick={openRateEditor}
                        disabled={'error' in tasasServicio && !!(tasasServicio as any).error}
                      >
                        <Unlock className="h-3.5 w-3.5" />
                        {hasManualRates ? 'Editar tasa manual' : 'Solicitar edición de tasa'}
                      </Button>
                    )}
                    {hasManualRates && !rateEditOpen && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 gap-1.5 text-xs"
                        onClick={clearManualRates}
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                        Usar tasa del servicio
                      </Button>
                    )}
                  </div>
                </div>

                {'error' in tasasInfo && tasasInfo.error ? (
                  <Alert className="py-2">
                    <Info className="h-4 w-4" />
                    <AlertDescription className="text-xs">{tasasInfo.error}</AlertDescription>
                  </Alert>
                ) : (
                  (() => {
                    const info = tasasInfo as { banco: string; tipoSeguro: string; result: any }
                    const r = info.result
                    const desg = r.desgravamen
                    const ces = r.cesantia
                    return (
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                          <span className="rounded-md border px-2 py-0.5">
                            Institución: <span className="font-medium text-foreground">{info.banco}</span>
                          </span>
                          <span className="rounded-md border px-2 py-0.5">
                            Seguro: <span className="font-medium text-foreground capitalize">{info.tipoSeguro}</span>
                          </span>
                          {typeof institutionMargin === 'number' && (
                            <span className="rounded-md border px-2 py-0.5">
                              Margen de seguridad:{' '}
                              <span className="font-medium text-foreground">{institutionMargin}%</span>
                            </span>
                          )}
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2">
                          {desg && (
                            <RateCard
                              title="Desgravamen · tasa banco"
                              tasa={desg.tasaBanco}
                              manual={typeof activeOverrides?.tasaBancoDesgravamen === 'number'}
                              rows={[
                                { label: 'Tramo de edad', value: TRAMO_EDAD_LABEL[r.tramoUsado] || r.tramoUsado || '—' },
                                { label: 'Cuotas de la tabla', value: desg.cuotasUtilizadas ?? '—' },
                                { label: 'Monto tarificado', value: fmtCLP(desg.montoRedondeado) },
                                { label: 'Prima única banco', value: fmtCLP(desg.primaUnicaBanco) },
                                { label: 'Prima mensual banco', value: fmtCLP(desg.primaMensualBanco) },
                              ]}
                            />
                          )}
                          {ces && (
                            <RateCard
                              title="Cesantía · tasa banco"
                              tasa={ces.tasaBanco}
                              manual={typeof activeOverrides?.tasaBancoCesantia === 'number'}
                              rows={[
                                {
                                  label: 'Tramo de saldo',
                                  value: TRAMO_MONTO_LABEL[ces.tramoUsado] || ces.tramoUsado || '—',
                                },
                                { label: 'Saldo insoluto', value: fmtCLP(ces.saldoInsoluto) },
                                { label: 'Cuotas pendientes', value: ces.cuotasPendientes ?? '—' },
                                { label: 'Prima restante banco', value: fmtCLP(ces.primaRestanteBanco) },
                              ]}
                            />
                          )}
                        </div>

                        {hasManualRates ? (
                          <div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-2 space-y-1">
                            <p className="text-[11px] text-amber-700 dark:text-amber-400">
                              Esta solicitud usa una tasa registrada manualmente. La devolución
                              estimada se calculó con ese valor, no con las tarifas del servicio.
                            </p>
                            {form.getValues('manualRateReason') && (
                              <p className="text-[11px] text-muted-foreground">
                                Motivo: {form.getValues('manualRateReason')}
                              </p>
                            )}
                          </div>
                        ) : (
                          <p className="text-[11px] text-muted-foreground">
                            Tasas mensuales vigentes según la configuración de Ajustes → Tasas. Se
                            actualizan automáticamente al modificar los datos del crédito.
                          </p>
                        )}
                      </div>
                    )
                  })()
                )}

                {/* ---- Editor de tasa manual ---- */}
                {rateEditOpen && (
                  <div className="rounded-lg border border-amber-500/50 bg-amber-500/5 p-3 space-y-3">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                      <span className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">
                        Registrar tasa manual (a solicitud del cliente)
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Si el cliente informó la tasa, ingrésala directamente. Si no la tiene, calcúlala
                      a partir de la prima total del crédito.
                    </p>

                    {/* Selector de modo */}
                    <div className="inline-flex rounded-md border bg-card p-0.5">
                      <Button
                        type="button"
                        size="sm"
                        variant={rateMode === 'directa' ? 'default' : 'ghost'}
                        className="h-7 text-xs"
                        onClick={() => setRateMode('directa')}
                      >
                        Conozco la tasa
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={rateMode === 'prima' ? 'default' : 'ghost'}
                        className="h-7 text-xs"
                        onClick={() => setRateMode('prima')}
                      >
                        Calcular desde la prima
                      </Button>
                    </div>

                    {rateMode === 'prima' && (
                      <div className="rounded-md border bg-card p-3 space-y-2">
                        <label className="text-xs font-medium">
                          Monto total de la prima (confirmada del crédito)
                        </label>
                        <Input
                          value={draftPrimaTotal ? fmtCLP(Number(draftPrimaTotal)) : ''}
                          inputMode="numeric"
                          placeholder="$0"
                          onChange={(e) => setDraftPrimaTotal(e.target.value.replace(/[^0-9]/g, ''))}
                        />
                        <div className="space-y-1 pt-1">
                          <RateRow label="Monto total del crédito" value={fmtCLP(montoCreditoBase)} />
                          <RateRow
                            label="Tasa de desgravamen calculada"
                            value={
                              tasaCalculadaDesg ? (
                                <span className="text-primary font-semibold">{fmtPct(tasaCalculadaDesg)}</span>
                              ) : (
                                '—'
                              )
                            }
                          />
                        </div>
                        <p className="text-[10px] text-muted-foreground">
                          Tasa = prima total ÷ monto total del crédito.
                          {!montoCreditoBase && ' Falta el monto total del crédito en el cálculo.'}
                        </p>
                      </div>
                    )}

                    <div className="grid gap-3 sm:grid-cols-2">
                      {(() => {
                        const base = tasasServicio as any
                        const showDesg = !!base?.result?.desgravamen
                        const showCes = !!base?.result?.cesantia
                        return (
                          <>
                            {showDesg && rateMode === 'directa' && (
                              <div className="space-y-1">
                                <label className="text-xs font-medium">Tasa · Desgravamen</label>
                                <div className="relative">
                                  <Input
                                    value={draftDesg}
                                    inputMode="decimal"
                                    onChange={(e) => setDraftDesg(e.target.value.replace(/[^0-9.,]/g, ''))}
                                    className="pr-7"
                                  />
                                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                                    %
                                  </span>
                                </div>
                                <p className="text-[10px] text-muted-foreground">
                                  Servicio: {fmtPct(base.result.desgravamen.tasaBanco)}
                                </p>
                              </div>
                            )}
                            {showCes && (
                              <div className="space-y-1">
                                <label className="text-xs font-medium">Tasa mensual · Cesantía</label>
                                <div className="relative">
                                  <Input
                                    value={draftCes}
                                    inputMode="decimal"
                                    onChange={(e) => setDraftCes(e.target.value.replace(/[^0-9.,]/g, ''))}
                                    className="pr-7"
                                  />
                                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                                    %
                                  </span>
                                </div>
                                <p className="text-[10px] text-muted-foreground">
                                  Servicio: {fmtPct(base.result.cesantia.tasaBanco)}
                                </p>
                              </div>
                            )}
                          </>
                        )
                      })()}
                    </div>


                    <div className="space-y-1">
                      <label className="text-xs font-medium">Motivo / respaldo (opcional)</label>
                      <Textarea
                        value={draftReason}
                        onChange={(e) => setDraftReason(e.target.value)}
                        rows={2}
                        maxLength={200}
                        placeholder="Ej: tasa informada en certificado del banco entregado por el cliente"
                        className="text-xs"
                      />
                    </div>

                    {/* Vista previa del impacto */}
                    {draftPreview && !('error' in draftPreview && (draftPreview as any).error) && (
                      <div className="rounded-md border bg-card p-3 space-y-2">
                        <div className="flex items-center gap-2">
                          <TrendingUp className="h-3.5 w-3.5 text-primary" />
                          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            Impacto en la devolución
                          </span>
                        </div>
                        {(() => {
                          const before = (tasasServicio as any)?.result
                          const after = (draftPreview as any).result
                          const devBefore = devolucionDe(before)
                          const devAfter = devolucionDe(after)
                          const diff = devAfter - devBefore
                          return (
                            <div className="space-y-1">
                              <RateRow label="Devolución con tasa del servicio" value={fmtCLP(devBefore)} />
                              <RateRow
                                label="Devolución con tasa manual"
                                value={<span className="text-primary font-semibold">{fmtCLP(devAfter)}</span>}
                              />
                              <RateRow
                                label="Diferencia"
                                value={
                                  <span className={diff >= 0 ? 'text-emerald-600' : 'text-destructive'}>
                                    {diff >= 0 ? '+' : '−'}{fmtCLP(Math.abs(diff))}
                                    {devBefore > 0 && (
                                      <span className="text-muted-foreground font-normal">
                                        {' '}({((diff / devBefore) * 100).toFixed(1)}%)
                                      </span>
                                    )}
                                  </span>
                                }
                              />
                            </div>
                          )
                        })()}
                      </div>
                    )}
                    {draftPreview && 'error' in draftPreview && (draftPreview as any).error && (
                      <Alert variant="destructive" className="py-2">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription className="text-xs">{(draftPreview as any).error}</AlertDescription>
                      </Alert>
                    )}

                    <div className="flex justify-end gap-2 pt-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setRateEditOpen(false)}
                      >
                        Cancelar
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        className="gap-1.5"
                        disabled={!draftOverrides}
                        onClick={() => setConfirmRateOpen(true)}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Confirmar y recalcular
                      </Button>
                    </div>
                  </div>
                )}

                <AlertDialog open={confirmRateOpen} onOpenChange={setConfirmRateOpen}>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>¿Aplicar la tasa registrada manualmente?</AlertDialogTitle>
                      <AlertDialogDescription className="space-y-2">
                        <span className="block">
                          Se reemplazará la tasa del servicio por la que ingresaste y se recalculará
                          la devolución de esta solicitud.
                        </span>
                        <span className="block text-xs">
                          {typeof draftOverrides?.tasaBancoDesgravamen === 'number' && (
                            <span className="block">
                              Desgravamen: {fmtPct(draftOverrides.tasaBancoDesgravamen)}
                            </span>
                          )}
                          {typeof draftOverrides?.tasaBancoCesantia === 'number' && (
                            <span className="block">
                              Cesantía: {fmtPct(draftOverrides.tasaBancoCesantia)}
                            </span>
                          )}
                        </span>
                        <span className="block text-xs">
                          Los cambios se guardan al confirmar el paso “Revisar cambios”.
                        </span>
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Volver</AlertDialogCancel>
                      <AlertDialogAction onClick={applyManualRates}>
                        Sí, aplicar tasa manual
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>


              <Separator />



              <Section icon={TrendingUp} title="Montos de devolución">
                <NumberField control={form.control} name="estimatedAmountCLP" label="Monto estimado devolución" prefix="$" />
                <NumberField control={form.control} name="realAmount" label="Monto real devolución" prefix="$" />
              </Section>

              <Separator />

              <Section icon={Calculator} title="Demografía y meta">
                <FormField
                  name="birthDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Fecha de nacimiento</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="date"
                          onChange={(e) => {
                            field.onChange(e)
                            const age = calcAge(e.target.value)
                            if (age !== undefined) form.setValue('age', age)
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="age"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Edad</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            {...field}
                            readOnly
                            tabIndex={-1}
                            className="bg-muted cursor-not-allowed"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                            años
                          </span>
                        </div>
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="rateSet"
                  render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel className="text-xs">Versión de tarifas</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="ej: v2024-01" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </Section>

              {/* ---- Actions ---- */}
              <div className="flex justify-end gap-2 pt-3 border-t">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit">
                  Revisar cambios
                </Button>
              </div>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  )
}
