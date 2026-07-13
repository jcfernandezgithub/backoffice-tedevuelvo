import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { AlertTriangle, Eye, EyeOff, RefreshCw, Settings2 } from 'lucide-react'
import { Link } from 'react-router-dom'
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
import { useRoles } from '@/pages/Ajustes/hooks/useRoles'

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
  const [showPassword, setShowPassword] = useState(false)
  const { roles, getRole } = useRoles()
  const defaultRoleId = roles.find((r) => r.id === 'CALLCENTER')?.id ?? roles[0]?.id ?? ''

  const form = useForm<UserFormValuesV2>({
    resolver: zodResolver(userSchemaV2),
    defaultValues: {
      firstName: '', lastName: '', email: '', phone: '',
      role: defaultRoleId, state: 'ACTIVE', password: '',
    },
  })

  useEffect(() => {
    if (open) {
      setShowPassword(false)
      form.reset(
        user
          ? {
              firstName: user.firstName,
              lastName: user.lastName,
              email: user.email,
              phone: user.phone ?? '',
              role: user.role,
              state: user.state,
              password: '',
            }
          : { firstName: '', lastName: '', email: '', phone: '', role: defaultRoleId, state: 'ACTIVE', password: '' },
      )
    }
  }, [open, user, form, defaultRoleId])

  const role = form.watch('role')

  const handleSubmit = form.handleSubmit((values) => {
    if (emailExists(values.email, user?.id)) {
      form.setError('email', { message: 'Ya existe un usuario con este correo' })
      return
    }
    if (!isEditing && !values.password) {
      form.setError('password', { message: 'Contraseña obligatoria al crear' })
      return
    }
    if (isEditing && user && values.role !== user.role) {
      setPendingRoleChange(values)
      return
    }
    onSubmit(values)
  })

  const generatePassword = () => {
    const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
    const lower = 'abcdefghijkmnopqrstuvwxyz'
    const nums = '23456789'
    const syms = '!@#$%&*?'
    const all = upper + lower + nums + syms
    const pick = (s: string) => s[Math.floor(Math.random() * s.length)]
    let pwd = pick(upper) + pick(lower) + pick(nums) + pick(syms)
    for (let i = 0; i < 8; i++) pwd += pick(all)
    pwd = pwd.split('').sort(() => Math.random() - 0.5).join('')
    form.setValue('password', pwd, { shouldDirty: true, shouldValidate: true })
    setShowPassword(true)
  }

  const confirmRoleChangeAndSubmit = () => {
    if (pendingRoleChange) {
      onSubmit(pendingRoleChange)
      setPendingRoleChange(null)
    }
  }

  const currentRoleDef = user ? getRole(user.role) : undefined
  const nextRoleDef = getRole(role)
  const pendingRoleDef = pendingRoleChange ? getRole(pendingRoleChange.role) : undefined

  const buildRoleWarning = (
    prev: ReturnType<typeof getRole>,
    next: ReturnType<typeof getRole>,
  ) => {
    if (!prev || !next) return ''
    if (next.scope === 'FULL' && prev.scope !== 'FULL') {
      return 'Este usuario obtendrá acceso completo a todas las páginas y funcionalidades de la plataforma.'
    }
    if (next.scope !== 'FULL' && prev.scope === 'FULL') {
      return `Este usuario perderá acceso a la mayoría de páginas. Solo podrá acceder a: ${next.allowedPages.join(', ')}.`
    }
    return `Este usuario podrá acceder a: ${next.allowedPages.join(', ')}.`
  }

  const roleChangeWarning = buildRoleWarning(currentRoleDef, pendingRoleDef)

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
                  <div className="flex items-center justify-between">
                    <Label>Rol *</Label>
                    <Link
                      to="/ajustes"
                      className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                      onClick={() => onOpenChange(false)}
                    >
                      <Settings2 className="h-3 w-3" /> Administrar roles
                    </Link>
                  </div>
                  <Select value={role} onValueChange={(v) => form.setValue('role', v as any, { shouldDirty: true })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {roles.map((r) => (
                        <SelectItem key={r.id} value={r.id}>
                          {r.label}
                          {r.isSystem ? ' · sistema' : ''}
                        </SelectItem>
                      ))}
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

              {!isEditing && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Contraseña inicial *</Label>
                    <button
                      type="button"
                      onClick={generatePassword}
                      className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                    >
                      <RefreshCw className="h-3 w-3" /> Generar
                    </button>
                  </div>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      {...form.register('password')}
                      placeholder="Mín. 8 caracteres, mayús, minús, número y símbolo"
                      className="pr-10"
                    />
                    <button
                      type="button"
                      aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                      onClick={() => setShowPassword((s) => !s)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {form.formState.errors.password && (
                    <p className="text-xs text-destructive">{form.formState.errors.password.message}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    El usuario podrá cambiarla más adelante desde su perfil.
                  </p>
                </div>
              )}

              {isEditing && user && role !== user.role && currentRoleDef && nextRoleDef && (
                <div className="flex gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-medium">Estás cambiando el rol de este usuario</p>
                    <p className="text-xs mt-1">
                      {buildRoleWarning(currentRoleDef, nextRoleDef)}
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
                  <strong>{pendingRoleDef?.label ?? pendingRoleChange.role}</strong>. {roleChangeWarning}
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