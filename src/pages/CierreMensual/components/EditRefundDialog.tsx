import { useState, useRef } from 'react'
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
import { Button } from '@/components/ui/button'
import { Pencil } from 'lucide-react'
import { toast } from '@/hooks/use-toast'

const editSchema = z.object({
  fullName: z.string().trim().min(1, 'Nombre es requerido').max(200),
  rut: z
    .string()
    .trim()
    .min(1, 'RUT es requerido')
    .regex(/^\d{1,2}\.?\d{3}\.?\d{3}-[\dkK]$/, 'Formato de RUT inválido'),
  email: z.string().trim().email('Email inválido').max(255),
  phone: z.string().trim().max(20).optional().or(z.literal('')),
  institutionId: z.string().trim().optional().or(z.literal('')),
  estimatedAmountCLP: z.coerce.number().min(0, 'Monto debe ser >= 0').optional(),
  realAmount: z.coerce.number().min(0).optional(),
  birthDate: z.string().trim().optional().or(z.literal('')),
  bankName: z.string().trim().max(100).optional().or(z.literal('')),
  bankAccountType: z.string().trim().max(50).optional().or(z.literal('')),
  bankAccountNumber: z.string().trim().max(30).optional().or(z.literal('')),
})

type EditFormValues = z.infer<typeof editSchema>

interface EditRefundDialogProps {
  refund: RefundRequest
}

export function EditRefundDialog({ refund }: EditRefundDialogProps) {
  const [open, setOpen] = useState(false)
  const queryClient = useQueryClient()
  const updatedFieldsRef = useRef<Record<string, any>>({})

  const defaults: EditFormValues = {
    fullName: refund.fullName || '',
    rut: refund.rut || '',
    email: refund.email || '',
    phone: refund.phone || '',
    institutionId: refund.institutionId || '',
    estimatedAmountCLP: refund.estimatedAmountCLP ?? undefined,
    realAmount: (refund as any).realAmount ?? undefined,
    birthDate: refund.calculationSnapshot?.birthDate
      ? refund.calculationSnapshot.birthDate.slice(0, 10)
      : '',
    bankName: refund.bankInfo?.bank || '',
    bankAccountType: refund.bankInfo?.accountType || '',
    bankAccountNumber: refund.bankInfo?.accountNumber || '',
  }

  const form = useForm<EditFormValues>({
    resolver: zodResolver(editSchema),
    defaultValues: defaults,
  })

  const mutation = useMutation({
    mutationFn: (data: EditFormValues) => {
      const payload: Record<string, any> = {}
      const bankFields = { bankName: 'bank', bankAccountType: 'accountType', bankAccountNumber: 'accountNumber' }
      const bankInfo: Record<string, any> = {}

      for (const [key, value] of Object.entries(data) as [keyof EditFormValues, any][]) {
        if (value === defaults[key] || value === '' || value === undefined) continue
        if (key in bankFields) {
          bankInfo[bankFields[key as keyof typeof bankFields]] = value
        } else {
          payload[key] = value
        }
      }

      if (Object.keys(bankInfo).length > 0) payload.bankInfo = bankInfo
      if (Object.keys(payload).length === 0) {
        return Promise.reject(new Error('No hay cambios para guardar'))
      }
      updatedFieldsRef.current = { ...payload }
      return refundAdminApi.updateData(refund.publicId, payload)
    },
    onSuccess: () => {
      const fields = updatedFieldsRef.current
      const hasBankUpdate = !!fields.bankInfo
      const otherCount = Object.keys(fields).filter(k => k !== 'bankInfo').length

      const parts: string[] = []
      if (otherCount > 0) parts.push(`${otherCount} campo${otherCount > 1 ? 's' : ''} actualizado${otherCount > 1 ? 's' : ''}`)
      if (hasBankUpdate) parts.push('datos bancarios actualizados')

      toast({
        title: '✅ Datos actualizados',
        description: parts.join(' · ') || 'La solicitud se actualizó correctamente',
      })
      queryClient.invalidateQueries({ queryKey: ['refund', refund.publicId] })
      queryClient.invalidateQueries({ queryKey: ['refunds'] })
      setOpen(false)
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    },
  })

  const onSubmit = (data: EditFormValues) => mutation.mutate(data)

  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen) form.reset(defaults)
    setOpen(isOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Pencil className="h-4 w-4 mr-2" />
          Editar datos
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar datos de la solicitud</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="fullName"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Nombre completo</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="rut"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>RUT</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="12.345.678-9" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input {...field} type="email" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Teléfono</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="+56 9 1234 5678" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="birthDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fecha de nacimiento</FormLabel>
                    <FormControl>
                      <Input {...field} type="date" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="institutionId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Institución</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="ej: banco_chile" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="estimatedAmountCLP"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Monto estimado (CLP)</FormLabel>
                    <FormControl>
                      <Input {...field} type="number" min={0} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="realAmount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Monto real (CLP)</FormLabel>
                    <FormControl>
                      <Input {...field} type="number" min={0} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="border-t pt-4 mt-2">
              <p className="text-sm font-medium mb-3">Datos bancarios</p>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="bankName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Banco</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Banco Chile" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="bankAccountType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo de cuenta</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Cuenta corriente" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="bankAccountNumber"
                  render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel>Número de cuenta</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="1234567890" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? 'Guardando...' : 'Guardar cambios'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
