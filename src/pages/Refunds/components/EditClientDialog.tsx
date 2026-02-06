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
import { Button } from '@/components/ui/button'
import { Settings2, User } from 'lucide-react'
import { toast } from '@/hooks/use-toast'

const clientSchema = z.object({
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
  age: z.coerce.number().int().min(0).max(120).optional(),
})

type ClientFormValues = z.infer<typeof clientSchema>

interface EditClientDialogProps {
  refund: RefundRequest
}

export function EditClientDialog({ refund }: EditClientDialogProps) {
  const [open, setOpen] = useState(false)
  const queryClient = useQueryClient()

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

  const defaults: ClientFormValues = {
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
    age: refund.calculationSnapshot?.age ?? undefined,
  }

  const form = useForm<ClientFormValues>({
    resolver: zodResolver(clientSchema),
    defaultValues: defaults,
  })

  const mutation = useMutation({
    mutationFn: (data: ClientFormValues) => {
      const payload: Record<string, any> = {}

      for (const [key, value] of Object.entries(data) as [keyof ClientFormValues, any][]) {
        if (value === defaults[key] || value === '' || value === undefined) continue
        payload[key] = value
      }

      if (Object.keys(payload).length === 0) {
        return Promise.reject(new Error('No hay cambios para guardar'))
      }
      return refundAdminApi.updateData(refund.publicId, payload)
    },
    onSuccess: () => {
      const changedCount = Object.entries(form.getValues()).filter(
        ([key, value]) => {
          const original = defaults[key as keyof ClientFormValues]
          return value !== original && value !== '' && value !== undefined
        }
      ).length
      toast({
        title: '✅ Datos del cliente actualizados',
        description: `${changedCount} campo${changedCount > 1 ? 's' : ''} actualizado${changedCount > 1 ? 's' : ''}`,
      })
      queryClient.invalidateQueries({ queryKey: ['refund', refund.publicId] })
      queryClient.invalidateQueries({ queryKey: ['refunds'] })
      setOpen(false)
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    },
  })

  const onSubmit = (data: ClientFormValues) => mutation.mutate(data)

  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen) form.reset(defaults)
    setOpen(isOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Settings2 className="h-4 w-4" />
          Editar
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5 text-primary" />
            Editar datos del cliente
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Solo se enviarán los campos que modifiques.
          </p>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="fullName"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel className="text-xs">Nombre completo</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="rut"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">RUT</FormLabel>
                    <FormControl><Input {...field} placeholder="12.345.678-9" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Email</FormLabel>
                    <FormControl><Input {...field} type="email" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Teléfono</FormLabel>
                    <FormControl><Input {...field} placeholder="+56 9 1234 5678" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
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
              <FormField
                control={form.control}
                name="institutionId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Institución</FormLabel>
                    <FormControl><Input {...field} placeholder="ej: banco_chile" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="estimatedAmountCLP"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Monto estimado (CLP)</FormLabel>
                    <FormControl><Input {...field} type="number" min={0} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="realAmount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Monto real (CLP)</FormLabel>
                    <FormControl><Input {...field} type="number" min={0} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t">
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
