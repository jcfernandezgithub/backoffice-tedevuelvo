import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Building2, ChevronLeft, ChevronRight, Eye, Loader2, Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/state/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { canManageFinancialContacts, financialContactSchema, pageAfterContactDeletion } from '@/lib/financialInstitutionContacts'
import { FinancialContactError, financialInstitutionContactsApi as api, type FinancialInstitutionContact } from '@/services/financialInstitutionContactsApi'

const key = ['financial-institution-contacts']
const date = (value: string) => new Intl.DateTimeFormat('es-CL', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Santiago' }).format(new Date(value))
type FormState = { mode: 'create' | 'edit' | 'view'; contact?: FinancialInstitutionContact }

export default function EntidadesFinancieras() {
  const { user } = useAuth()
  const allowed = canManageFinancialContacts(user)
  const qc = useQueryClient()
  const [page, setPage] = useState(1)
  const [form, setForm] = useState<FormState | null>(null)
  const [deleting, setDeleting] = useState<FinancialInstitutionContact | null>(null)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [errors, setErrors] = useState<{ name?: string; email?: string; general?: string }>({})
  const [denied, setDenied] = useState(false)
  const [opening, setOpening] = useState<string | null>(null)
  const writeLock = useRef(false)
  const query = useQuery({
    queryKey: [...key, user?.id, page],
    queryFn: ({ signal }) => api.list(page, 20, signal), enabled: allowed && !denied,
    retry: (count, error) => !(error instanceof FinancialContactError && error.status < 500) && count < 2,
  })
  useEffect(() => () => {
    void qc.cancelQueries({ queryKey: key })
    qc.removeQueries({ queryKey: key })
  }, [qc, user?.id, allowed])
  const refresh = () => qc.invalidateQueries({ queryKey: key })
  const handleError = (error: unknown, inForm = false) => {
    const message = error instanceof Error ? error.message : 'No se pudo completar la operación.'
    if (error instanceof FinancialContactError && error.status === 403) {
      setDenied(true); setForm(null); setDeleting(null)
      void qc.cancelQueries({ queryKey: key }); qc.removeQueries({ queryKey: key })
    }
    if (error instanceof FinancialContactError && error.status === 404) {
      setForm(null); setDeleting(null); void refresh()
    }
    if (inForm) setErrors(error instanceof FinancialContactError && error.status === 409 ? { name: message } : { general: message })
    else toast.error(message)
  }
  const save = useMutation({
    mutationFn: async (input: { name: string; email: string }) => {
      if (!allowed || denied) throw new Error('Acceso denegado.')
      return form?.mode === 'edit' && form.contact ? api.update(form.contact.id, input) : api.create(input)
    }, retry: false,
    onSuccess: async () => { setForm(null); toast.success('Entidad guardada'); await refresh() },
    onError: error => handleError(error, true),
  })
  const remove = useMutation({
    mutationFn: async (contact: FinancialInstitutionContact) => {
      if (!allowed || denied) throw new Error('Acceso denegado.')
      await api.delete(contact.id)
    }, retry: false,
    onSuccess: async () => {
      setPage(pageAfterContactDeletion(page, query.data?.items.length ?? 0))
      setDeleting(null); toast.success('Entidad eliminada'); await refresh()
    }, onError: error => handleError(error),
  })
  const busy = save.isPending || remove.isPending
  const open = async (mode: FormState['mode'], contact?: FinancialInstitutionContact) => {
    if (opening || !allowed || denied) return
    setErrors({})
    if (!contact) { setName(''); setEmail(''); setForm({ mode }); return }
    setOpening(contact.id)
    try {
      const current = await api.get(contact.id)
      setName(current.name); setEmail(current.email); setForm({ mode, contact: current })
    } catch (error) { handleError(error) }
    finally { setOpening(null) }
  }
  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (writeLock.current || busy) return
    const parsed = financialContactSchema.safeParse({ name, email })
    if (!parsed.success) {
      const fields = parsed.error.flatten().fieldErrors
      setErrors({ name: fields.name?.[0], email: fields.email?.[0] }); return
    }
    if (typeof parsed.data.name !== 'string' || typeof parsed.data.email !== 'string') return
    writeLock.current = true; setErrors({})
    try { await save.mutateAsync({ name: parsed.data.name, email: parsed.data.email }) } catch { /* Presented by onError; keep the form. */ }
    finally { writeLock.current = false }
  }
  if (!allowed || denied || (query.error instanceof FinancialContactError && query.error.status === 403)) {
    return <div className="p-6"><h1 className="text-2xl font-semibold">Acceso denegado</h1><p className="mt-2 text-muted-foreground">Solo administradores pueden consultar este directorio.</p></div>
  }
  const items = query.data?.items ?? []
  const pagination = query.data?.pagination
  const readonly = form?.mode === 'view'
  return <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
    <header className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-3"><Building2 className="h-7 w-7 text-primary" /><div><h1 className="text-2xl font-semibold">Entidades financieras</h1><p className="text-sm text-muted-foreground">{pagination ? `${pagination.total} entidades` : 'Directorio de contactos'}</p></div></div>
      <div className="flex gap-2"><Button variant="outline" size="icon" title="Actualizar listado" aria-label="Actualizar listado" disabled={query.isFetching || busy} onClick={() => query.refetch()}><RefreshCw className={`h-4 w-4 ${query.isFetching ? 'animate-spin' : ''}`} /></Button><Button onClick={() => open('create')} disabled={busy}><Plus className="mr-2 h-4 w-4" />Agregar entidad</Button></div>
    </header>
    {query.isError ? <div role="alert" className="space-y-3 border-y py-10 text-center"><p className="font-medium">No pudimos cargar las entidades</p><p className="text-sm text-muted-foreground">{query.error.message}</p><Button variant="outline" onClick={() => query.refetch()}>Reintentar</Button></div>
      : query.isLoading ? <div role="status" className="flex items-center justify-center gap-2 py-16"><Loader2 className="h-5 w-5 animate-spin" />Cargando entidades…</div>
      : items.length === 0 ? <div className="space-y-3 border-y py-16 text-center"><Building2 className="mx-auto h-10 w-10 text-muted-foreground" /><h2 className="text-lg font-semibold">{page > 1 ? 'No hay entidades en esta página' : 'Aún no hay entidades financieras'}</h2>{page === 1 && <Button variant="outline" onClick={() => open('create')}><Plus className="mr-2 h-4 w-4" />Agregar entidad</Button>}</div>
      : <Table><TableHeader><TableRow><TableHead>Nombre</TableHead><TableHead>Correo</TableHead><TableHead>Última actualización</TableHead><TableHead className="text-right">Acciones</TableHead></TableRow></TableHeader><TableBody>{items.map(contact => <TableRow key={contact.id}>
        <TableCell className="min-w-40 max-w-xs break-words font-medium">{contact.name}</TableCell><TableCell className="min-w-48 max-w-xs break-all">{contact.email}</TableCell><TableCell className="min-w-40 text-muted-foreground">{date(contact.updatedAt)}</TableCell>
        <TableCell><div className="flex justify-end gap-1">{([{ mode: 'view', label: 'Ver entidad', icon: Eye }, { mode: 'edit', label: 'Editar entidad', icon: Pencil }, { mode: 'delete', label: 'Eliminar entidad', icon: Trash2 }] as const).map(action => <Tooltip key={action.mode}><TooltipTrigger asChild><Button variant="ghost" size="icon" aria-label={`${action.label}: ${contact.name}`} disabled={busy || opening !== null} onClick={() => action.mode === 'delete' ? setDeleting(contact) : open(action.mode, contact)} className={action.mode === 'delete' ? 'text-destructive' : ''}>{opening === contact.id && action.mode === 'view' ? <Loader2 className="h-4 w-4 animate-spin" /> : <action.icon className="h-4 w-4" />}</Button></TooltipTrigger><TooltipContent>{action.label}</TooltipContent></Tooltip>)}</div></TableCell>
      </TableRow>)}</TableBody></Table>}
    {pagination && pagination.totalPages > 0 && <footer className="flex flex-wrap items-center justify-between gap-3 border-t pt-4"><p className="text-sm text-muted-foreground">Página {page} de {pagination.totalPages} · {pagination.total} entidades</p><div className="flex gap-2"><Button variant="outline" size="icon" aria-label="Página anterior" disabled={page <= 1 || query.isFetching || busy} onClick={() => setPage(value => value - 1)}><ChevronLeft className="h-4 w-4" /></Button><Button variant="outline" size="icon" aria-label="Página siguiente" disabled={page >= pagination.totalPages || query.isFetching || busy} onClick={() => setPage(value => value + 1)}><ChevronRight className="h-4 w-4" /></Button></div></footer>}
    <Dialog open={form !== null} onOpenChange={value => { if (!value && !busy) setForm(null) }}><DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-lg" onEscapeKeyDown={event => { if (busy) event.preventDefault() }} onInteractOutside={event => { if (busy) event.preventDefault() }}><DialogHeader><DialogTitle>{readonly ? 'Detalle de entidad' : form?.mode === 'edit' ? 'Editar entidad' : 'Agregar entidad'}</DialogTitle><DialogDescription>{form?.contact?.name ?? 'Nombre y correo de contacto'}</DialogDescription></DialogHeader>
      <form onSubmit={submit} className="space-y-5"><div className="space-y-2"><Label htmlFor="contact-name">Nombre de la entidad</Label><Input id="contact-name" value={name} onChange={event => setName(event.target.value)} disabled={busy} readOnly={readonly} maxLength={160} aria-invalid={!!errors.name} aria-describedby={errors.name ? 'contact-name-error' : undefined} />{errors.name && <p id="contact-name-error" role="alert" className="text-sm text-destructive">{errors.name}</p>}</div>
      <div className="space-y-2"><Label htmlFor="contact-email">Correo</Label><Input id="contact-email" type="email" value={email} onChange={event => setEmail(event.target.value)} disabled={busy} readOnly={readonly} maxLength={254} aria-invalid={!!errors.email} aria-describedby={errors.email ? 'contact-email-error' : undefined} />{errors.email && <p id="contact-email-error" role="alert" className="text-sm text-destructive">{errors.email}</p>}</div>
      {readonly && form?.contact && <dl className="space-y-2 text-sm text-muted-foreground"><div><dt>Creada</dt><dd>{date(form.contact.createdAt)}</dd></div><div><dt>Última actualización</dt><dd>{date(form.contact.updatedAt)}</dd></div></dl>}
      {errors.general && <p role="alert" className="text-sm text-destructive">{errors.general}</p>}<DialogFooter><Button type="button" variant="outline" disabled={busy} onClick={() => setForm(null)}>{readonly ? 'Cerrar' : 'Cancelar'}</Button>{!readonly && <Button type="submit" disabled={busy}>{save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Guardar</Button>}</DialogFooter></form>
    </DialogContent></Dialog>
    <Dialog open={deleting !== null} onOpenChange={value => { if (!value && !busy) setDeleting(null) }}><DialogContent className="sm:max-w-md" onEscapeKeyDown={event => { if (busy) event.preventDefault() }} onInteractOutside={event => { if (busy) event.preventDefault() }}><DialogHeader><DialogTitle>Eliminar entidad</DialogTitle><DialogDescription className="break-words">¿Eliminar definitivamente a {deleting?.name}? Esta acción no se puede deshacer.</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" disabled={busy} onClick={() => setDeleting(null)}>Cancelar</Button><Button variant="destructive" disabled={busy} onClick={async () => { if (!deleting || writeLock.current) return; writeLock.current = true; try { await remove.mutateAsync(deleting) } catch { /* Presented by onError. */ } finally { writeLock.current = false } }}>{remove.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Eliminar entidad</Button></DialogFooter></DialogContent></Dialog>
  </div>
}