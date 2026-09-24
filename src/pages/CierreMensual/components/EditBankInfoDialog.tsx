import { useState } from 'react'
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
import { Settings2, Landmark } from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { ConfirmChangesStep, type FieldChange } from './ConfirmChangesStep'

const bankSchema = z.object({
  bankName: z.string().trim().min(1, 'Selecciona el banco').max(100),
  bankAccountType: z.string().trim().min(1, 'Selecciona el tipo de cuenta').max(50),
  bankAccountNumber: z.string().trim().min(4, 'Ingresa el número de cuenta').max(30).regex(/^[0-9-]+$/, 'Solo números y guiones'),
})

type BankFormValues = z.infer<typeof bankSchema>

const FIELD_LABELS: Record<keyof BankFormValues, string> = {
  bankName: 'Banco',
  bankAccountType: 'Tipo de cuenta',
  bankAccountNumber: 'Número de cuenta',
}

const ACCOUNT_TYPE_OPTIONS = [
  'Cuenta Corriente',
  'Cuenta Vista',
  'Cuenta de Ahorro',
  'Cuenta RUT',
] as const

const BANK_OPTIONS = [
  'Banco de Chile', 'Banco Estado', 'Banco Santander', 'Banco BCI', 'Banco Itaú',
  'Scotiabank', 'Banco BICE', 'Banco Security', 'Banco Falabella', 'Banco Ripley',
  'Banco Consorcio', 'Banco Internacional', 'Banco BTG Pactual', 'HSBC Bank',
  'Coopeuch', 'Tenpo', 'Mercado Pago', 'Tapp Caja Los Andes', 'Prepago Los Héroes',
] as const

interface EditBankInfoDialogProps {
  refund: RefundRequest
}

export function EditBankInfoDialog({ refund }: EditBankInfoDialogProps) {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<'form' | 'confirm'>('form')
  const [pendingData, setPendingData] = useState<BankFormValues | null>(null)
  const queryClient = useQueryClient()

  const defaults: BankFormValues = {
    bankName: refund.bankInfo?.bank || '',
    bankAccountType: refund.bankInfo?.accountType || '',
    bankAccountNumber: refund.bankInfo?.accountNumber || '',
  }

  const hasBankData = !!(defaults.bankName || defaults.bankAccountType || defaults.bankAccountNumber)
  const bankOptions = defaults.bankName && !BANK_OPTIONS.includes(defaults.bankName as any)
    ? [defaults.bankName, ...BANK_OPTIONS]
    : [...BANK_OPTIONS]

  const form = useForm<BankFormValues>({
    resolver: zodResolver(bankSchema),
    defaultValues: defaults,
  })

  const getChanges = (data: BankFormValues): FieldChange[] => {
    const changes: FieldChange[] = []
    for (const [key, value] of Object.entries(data) as [keyof BankFormValues, any][]) {
      const original = defaults[key]
      if (value === original || (value === '' && (original === '' || original === undefined)) || value === undefined) continue
      changes.push({
        label: FIELD_LABELS[key] || key,
        from: String(original ?? ''),
        to: String(value),
      })
    }
    return changes
  }

  const mutation = useMutation({
    mutationFn: (data: BankFormValues) => {
      const bankFieldMap = {
        bankName: 'bank',
        bankAccountType: 'accountType',
        bankAccountNumber: 'accountNumber',
      } as const

      // Detectar si hay al menos un cambio
      const hasChanges = (Object.entries(data) as [keyof BankFormValues, any][]).some(
        ([key, value]) => value !== defaults[key] && !(value === '' && (defaults[key] === '' || defaults[key] === undefined))
      )

      if (!hasChanges) {
        return Promise.reject(new Error('No hay cambios para guardar'))
      }

      // IMPORTANT: enviar el objeto bankInfo COMPLETO (merge sobre los valores actuales),
      // porque el backend reemplaza el subdocumento entero. Si sólo se envían los campos
      // modificados, los demás quedan en blanco.
      const bankInfo: Record<string, any> = {
        bank: (data.bankName ?? defaults.bankName ?? '').toString().trim(),
        accountType: (data.bankAccountType ?? defaults.bankAccountType ?? '').toString().trim(),
        accountNumber: (data.bankAccountNumber ?? defaults.bankAccountNumber ?? '').toString().trim(),
      }

      return refundAdminApi.updateData(refund.publicId, { bankInfo })
    },
    onSuccess: () => {
      toast({
        title: '✅ Datos bancarios actualizados',
        description: 'La información bancaria se actualizó correctamente',
      })
      queryClient.invalidateQueries({ queryKey: ['refund', refund.publicId] })
      queryClient.invalidateQueries({ queryKey: ['refunds'] })
      setOpen(false)
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    },
  })

  const onSubmit = (data: BankFormValues) => {
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

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant={hasBankData ? 'outline' : 'default'} size="sm" className="gap-1.5">
          <Settings2 className="h-4 w-4" />
          {hasBankData ? 'Editar' : 'Completar'}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Landmark className="h-5 w-5 text-primary" />
            {step === 'form' ? (hasBankData ? 'Editar datos bancarios' : 'Registrar datos bancarios') : 'Confirmar cambios'}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            {step === 'form'
              ? 'Todos los campos son obligatorios.'
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
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="bankName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Banco</FormLabel>
                      <Select value={field.value || ''} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecciona banco" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="max-h-72">
                          {bankOptions.map((opt) => (
                            <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="bankAccountType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Tipo de cuenta</FormLabel>
                      <Select
                        value={field.value || ''}
                        onValueChange={field.onChange}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecciona tipo de cuenta" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {ACCOUNT_TYPE_OPTIONS.map((opt) => (
                            <SelectItem key={opt} value={opt}>
                              {opt}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="bankAccountNumber"
                  render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel className="text-xs">Número de cuenta</FormLabel>
                      <FormControl><Input {...field} inputMode="numeric" placeholder="1234567890" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
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
