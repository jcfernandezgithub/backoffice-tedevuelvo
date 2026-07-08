import { AlertTriangle } from 'lucide-react'
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
import type { UserV2 } from '../types/userTypesV2'
import { useRoles } from '@/pages/Ajustes/hooks/useRoles'

interface Props {
  user: UserV2 | null
  open: boolean
  onOpenChange: (o: boolean) => void
  onConfirm: () => void
}

export function DeleteUserConfirm({ user, open, onOpenChange, onConfirm }: Props) {
  const { getRole } = useRoles()
  if (!user) return null
  const roleLabel = getRole(user.role)?.label ?? user.role
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Eliminar usuario
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3 text-sm">
              <p>Esta acción eliminará permanentemente al siguiente usuario:</p>
              <div className="rounded-md border p-3 bg-muted/30">
                <p className="font-medium text-foreground">{user.firstName} {user.lastName}</p>
                <p className="text-muted-foreground">{user.email}</p>
                <p className="text-muted-foreground text-xs mt-1">Rol actual: {roleLabel}</p>
              </div>
              <p className="text-destructive">
                El usuario perderá el acceso a la plataforma inmediatamente. Esta acción no se puede deshacer.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Eliminar usuario
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}