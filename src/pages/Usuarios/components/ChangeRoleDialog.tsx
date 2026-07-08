import { useState, useEffect } from 'react'
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import type { UserV2 } from '../types/userTypesV2'
import { RoleAccessInfo } from './RoleAccessInfo'
import { CURRENT_USER_EMAIL } from '../constants/roleAccess'
import { useRoles } from '@/pages/Ajustes/hooks/useRoles'

interface Props {
  user: UserV2 | null
  open: boolean
  onOpenChange: (o: boolean) => void
  onConfirm: (role: string) => void
}

export function ChangeRoleDialog({ user, open, onOpenChange, onConfirm }: Props) {
  const { roles, getRole } = useRoles()
  const [role, setRole] = useState<string>('')

  useEffect(() => {
    if (user) setRole(user.role)
  }, [user])

  if (!user) return null
  const isCurrent = user.email.toLowerCase() === CURRENT_USER_EMAIL.toLowerCase()
  const currentRoleDef = getRole(user.role)
  const nextRoleDef = getRole(role)
  const changed = role !== user.role
  // Regla: el usuario actual no puede reducir su propio acceso (pierde FULL).
  const preventOwnDowngrade = isCurrent && currentRoleDef?.scope === 'FULL'

  const warning = !changed || !nextRoleDef || !currentRoleDef
    ? null
    : nextRoleDef.scope === 'FULL' && currentRoleDef.scope !== 'FULL'
      ? 'Este usuario obtendrá acceso completo a todas las páginas y funcionalidades de la plataforma.'
      : nextRoleDef.scope !== 'FULL' && currentRoleDef.scope === 'FULL'
        ? `Este usuario perderá acceso a la mayoría de páginas. Solo podrá acceder a: ${nextRoleDef.allowedPages.join(', ')}.`
        : `El nivel de acceso cambiará. Este usuario podrá acceder a: ${nextRoleDef.allowedPages.join(', ')}.`

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <AlertDialogHeader>
          <AlertDialogTitle>Cambiar rol de {user.firstName} {user.lastName}</AlertDialogTitle>
          <AlertDialogDescription>
            Selecciona el nuevo nivel de acceso para este usuario.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <RadioGroup value={role} onValueChange={setRole} className="space-y-2">
          {roles.map((r) => {
            const disabled = preventOwnDowngrade && r.scope !== 'FULL'
            return (
              <div
                key={r.id}
                className={`flex items-start gap-3 rounded-md border p-3 ${disabled ? 'opacity-50' : ''}`}
              >
                <RadioGroupItem value={r.id} id={`role-${r.id}`} className="mt-1" disabled={disabled} />
                <Label htmlFor={`role-${r.id}`} className={`flex-1 ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                  <div className="font-medium">{r.label}</div>
                  <div className="text-xs text-muted-foreground">{r.summary}</div>
                  {disabled && (
                    <div className="text-xs text-amber-700 mt-1">No puedes reducir tu propio nivel de acceso.</div>
                  )}
                </Label>
              </div>
            )
          })}
        </RadioGroup>

        {changed && warning && (
          <>
            <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
              {warning}
            </div>
            <RoleAccessInfo role={role} />
          </>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction disabled={!changed} onClick={() => onConfirm(role)}>
            Confirmar cambio
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}