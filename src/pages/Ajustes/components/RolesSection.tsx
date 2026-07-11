import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Pencil, Trash2, ShieldCheck, Lock, Users, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { toast } from 'sonner'
import { useRoles, type RoleDefinition } from '../hooks/useRoles'
import { useMockUsers } from '@/pages/Usuarios/hooks/useMockUsers'
import { ALL_PLATFORM_PAGES } from '@/pages/Usuarios/constants/roleAccess'
import { RoleFormDialog } from './RoleFormDialog'

export function RolesSection() {
  const { roles, removeRole } = useRoles()
  const { users } = useMockUsers()
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<RoleDefinition | null>(null)
  const [deleting, setDeleting] = useState<RoleDefinition | null>(null)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')

  const usersByRole = useMemo(() => {
    const map: Record<string, number> = {}
    users.forEach((u) => { map[u.role] = (map[u.role] ?? 0) + 1 })
    return map
  }, [users])

  const expectedConfirm = deleting?.label ?? ''
  const canConfirmDelete =
    !!deleting && deleteConfirmText.trim().toLowerCase() === expectedConfirm.toLowerCase()

  const confirmDelete = () => {
    if (!deleting || !canConfirmDelete) return
    removeRole(deleting.id)
    toast.success('Rol eliminado')
    setDeleting(null)
    setDeleteConfirmText('')
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground max-w-xl">
              Define los perfiles de acceso disponibles en la plataforma. Los usuarios se asignan a uno de estos roles desde{' '}
              <Link to="/usuarios" className="text-primary hover:underline inline-flex items-center gap-0.5">
                Administración de usuarios <ExternalLink className="h-3 w-3" />
              </Link>.
            </p>
          </div>
          <Button onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4 mr-2" /> Crear rol
          </Button>
        </div>

        <div className="grid gap-3">
          {roles.map((r) => {
            const count = usersByRole[r.id] ?? 0
            const isFull = r.scope === 'FULL'
            const cannotDelete = r.isSystem || count > 0
            const deleteReason = r.isSystem
              ? 'Los roles del sistema no pueden eliminarse'
              : count > 0
                ? `Este rol tiene ${count} usuario(s) asignado(s). Cámbialos de rol antes de eliminarlo.`
                : ''
            return (
              <Card key={r.id}>
                <CardContent className="p-5">
                  <div className="flex items-start gap-4">
                    <div className={`rounded-md p-2 shrink-0 ${isFull ? 'bg-primary/10 text-primary' : 'bg-amber-100 text-amber-700'}`}>
                      {isFull ? <ShieldCheck className="h-5 w-5" /> : <Lock className="h-5 w-5" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold">{r.label}</h3>
                        {r.isSystem && <Badge variant="secondary" className="text-[10px]">Sistema</Badge>}
                        <Badge
                          variant="outline"
                          className={isFull ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-amber-300 bg-amber-50 text-amber-700'}
                        >
                          {isFull ? 'Acceso completo' : `${r.allowedPages.length} de ${ALL_PLATFORM_PAGES.length} páginas`}
                        </Badge>
                      </div>
                      {r.description && (
                        <p className="text-sm text-muted-foreground mt-1">{r.description}</p>
                      )}
                      <div className="flex flex-wrap gap-1.5 mt-3">
                        {r.allowedPages.slice(0, 6).map((p) => (
                          <span key={p} className="text-[11px] rounded bg-muted px-2 py-0.5 text-muted-foreground">{p}</span>
                        ))}
                        {r.allowedPages.length > 6 && (
                          <span className="text-[11px] rounded bg-muted px-2 py-0.5 text-muted-foreground">
                            +{r.allowedPages.length - 6} más
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-3 text-xs text-muted-foreground">
                        <Link
                          to="/usuarios"
                          className="inline-flex items-center gap-1 hover:text-foreground hover:underline"
                        >
                          <Users className="h-3.5 w-3.5" />
                          {count} usuario{count === 1 ? '' : 's'} asignado{count === 1 ? '' : 's'}
                        </Link>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 shrink-0">
                      <Button variant="outline" size="sm" onClick={() => setEditing(r)}>
                        <Pencil className="h-3.5 w-3.5 mr-1.5" /> Editar
                      </Button>
                      {cannotDelete ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span>
                              <Button variant="outline" size="sm" disabled className="text-destructive">
                                <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Eliminar
                              </Button>
                            </span>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">{deleteReason}</TooltipContent>
                        </Tooltip>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setDeleting(r)}
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Eliminar
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>

        <RoleFormDialog open={creating} onOpenChange={setCreating} />
        <RoleFormDialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)} role={editing} />

        <AlertDialog
          open={!!deleting}
          onOpenChange={(o) => {
            if (!o) {
              setDeleting(null)
              setDeleteConfirmText('')
            }
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Eliminar rol</AlertDialogTitle>
              <AlertDialogDescription>
                Esta acción no se puede deshacer. Para confirmar la eliminación del rol{' '}
                <strong>{deleting?.label}</strong>, escribe su nombre exactamente igual en el campo de abajo.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-2 py-2">
              <Label htmlFor="delete-role-confirm" className="text-xs text-muted-foreground">
                Escribe <span className="font-mono font-semibold text-foreground">{expectedConfirm}</span> para confirmar
              </Label>
              <Input
                id="delete-role-confirm"
                autoFocus
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder={expectedConfirm}
              />
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmDelete}
                disabled={!canConfirmDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Eliminar rol
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </TooltipProvider>
  )
}