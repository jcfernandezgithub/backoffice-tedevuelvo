import { useEffect, useState } from 'react'
import { AlertTriangle, Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { toast } from 'sonner'
import { ALL_PLATFORM_PAGES, type PlatformPage } from '@/pages/Usuarios/constants/roleAccess'
import type { RoleDefinition } from '../hooks/useRoles'
import { useRoles } from '../hooks/useRoles'
import { RolesApiError } from '../services/rolesApi'

interface Props {
  open: boolean
  onOpenChange: (o: boolean) => void
  role?: RoleDefinition | null
}

export function RoleFormDialog({ open, onOpenChange, role }: Props) {
  const { roles, createRole, updateRole, isCreating, isUpdating } = useRoles()
  const isSubmitting = isCreating || isUpdating
  const isEditing = !!role
  const isSystem = role?.isSystem ?? false

  const [label, setLabel] = useState('')
  const [description, setDescription] = useState('')
  const [pages, setPages] = useState<PlatformPage[]>([])
  const [labelError, setLabelError] = useState<string | null>(null)
  const [pagesError, setPagesError] = useState<string | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmText, setConfirmText] = useState('')

  const confirmWord = isEditing ? 'actualizar' : 'crear'
  const canConfirm = confirmText.trim().toLowerCase() === confirmWord

  useEffect(() => {
    if (open) {
      setLabel(role?.label ?? '')
      setDescription(role?.description ?? '')
      setPages(role ? [...role.allowedPages] : [])
      setLabelError(null)
      setPagesError(null)
      setConfirmOpen(false)
      setConfirmText('')
    }
  }, [open, role])

  const togglePage = (page: PlatformPage, checked: boolean) => {
    setPages((prev) =>
      checked ? Array.from(new Set([...prev, page])) : prev.filter((p) => p !== page),
    )
  }

  const validate = (): boolean => {
    let ok = true
    const trimmed = label.trim()
    if (!isSystem) {
      if (!trimmed) { setLabelError('El nombre es obligatorio'); ok = false }
      else if (trimmed.length > 40) { setLabelError('Máximo 40 caracteres'); ok = false }
      else if (
        roles.some(
          (r) =>
            r.id !== role?.id &&
            r.label.toLowerCase() === trimmed.toLowerCase(),
        )
      ) { setLabelError('Ya existe un rol con este nombre'); ok = false }
      else setLabelError(null)

      if (pages.length === 0) { setPagesError('Selecciona al menos una página'); ok = false }
      else setPagesError(null)
    }
    return ok
  }

  const requestConfirm = () => {
    if (!validate()) return
    setConfirmText('')
    setConfirmOpen(true)
  }

  const handleSubmit = async () => {
    const trimmed = label.trim()
    try {
      if (isEditing && role) {
        const payload = isSystem
          ? { description: description.trim() }
          : { label: trimmed, description: description.trim(), allowedPages: pages }
        await updateRole(role.id, payload)
        toast.success('Rol actualizado')
      } else {
        await createRole({ label: trimmed, description: description.trim(), allowedPages: pages })
        toast.success('Rol creado')
      }
      setConfirmOpen(false)
      onOpenChange(false)
    } catch (e) {
      if (e instanceof RolesApiError) {
        if (e.fieldErrors?.label) setLabelError(String(e.fieldErrors.label[0]))
        if (e.fieldErrors?.allowedPages) setPagesError(String(e.fieldErrors.allowedPages[0]))
        if (e.status === 409) setLabelError(e.message)
        toast.error(e.message)
      } else {
        toast.error('No se pudo guardar el rol')
      }
      setConfirmOpen(false)
    }
  }

  const selectAll = () => setPages([...ALL_PLATFORM_PAGES])
  const clearAll = () => setPages([])

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!isSubmitting) onOpenChange(o) }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar rol' : 'Crear rol'}</DialogTitle>
          <DialogDescription>
            {isSystem
              ? 'Los roles del sistema no permiten cambiar su nombre ni sus páginas. Solo puedes actualizar la descripción.'
              : 'Define un nombre, descripción y las páginas de la plataforma a las que este rol tendrá acceso.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {isSystem && (
            <div className="flex gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>Este es un rol del sistema. Es necesario para el correcto funcionamiento de la plataforma y no puede eliminarse.</span>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="role-label">Nombre del rol *</Label>
            <Input
              id="role-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              disabled={isSystem}
              maxLength={40}
              placeholder="Ej. Supervisor de operaciones"
            />
            {labelError && <p className="text-xs text-destructive">{labelError}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="role-desc">Descripción</Label>
            <Textarea
              id="role-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              maxLength={280}
              placeholder="¿Qué hace este rol en la plataforma?"
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <Label>Páginas habilitadas *</Label>
                <p className="text-xs text-muted-foreground">
                  Selecciona a qué páginas de la plataforma tendrá acceso.
                </p>
              </div>
              {!isSystem && (
                <div className="flex gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={selectAll}>Todas</Button>
                  <Button type="button" size="sm" variant="outline" onClick={clearAll}>Ninguna</Button>
                </div>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 rounded-md border p-3 bg-muted/20">
              {ALL_PLATFORM_PAGES.map((page) => {
                const checked = pages.includes(page)
                return (
                  <label
                    key={page}
                    className={`flex items-center gap-2 rounded px-2 py-1.5 text-sm ${isSystem ? 'opacity-70' : 'hover:bg-muted cursor-pointer'}`}
                  >
                    <Checkbox
                      checked={checked}
                      disabled={isSystem}
                      onCheckedChange={(v) => togglePage(page, v === true)}
                    />
                    <span>{page}</span>
                  </label>
                )
              })}
            </div>
            {pagesError && <p className="text-xs text-destructive">{pagesError}</p>}
            {!isSystem && (
              <p className="text-xs text-muted-foreground">
                {pages.length === ALL_PLATFORM_PAGES.length
                  ? 'Este rol tendrá acceso completo a la plataforma.'
                  : `Acceso limitado a ${pages.length} de ${ALL_PLATFORM_PAGES.length} páginas.`}
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>Cancelar</Button>
          <Button onClick={requestConfirm} disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
            {isEditing ? 'Guardar cambios' : 'Crear rol'}
          </Button>
        </DialogFooter>
      </DialogContent>

      <AlertDialog
        open={confirmOpen}
        onOpenChange={(o) => { if (!isSubmitting) setConfirmOpen(o) }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {isEditing ? 'Confirmar actualización del rol' : 'Confirmar creación del rol'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {isEditing
                ? 'Estás a punto de modificar los accesos de este rol. Este cambio afecta a todos los usuarios asignados. '
                : 'Estás a punto de crear un nuevo rol con los accesos seleccionados. '}
              Para continuar, escribe{' '}
              <span className="font-mono font-semibold text-foreground">{confirmWord}</span> en el campo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="role-confirm-input" className="text-xs text-muted-foreground">
              Escribe <span className="font-mono font-semibold text-foreground">{confirmWord}</span> para confirmar
            </Label>
            <Input
              id="role-confirm-input"
              autoFocus
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={confirmWord}
              disabled={isSubmitting}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); if (canConfirm) handleSubmit() }}
              disabled={!canConfirm || isSubmitting}
            >
              {isSubmitting && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
              {isEditing ? 'Sí, actualizar' : 'Sí, crear'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  )
}