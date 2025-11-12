import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { alianzasService } from '@/services/alianzasService'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { alianzaSchema, type NuevaAlianzaInput } from '@/schemas/alianzaSchema'
import { useToast } from '@/hooks/use-toast'
import { Trash2, Plus, Mail, Phone, ArrowUpDown, Pencil, Users, MoreHorizontal, CalendarIcon, AlertTriangle } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription } from '@/components/ui/alert'
import type { Alianza } from '@/types/alianzas'
import { useAllianceUserCount } from './hooks/useAllianceUsers'

function useDebounce<T>(value: T, delay = 300) {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return v
}

const fmtPct = (n: number) => `${n.toFixed(2)}%`

function AllianceUserCountPill({ alianzaId }: { alianzaId: string }) {
  const { data: count = 0 } = useAllianceUserCount(alianzaId);
  const navigate = useNavigate();

  return (
    <Button
      variant="outline"
      size="sm"
      className="h-6 px-2 text-xs"
      onClick={(e) => {
        e.stopPropagation();
        navigate(`/alianzas/${alianzaId}#usuarios`);
      }}
    >
      <Users className="h-3 w-3 mr-1" />
      Usuarios ({count})
    </Button>
  );
}

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
                        <div className="flex items-center gap-2">
                          <Badge variant={a.activo ? 'default' : 'secondary'}>{a.activo ? 'Activo' : 'Inactivo'}</Badge>
                          <AllianceUserCountPill alianzaId={a.id} />
                        </div>
                      </TableCell>
                      <TableCell>{new Date(a.createdAt).toLocaleDateString('es-CL', { timeZone: 'America/Santiago' })}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="outline" size="icon" aria-label="Acciones">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              <DropdownMenuItem disabled>
                                <Pencil className="mr-2 h-4 w-4" />
                                Editar alianza
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem asChild>
                                <Link to={`/alianzas/${a.id}#usuarios`} className="flex items-center">
                                  <Users className="mr-2 h-4 w-4" />
                                  Gestionar usuarios
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem 
                                onClick={() => removeMutation.mutate(a.id)}
                                className="text-destructive focus:text-destructive"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Eliminar alianza
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
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
    defaultValues: { 
      nombre: '', 
      contacto: { fono: '', email: '' }, 
      direccion: '', 
      comision: 0, 
      activo: true,
      logo: '' 
    },
    mode: 'onBlur',
  })
  const [open, setOpen] = useState(false)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  
  const comisionValue = form.watch('comision')
  const showComisionWarning = comisionValue !== undefined && comisionValue !== null && 
    (comisionValue < 1 || comisionValue > 10) && comisionValue >= 0 && comisionValue <= 100

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => {
        const base64String = reader.result as string
        setLogoPreview(base64String)
        form.setValue('logo', base64String)
      }
      reader.readAsDataURL(file)
    }
  }

  const submit = (v: NuevaAlianzaInput) => {
    onCreate({ ...v, comision: Number(v.comision) })
    setOpen(false)
    form.reset()
    setLogoPreview(null)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="hero" className="inline-flex items-center gap-2" aria-label="Crear Alianza">
          <Plus className="h-4 w-4" /> Crear Alianza
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl" aria-describedby="form-desc">
        <DialogHeader>
          <DialogTitle>Nueva Alianza</DialogTitle>
          <DialogDescription id="form-desc">Completa la información de la alianza comercial.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(submit)} className="space-y-4">
            {/* Información Básica */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="nombre"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre *</FormLabel>
                    <FormControl>
                      <Input placeholder="Nombre de la alianza" {...field} />
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
                    <FormLabel>Comisión *</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input 
                          type="number" 
                          step="0.01" 
                          min={0} 
                          max={100} 
                          placeholder="0.00"
                          className="pr-8"
                          {...field} 
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>
                      </div>
                    </FormControl>
                    {showComisionWarning && (
                      <Alert variant="default" className="mt-2 border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/20">
                        <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-500" />
                        <AlertDescription className="text-xs text-amber-800 dark:text-amber-400">
                          Comisión fuera del rango típico (1% - 10%). Verifica que el valor sea correcto.
                        </AlertDescription>
                      </Alert>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Contacto */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="contacto.email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="contacto@empresa.cl" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="contacto.fono"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Teléfono</FormLabel>
                    <FormControl>
                      <Input placeholder="+56 9 1234 5678" {...field} />
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
                    <Input placeholder="Calle, número, comuna, ciudad" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Vigencia del Contrato */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="fechaInicio"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Inicio de Vigencia *</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              "pl-3 text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value ? (
                              format(field.value, "dd/MM/yyyy")
                            ) : (
                              <span>Seleccionar fecha</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          initialFocus
                          className={cn("p-3 pointer-events-auto")}
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="fechaTermino"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Término de Vigencia *</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              "pl-3 text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value ? (
                              format(field.value, "dd/MM/yyyy")
                            ) : (
                              <span>Seleccionar fecha</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          initialFocus
                          className={cn("p-3 pointer-events-auto")}
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Logo */}
            <FormField
              control={form.control}
              name="logo"
              render={({ field: { value, onChange, ...field } }) => (
                <FormItem>
                  <FormLabel>Logo de la Alianza</FormLabel>
                  <FormControl>
                    <div className="space-y-2">
                      <Input
                        type="file"
                        accept="image/*"
                        onChange={handleLogoChange}
                        {...field}
                      />
                      {logoPreview && (
                        <div className="flex items-center gap-2 p-2 border rounded-md bg-muted/30">
                          <img src={logoPreview} alt="Vista previa" className="h-12 w-12 object-contain rounded" />
                          <span className="text-xs text-muted-foreground">Imagen seleccionada</span>
                        </div>
                      )}
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Estado */}
            <FormField
              control={form.control}
              name="activo"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <FormLabel className="text-sm font-medium">Alianza Activa</FormLabel>
                    <p className="text-xs text-muted-foreground">
                      La alianza estará operativa en el sistema
                    </p>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? 'Creando...' : 'Crear Alianza'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}