import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { refundAdminApi } from '@/services/refundAdminApi'
import type { RefundRequest } from '@/types/refund'
import { calcularDevolucion } from '@/lib/calculadoraUtils'
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
import { Calculator, CreditCard, Shield, TrendingUp, Settings2, Lock, Unlock, AlertTriangle, CheckCircle2, Copy } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
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
  // Confirmed credit fields (definitive values)
  confirmedTotalAmount: z.coerce.number().min(0).optional(),
  confirmedAverageInsuredBalance: z.coerce.number().min(0).optional(),
  confirmedOriginalInstallments: z.coerce.number().int().min(0).optional(),
  confirmedRemainingInstallments: z.coerce.number().int().min(0).optional(),
  currentMonthlyPremium: z.coerce.number().min(0).optional(),
  newMonthlyPremium: z.coerce.number().min(0).optional(),
  monthlySaving: z.coerce.number().min(0).optional(),
  totalSaving: z.coerce.number().min(0).optional(),
  birthDate: z.string().trim().optional().or(z.literal('')),
  age: z.coerce.number().int().min(0).max(120).optional(),
  rateSet: z.string().trim().max(100).optional().or(z.literal('')),
  // Campos root-level del refund
  estimatedAmountCLP: z.coerce.number().min(0).optional(),
  realAmount: z.coerce.number().min(0).optional(),
})

type SnapshotFormValues = z.infer<typeof snapshotSchema>

const FIELD_LABELS: Record<keyof SnapshotFormValues, string> = {
  creditType: 'Tipo de crédito',
  insuranceToEvaluate: 'Seguro a evaluar',
  totalAmount: 'Monto total crédito',
  averageInsuredBalance: 'Saldo asegurado promedio',
  originalInstallments: 'Cuotas originales',
  remainingInstallments: 'Cuotas restantes',
  confirmedTotalAmount: 'Monto total crédito (confirmado)',
  confirmedAverageInsuredBalance: 'Saldo asegurado promedio (confirmado)',
  confirmedOriginalInstallments: 'Cuotas originales (confirmado)',
  confirmedRemainingInstallments: 'Cuotas restantes (confirmado)',
  currentMonthlyPremium: 'Prima mensual actual',
  newMonthlyPremium: 'Nueva prima mensual',
  monthlySaving: 'Ahorro mensual',
  totalSaving: 'Ahorro total',
  birthDate: 'Fecha de nacimiento',
  age: 'Edad',
  rateSet: 'Versión de tarifas',
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
/*  Component                                                          */
/* ------------------------------------------------------------------ */

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

  // Map institutionId to calculator-compatible bank name
  const INSTITUTION_TO_CALC: Record<string, string> = {
    santander: 'Santander', bci: 'BCI', scotiabank: 'Scotiabank',
    chile: 'Chile', security: 'Security', itau: 'Itaú - Corpbanca',
    'itau-corpbanca': 'Itaú - Corpbanca', bice: 'BICE', estado: 'Estado',
    ripley: 'Banco Ripley', falabella: 'Falabella', consorcio: 'Consorcio',
    coopeuch: 'Coopeuch', cencosud: 'Cencosud', 'lider-bci': 'Lider BCI',
    forum: 'Forum', tanner: 'Tanner', cooperativas: 'Cooperativas',
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
      confirmedTotalAmount: currentSnapshot.confirmedTotalAmount ?? undefined,
      confirmedAverageInsuredBalance: currentSnapshot.confirmedAverageInsuredBalance ?? undefined,
      confirmedOriginalInstallments: currentSnapshot.confirmedOriginalInstallments ?? undefined,
      confirmedRemainingInstallments: currentSnapshot.confirmedRemainingInstallments ?? undefined,
      currentMonthlyPremium: currentSnapshot.currentMonthlyPremium ?? undefined,
      newMonthlyPremium: currentSnapshot.newMonthlyPremium ?? undefined,
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
  const watchedConfirmedOriginalInstallments = form.watch('confirmedOriginalInstallments')
  const watchedConfirmedRemainingInstallments = form.watch('confirmedRemainingInstallments')
  const watchedTotalAmount = form.watch('totalAmount')
  const watchedOriginalInstallments = form.watch('originalInstallments')
  const watchedRemainingInstallments = form.watch('remainingInstallments')
  const watchedInsuranceType = form.watch('insuranceToEvaluate')

  const dirtyFields = form.formState.dirtyFields
  const hasCreditFieldEdits = Boolean(
    dirtyFields.age ||
    dirtyFields.birthDate ||
    dirtyFields.confirmedTotalAmount ||
    dirtyFields.confirmedOriginalInstallments ||
    dirtyFields.confirmedRemainingInstallments ||
    dirtyFields.insuranceToEvaluate
  )

  useEffect(() => {
    // Evita sobreescribir valores guardados al abrir el modal;
    // recalcula solo cuando el usuario cambia campos confirmados del crédito.
    if (!hasCreditFieldEdits) return

    const banco = INSTITUTION_TO_CALC[(refund.institutionId || '').toLowerCase()]
    const age = Number(watchedAge)
    // Use confirmed values if available, fallback to simulation
    const monto = Number(watchedConfirmedTotalAmount || watchedTotalAmount)
    const cuotasTotales = Number(watchedConfirmedOriginalInstallments || watchedOriginalInstallments)
    const cuotasPendientes = Number(watchedConfirmedRemainingInstallments || watchedRemainingInstallments)
    const tipoSeguro = (watchedInsuranceType || 'desgravamen') as 'desgravamen' | 'cesantia' | 'ambos'

    if (!banco || !age || !monto || !cuotasTotales || !cuotasPendientes) return

    try {
      const result = calcularDevolucion(banco, age, monto, cuotasTotales, cuotasPendientes, tipoSeguro)
      if (result.error) return

      if (!overridePrimas) {
        form.setValue('currentMonthlyPremium', result.primaBanco)
        form.setValue('newMonthlyPremium', result.primaPreferencial)
      }
      if (!overrideAhorros) {
        form.setValue('monthlySaving', result.ahorroMensual)
        form.setValue('totalSaving', result.ahorroTotal)
      }
    } catch {
      // Silently ignore calculation errors
    }
  }, [
    watchedAge,
    watchedConfirmedTotalAmount,
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

  const AUTO_CALCULATED_FIELDS: (keyof SnapshotFormValues)[] = [
    'currentMonthlyPremium', 'newMonthlyPremium', 'monthlySaving', 'totalSaving',
  ]

  const getChanges = useCallback((data: SnapshotFormValues): FieldChange[] => {
    const changes: FieldChange[] = []
    for (const [key, value] of Object.entries(data) as [keyof SnapshotFormValues, any][]) {
      const original = defaults[key]
      if (value === original || (value === '' && (original === '' || original === undefined)) || value === undefined) continue
      const isAutoField = AUTO_CALCULATED_FIELDS.includes(key)
      const isManuallyOverridden = 
        (key === 'currentMonthlyPremium' || key === 'newMonthlyPremium') ? overridePrimas :
        (key === 'monthlySaving' || key === 'totalSaving') ? overrideAhorros : false
      changes.push({
        label: FIELD_LABELS[key] || key,
        from: String(original ?? ''),
        to: String(value),
        isAutoCalculated: isAutoField && !isManuallyOverridden,
        isManualOverride: isAutoField && isManuallyOverridden,
      })
    }
    return changes
  }, [defaults])

  const mutation = useMutation({
    mutationFn: async (values: SnapshotFormValues) => {
      const snapshotPatch: Record<string, any> = {}
      const rootPatch: Record<string, any> = {}
      const ROOT_FIELDS = ['estimatedAmountCLP', 'realAmount']

      for (const [key, value] of Object.entries(values) as [keyof SnapshotFormValues, any][]) {
        const original = defaults[key]
        if (value === original || value === '' || value === undefined) continue
        
        if (ROOT_FIELDS.includes(key)) {
          rootPatch[key] = value
        } else {
          snapshotPatch[key] = key === 'birthDate' && typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
            ? `${value}T12:00:00`
            : value
        }
      }

      if (Object.keys(snapshotPatch).length === 0 && Object.keys(rootPatch).length === 0) {
        return Promise.reject(new Error('No hay cambios para guardar'))
      }

      const payload: Record<string, any> = { ...rootPatch }
      if (Object.keys(snapshotPatch).length > 0) {
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
    }
    setOpen(isOpen)
  }

  /* ---- Field helpers ---- */

  const NumberField = ({
    name,
    label,
    prefix,
    suffix,
    className,
  }: {
    name: keyof SnapshotFormValues
    label: string
    prefix?: string
    suffix?: string
    className?: string
  }) => (
    <FormField
      control={form.control}
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
                      <FormLabel className="text-xs">Saldo asegurado promedio</FormLabel>
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
                <p className="text-xs text-muted-foreground">
                  Confirma los valores definitivos del crédito. Puedes copiar los datos de la simulación o ingresarlos manualmente.
                </p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                  <NumberField name="confirmedTotalAmount" label="Monto total crédito" prefix="$" />
                  <NumberField name="confirmedAverageInsuredBalance" label="Saldo asegurado promedio" prefix="$" />
                  <NumberField name="confirmedOriginalInstallments" label="Cuotas originales" />
                  <NumberField name="confirmedRemainingInstallments" label="Cuotas restantes" />
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
                    onClick={() => setOverridePrimas(!overridePrimas)}
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

              <Section icon={TrendingUp} title="Montos de devolución">
                <NumberField name="estimatedAmountCLP" label="Monto estimado devolución" prefix="$" />
                <NumberField name="realAmount" label="Monto real devolución" prefix="$" />
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
