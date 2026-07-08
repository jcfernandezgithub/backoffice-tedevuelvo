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
import type { RoleV2, UserV2 } from '../types/userTypesV2'
import { RoleAccessInfo } from './RoleAccessInfo'
import { ROLE_ACCESS, CURRENT_USER_EMAIL } from '../constants/roleAccess'

interface Props {
  user: UserV2 | null
  open: boolean
  onOpenChange: (o: boolean) => void
  onConfirm: (role: RoleV2) => void
}

export function ChangeRoleDialog({ user, open, onOpenChange, onConfirm }: Props) {
  const [role, setRole] = useState<RoleV2>('ADMIN')

  useEffect(() => {
    if (user) setRole(user.role)
  }, [user])

  if (!user) return null
  const isCurrent = user.email.toLowerCase() === CURRENT_USER_EMAIL.toLowerCase()
  const preventDowngrade = isCurrent && user.role === 'ADMIN'
  const changed = role !== user.role
  const warning = !changed ? null : role === 'CALLCENTER'
    ? 'Este usuario perderá acceso a todas las páginas excepto Call Center.'
    : 'Este usuario obtendrá acceso completo a todas las páginas y funcionalidades de la plataforma.'

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle>Cambiar rol de {user.firstName} {user.lastName}</AlertDialogTitle>
          <AlertDialogDescription>
            Selecciona el nuevo nivel de acceso para este usuario.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <RadioGroup value={role} onValueChange={(v) => setRole(v as RoleV2)} className="space-y-2">
          <div className="flex items-start gap-3 rounded-md border p-3">
            <RadioGroupItem value="ADMIN" id="role-admin" className="mt-1" />
            <Label htmlFor="role-admin" className="flex-1 cursor-pointer">
              <div className="font-medium">Administrador</div>
              <div className="text-xs text-muted-foreground">{ROLE_ACCESS.ADMIN.summary}</div>
            </Label>
          </div>
          <div className={`flex items-start gap-3 rounded-md border p-3 ${preventDowngrade ? 'opacity-50' : ''}`}>
            <RadioGroupItem value="CALLCENTER" id="role-cc" className="mt-1" disabled={preventDowngrade} />
            <Label htmlFor="role-cc" className={`flex-1 ${preventDowngrade ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
              <div className="font-medium">Call Center</div>
              <div className="text-xs text-muted-foreground">{ROLE_ACCESS.CALLCENTER.summary}</div>
              {preventDowngrade && (
                <div className="text-xs text-amber-700 mt-1">No puedes reducir tu propio rol.</div>
              )}
            </Label>
          </div>
        </RadioGroup>

        {changed && (
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