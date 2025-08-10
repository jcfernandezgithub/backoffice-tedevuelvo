import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { alianzasService } from '@/services/alianzasService'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { alianzaSchema, type NuevaAlianzaInput } from '@/schemas/alianzaSchema'
import { useToast } from '@/hooks/use-toast'
import { Trash2, Plus, Mail, Phone, ArrowUpDown, Pencil } from 'lucide-react'
import type { Alianza } from '@/types/alianzas'

function useDebounce<T>(value: T, delay = 300) {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return v
}

const fmtPct = (n: number) => `${n.toFixed(2)}%`

export default function AlianzasList() {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [sortBy, setSortBy] = useState<'nombre' | 'comision' | undefined>('nombre')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const dSearch = useDebounce(search)
  const qc = useQueryClient()
  const { toast } = useToast()

  useEffect(() => {
    document.title = 'Alianzas — Te Devuelvo'
  }, [])

  const listQuery = useQuery<{ items: Alianza[]; total: number; page: number; pageSize: number }>({
    queryKey: ['alianzas', { search: dSearch, page, pageSize, sortBy, sortDir }],
    queryFn: () => alianzasService.list({ search: dSearch, page, pageSize, sortBy, sortDir }),
    placeholderData: (prev) => prev,
  })

  useEffect(() => {
    setPage(1)
  }, [dSearch])

  const toggleSort = (key: 'nombre' | 'comision') => {
    if (sortBy !== key) {
      setSortBy(key)
      setSortDir('asc')
    } else {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    }
  }

  const crearMutation = useMutation({
    mutationFn: (input: NuevaAlianzaInput) => alianzasService.create(input),
    onSuccess: () => {
      toast({ title: 'Alianza creada' })
      qc.invalidateQueries({ queryKey: ['alianzas'] })
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message }),
  })

  const removeMutation = useMutation({
    mutationFn: (id: string) => alianzasService.remove(id),
    onSuccess: () => {
      toast({ title: 'Alianza eliminada' })
      qc.invalidateQueries({ queryKey: ['alianzas'] })
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message }),
  })

  return (
    <main className="p-4 space-y-4">
      <header className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <h1 className="text-2xl font-semibold">Alianzas</h1>
        <CreateAlianzaButton onCreate={(v) => crearMutation.mutate(v)} loading={crearMutation.isPending} />
      </header>

      <Card>
        <CardHeader className="gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>Listado</CardTitle>
            <CardDescription>Gestiona alianzas y comisiones</CardDescription>
          </div>
          <div className="flex gap-2 w-full md:w-auto">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre, email o fono"
              aria-label="Buscar alianzas"
            />
          </div>
        </CardHeader>
        <CardContent>
          {listQuery.isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : listQuery.data && listQuery.data.items.length > 0 ? (
            <div className="w-full overflow-x-auto">
              <Table role="table" aria-label="Tabla de alianzas">
                <TableHeader>
                  <TableRow>
                    <TableHead>
                      <button className="inline-flex items-center gap-1" onClick={() => toggleSort('nombre')} aria-label="Ordenar por nombre">
                        Nombre <ArrowUpDown className="h-4 w-4" />
                      </button>
                    </TableHead>
                    <TableHead>Contacto</TableHead>
                    <TableHead>Dirección</TableHead>
                    <TableHead>
                      <button className="inline-flex items-center gap-1" onClick={() => toggleSort('comision')} aria-label="Ordenar por comisión">
                        Comisión <ArrowUpDown className="h-4 w-4" />
                      </button>
                    </TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Creación</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {listQuery.data.items.map((a) => (
                    <TableRow key={a.id} tabIndex={0}>
                      <TableCell className="font-medium">{a.nombre}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3 text-sm">
                          {a.contacto.fono && (
                            <span className="inline-flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{a.contacto.fono}</span>
                          )}
                          {a.contacto.email && (
                            <span className="inline-flex items-center gap-1"><Mail className="h-3.5 w-3.5" />{a.contacto.email}</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{a.direccion ?? '—'}</TableCell>
                      <TableCell>{fmtPct(a.comision)}</TableCell>
                      <TableCell>
                        <Badge variant={a.activo ? 'default' : 'secondary'}>{a.activo ? 'Activo' : 'Inactivo'}</Badge>
                      </TableCell>
                      <TableCell>{new Date(a.createdAt).toLocaleDateString('es-CL', { timeZone: 'America/Santiago' })}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="outline" size="icon" aria-label="Editar alianza" title="Editar (próximamente)" disabled>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <DeleteAlianzaButton id={a.id} nombre={a.nombre} onConfirm={() => removeMutation.mutate(a.id)} />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-10">
              <p className="text-muted-foreground">No hay alianzas aún.</p>
              <div className="mt-4">
                <CreateAlianzaButton onCreate={(v) => crearMutation.mutate(v)} loading={crearMutation.isPending} />
              </div>
            </div>
          )}

          {/* Paginación */}
          {listQuery.data && listQuery.data.total > 0 && (
            <div className="mt-4 flex flex-col items-center gap-2 sm:flex-row sm:justify-between">
              <p className="text-sm text-muted-foreground">
                Página {listQuery.data.page} de {Math.ceil(listQuery.data.total / listQuery.data.pageSize)} • {listQuery.data.total} alianzas
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={listQuery.data.page === 1 || listQuery.isFetching}
                >
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={listQuery.data.page >= Math.ceil(listQuery.data.total / listQuery.data.pageSize) || listQuery.isFetching}
                >
                  Siguiente
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  )
}

function CreateAlianzaButton({ onCreate, loading }: { onCreate: (v: NuevaAlianzaInput) => void; loading?: boolean }) {
  const form = useForm<NuevaAlianzaInput>({
    resolver: zodResolver(alianzaSchema),
    defaultValues: { nombre: '', contacto: { fono: '', email: '' }, direccion: '', comision: 0, activo: true },
    mode: 'onBlur',
  })
  const [open, setOpen] = useState(false)

  const submit = (v: NuevaAlianzaInput) => {
    onCreate({ ...v, comision: Number(v.comision) })
    setOpen(false)
    form.reset()
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="hero" className="inline-flex items-center gap-2" aria-label="Crear Alianza">
          <Plus className="h-4 w-4" /> Crear Alianza
        </Button>
      </DialogTrigger>
      <DialogContent aria-describedby="form-desc">
        <DialogHeader>
          <DialogTitle>Nueva Alianza</DialogTitle>
          <DialogDescription id="form-desc">Completa los campos para crear la alianza.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(submit)} className="grid gap-3">
            <FormField
              control={form.control}
              name="nombre"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre</FormLabel>
                  <FormControl>
                    <Input placeholder="Nombre de la alianza" {...field} aria-required="true" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid sm:grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="contacto.fono"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fono</FormLabel>
                    <FormControl>
                      <Input placeholder="+56 9 xxxx xxxx" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="contacto.email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="contacto@ejemplo.cl" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="direccion"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Dirección</FormLabel>
                  <FormControl>
                    <Input placeholder="Calle, número, comuna" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="comision"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Comisión (%)</FormLabel>
                  <FormControl>
                    <div className="flex items-center gap-2">
                      <Input type="number" step="0.01" min={0} max={30} aria-describedby="comision-help" {...field} />
                      <span className="text-sm text-muted-foreground">%</span>
                    </div>
                  </FormControl>
                  <p id="comision-help" className="text-xs text-muted-foreground">0 a 30, con hasta 2 decimales</p>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter className="mt-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={loading}>Crear</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

function DeleteAlianzaButton({ id, nombre, onConfirm }: { id: string; nombre: string; onConfirm: () => void }) {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const canDelete = input.trim() === nombre

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        variant="destructive"
        size="icon"
        aria-label={`Eliminar alianza ${nombre}`}
        title={`Eliminar ${nombre}`}
        onClick={() => setOpen(true)}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Eliminar alianza</DialogTitle>
          <DialogDescription>Escribe el nombre de la alianza para confirmar eliminación.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          <label htmlFor={`confirm-${id}`} className="text-sm">Nombre exacto</label>
          <Input id={`confirm-${id}`} value={input} onChange={(e) => setInput(e.target.value)} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button
            variant="destructive"
            onClick={() => {
              onConfirm()
              setOpen(false)
              setInput('')
            }}
            disabled={!canDelete}
          >
            Eliminar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
