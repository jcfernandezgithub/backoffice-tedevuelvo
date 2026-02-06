import { useState, useCallback } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { refundAdminApi } from '@/services/refundAdminApi'
import type { RefundRequest } from '@/types/refund'
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
import { Calculator, CreditCard, Shield, TrendingUp, Settings2 } from 'lucide-react'
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
  currentMonthlyPremium: z.coerce.number().min(0).optional(),
  newMonthlyPremium: z.coerce.number().min(0).optional(),
  monthlySaving: z.coerce.number().min(0).optional(),
  totalSaving: z.coerce.number().min(0).optional(),
  birthDate: z.string().trim().optional().or(z.literal('')),
  age: z.coerce.number().int().min(0).max(120).optional(),
  rateSet: z.string().trim().max(100).optional().or(z.literal('')),
})

type SnapshotFormValues = z.infer<typeof snapshotSchema>

const FIELD_LABELS: Record<keyof SnapshotFormValues, string> = {
  creditType: 'Tipo de crédito',
  insuranceToEvaluate: 'Seguro a evaluar',
  totalAmount: 'Monto total crédito',
  averageInsuredBalance: 'Saldo asegurado promedio',
  originalInstallments: 'Cuotas originales',
  remainingInstallments: 'Cuotas restantes',
  currentMonthlyPremium: 'Prima mensual actual',
  newMonthlyPremium: 'Nueva prima mensual',
  monthlySaving: 'Ahorro mensual',
  totalSaving: 'Ahorro total',
  birthDate: 'Fecha de nacimiento',
  age: 'Edad',
  rateSet: 'Versión de tarifas',
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
  const queryClient = useQueryClient()
  const snapshot = refund.calculationSnapshot || {}

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

  const defaults: SnapshotFormValues = {
    creditType: (snapshot.creditType || '').toLowerCase(),
    insuranceToEvaluate: (snapshot.insuranceToEvaluate || '').toLowerCase(),
    totalAmount: snapshot.totalAmount ?? undefined,
    averageInsuredBalance: snapshot.averageInsuredBalance ?? undefined,
    originalInstallments: snapshot.originalInstallments ?? undefined,
    remainingInstallments: snapshot.remainingInstallments ?? undefined,
    currentMonthlyPremium: snapshot.currentMonthlyPremium ?? undefined,
    newMonthlyPremium: snapshot.newMonthlyPremium ?? undefined,
    monthlySaving: snapshot.monthlySaving ?? undefined,
    totalSaving: snapshot.totalSaving ?? undefined,
    birthDate: snapshot.birthDate ? snapshot.birthDate.slice(0, 10) : '',
    age: snapshot.age ?? undefined,
    rateSet: snapshot.rateSet || '',
  }

  const form = useForm<SnapshotFormValues>({
    resolver: zodResolver(snapshotSchema),
    defaultValues: defaults,
  })

  const getChanges = useCallback((data: SnapshotFormValues): FieldChange[] => {
    const changes: FieldChange[] = []
    for (const [key, value] of Object.entries(data) as [keyof SnapshotFormValues, any][]) {
      const original = defaults[key]
      if (value === original || (value === '' && (original === '' || original === undefined)) || value === undefined) continue
      changes.push({
        label: FIELD_LABELS[key] || key,
        from: String(original ?? ''),
        to: String(value),
      })
    }
    return changes
  }, [defaults])

  const mutation = useMutation({
    mutationFn: (values: SnapshotFormValues) => {
      const patch: Record<string, any> = {}

      for (const [key, value] of Object.entries(values) as [keyof SnapshotFormValues, any][]) {
        const original = defaults[key]
        if (value === original || value === '' || value === undefined) continue
        patch[key] = value
      }

      if (Object.keys(patch).length === 0) {
        return Promise.reject(new Error('No hay cambios para guardar'))
      }

      const mergedSnapshot = { ...snapshot, ...patch }

      return refundAdminApi.updateData(refund.publicId, {
        calculationSnapshot: mergedSnapshot,
      })
    },
    onSuccess: () => {
      const changes = getChanges(pendingData!)
      toast({
        title: '✅ Snapshot actualizado',
        description: `${changes.length} campo${changes.length > 1 ? 's' : ''} del cálculo actualizado${changes.length > 1 ? 's' : ''}`,
      })
      queryClient.invalidateQueries({ queryKey: ['refund', refund.publicId] })
      queryClient.invalidateQueries({ queryKey: ['refunds'] })
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
      form.reset(defaults)
      setStep('form')
      setPendingData(null)
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
              {/* ---- Datos del crédito ---- */}
              <Section icon={CreditCard} title="Datos del crédito">
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
                          <SelectItem value="hipotecario">Hipotecario</SelectItem>
                          <SelectItem value="consumo">Consumo</SelectItem>
                          <SelectItem value="automotriz">Automotriz</SelectItem>
                          <SelectItem value="comercial">Comercial</SelectItem>
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
                <NumberField name="totalAmount" label="Monto total crédito" prefix="$" />
                <NumberField name="averageInsuredBalance" label="Saldo asegurado promedio" prefix="$" />
                <NumberField name="originalInstallments" label="Cuotas originales" />
                <NumberField name="remainingInstallments" label="Cuotas restantes" />
              </Section>

              <Separator />

              <Section icon={Shield} title="Primas y seguros">
                <NumberField name="currentMonthlyPremium" label="Prima mensual actual" prefix="$" />
                <NumberField name="newMonthlyPremium" label="Nueva prima mensual" prefix="$" />
              </Section>

              <Separator />

              <Section icon={TrendingUp} title="Ahorros calculados">
                <NumberField name="monthlySaving" label="Ahorro mensual" prefix="$" />
                <NumberField name="totalSaving" label="Ahorro total" prefix="$" />
              </Section>

              <Separator />

              <Section icon={Calculator} title="Demografía y meta">
                <FormField
                  control={form.control}
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
                <NumberField name="age" label="Edad" suffix="años" />
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
