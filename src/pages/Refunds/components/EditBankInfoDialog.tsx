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
import { Button } from '@/components/ui/button'
import { Settings2, Landmark } from 'lucide-react'
import { toast } from '@/hooks/use-toast'

const bankSchema = z.object({
  bankName: z.string().trim().max(100).optional().or(z.literal('')),
  bankAccountType: z.string().trim().max(50).optional().or(z.literal('')),
  bankAccountNumber: z.string().trim().max(30).optional().or(z.literal('')),
})

type BankFormValues = z.infer<typeof bankSchema>

interface EditBankInfoDialogProps {
  refund: RefundRequest
}

export function EditBankInfoDialog({ refund }: EditBankInfoDialogProps) {
  const [open, setOpen] = useState(false)
  const queryClient = useQueryClient()

  const defaults: BankFormValues = {
    bankName: refund.bankInfo?.bank || '',
    bankAccountType: refund.bankInfo?.accountType || '',
    bankAccountNumber: refund.bankInfo?.accountNumber || '',
  }

  const form = useForm<BankFormValues>({
    resolver: zodResolver(bankSchema),
    defaultValues: defaults,
  })

  const mutation = useMutation({
    mutationFn: (data: BankFormValues) => {
      const bankFieldMap = {
        bankName: 'bank',
        bankAccountType: 'accountType',
        bankAccountNumber: 'accountNumber',
      } as const

      const bankInfo: Record<string, any> = {}

      for (const [key, value] of Object.entries(data) as [keyof BankFormValues, any][]) {
        if (value === defaults[key] || value === '' || value === undefined) continue
        bankInfo[bankFieldMap[key]] = value
      }

      if (Object.keys(bankInfo).length === 0) {
        return Promise.reject(new Error('No hay cambios para guardar'))
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

  const onSubmit = (data: BankFormValues) => mutation.mutate(data)

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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Landmark className="h-5 w-5 text-primary" />
            Editar datos bancarios
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
                name="bankName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Banco</FormLabel>
                    <FormControl><Input {...field} placeholder="Banco Chile" /></FormControl>
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
                    <FormControl><Input {...field} placeholder="Cuenta corriente" /></FormControl>
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
                    <FormControl><Input {...field} placeholder="1234567890" /></FormControl>
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
