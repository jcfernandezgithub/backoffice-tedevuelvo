import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { AlertTriangle } from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
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
import { userSchemaV2, type UserFormValuesV2 } from '../schemas/userSchemaV2'
import type { UserV2 } from '../types/userTypesV2'
import { RoleAccessInfo } from './RoleAccessInfo'
import { ROLE_ACCESS } from '../constants/roleAccess'

interface Props {
  open: boolean
  user?: UserV2 | null
  onOpenChange: (o: boolean) => void
  onSubmit: (values: UserFormValuesV2) => void
  emailExists: (email: string, exceptId?: string) => boolean
}

export function UserFormSheet({ open, user, onOpenChange, onSubmit, emailExists }: Props) {
  const isEditing = !!user
  const [pendingRoleChange, setPendingRoleChange] = useState<UserFormValuesV2 | null>(null)

  const form = useForm<UserFormValuesV2>({
    resolver: zodResolver(userSchemaV2),
    defaultValues: {
      firstName: '', lastName: '', email: '', phone: '',
      role: 'CALLCENTER', state: 'PENDING',
    },
  })

  useEffect(() => {
    if (open) {
      form.reset(
        user
          ? {
              firstName: user.firstName,
              lastName: user.lastName,
              email: user.email,
              phone: user.phone ?? '',
              role: user.role,
              state: user.state,
            }
          : { firstName: '', lastName: '', email: '', phone: '', role: 'CALLCENTER', state: 'PENDING' },
      )
    }
  }, [open, user, form])

  const role = form.watch('role')

  const handleSubmit = form.handleSubmit((values) => {
    if (emailExists(values.email, user?.id)) {
      form.setError('email', { message: 'Ya existe un usuario con este correo' })
      return
    }
    if (isEditing && user && values.role !== user.role) {
      setPendingRoleChange(values)
      return
    }
    onSubmit(values)
  })

  const confirmRoleChangeAndSubmit = () => {
    if (pendingRoleChange) {
      onSubmit(pendingRoleChange)
      setPendingRoleChange(null)
    }
  }

  const roleChangeWarning = user && pendingRoleChange
    ? pendingRoleChange.role === 'CALLCENTER'
      ? 'Este usuario perderá acceso a todas las páginas excepto Call Center.'
      : 'Este usuario obtendrá acceso completo a todas las páginas y funcionalidades de la plataforma.'
    : ''

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{isEditing ? 'Editar usuario' : 'Crear usuario'}</SheetTitle>
            <SheetDescription>
              {isEditing ? 'Modifica los datos del usuario y su nivel de acceso.' : 'Completa los datos para dar acceso a un nuevo usuario.'}
            </SheetDescription>
          </SheetHeader>

          <form onSubmit={handleSubmit} className="mt-6 space-y-6">
            <section className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Información del usuario</h3>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="firstName">Nombre *</Label>
                  <Input id="firstName" {...form.register('firstName')} />
                  {form.formState.errors.firstName && (
                    <p className="text-xs text-destructive">{form.formState.errors.firstName.message}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="lastName">Apellido *</Label>
                  <Input id="lastName" {...form.register('lastName')} />
                  {form.formState.errors.lastName && (
                    <p className="text-xs text-destructive">{form.formState.errors.lastName.message}</p>
                  )}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">Correo electrónico *</Label>
                <Input id="email" type="email" {...form.register('email')} />
                {form.formState.errors.email && (
                  <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="phone">Teléfono <span className="text-muted-foreground font-normal">(opcional)</span></Label>
                <Input id="phone" {...form.register('phone')} placeholder="+56 9 1234 5678" />
              </div>
            </section>

            <Separator />

            <section className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Configuración de acceso</h3>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Rol *</Label>
                  <Select value={role} onValueChange={(v) => form.setValue('role', v as any, { shouldDirty: true })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ADMIN">Administrador</SelectItem>
                      <SelectItem value="CALLCENTER">Call Center</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Estado inicial *</Label>
                  <Select value={form.watch('state')} onValueChange={(v) => form.setValue('state', v as any, { shouldDirty: true })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ACTIVE">Activo</SelectItem>
                      <SelectItem value="INACTIVE">Inactivo</SelectItem>
                      <SelectItem value="PENDING">Invitación pendiente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <RoleAccessInfo role={role} />

              {isEditing && user && role !== user.role && (
                <div className="flex gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-medium">Estás cambiando el rol de este usuario</p>
                    <p className="text-xs mt-1">
                      {role === 'CALLCENTER'
                        ? 'Perderá acceso a todas las páginas excepto Call Center.'
                        : 'Obtendrá acceso completo a todas las páginas y funcionalidades de la plataforma.'}
                    </p>
                  </div>
                </div>
              )}
            </section>

            <SheetFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {isEditing ? 'Guardar cambios' : 'Crear usuario'}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      <AlertDialog open={!!pendingRoleChange} onOpenChange={(o) => !o && setPendingRoleChange(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar cambio de rol</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingRoleChange && user && (
                <>
                  Vas a cambiar el rol de <strong>{user.firstName} {user.lastName}</strong> a{' '}
                  <strong>{ROLE_ACCESS[pendingRoleChange.role].label}</strong>. {roleChangeWarning}
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRoleChangeAndSubmit}>Confirmar cambio</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}