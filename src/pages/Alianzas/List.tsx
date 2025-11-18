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
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { alianzaSchema, type NuevaAlianzaInput } from '@/schemas/alianzaSchema'
import { useToast } from '@/hooks/use-toast'
import { Trash2, Plus, Mail, Phone, ArrowUpDown, Pencil, Users, MoreHorizontal, CalendarIcon, AlertTriangle, Building2, Eye } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Textarea } from '@/components/ui/textarea'
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
  const [viewAlianza, setViewAlianza] = useState<Alianza | null>(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [sortBy, setSortBy] = useState<'nombre' | 'comisionDegravamen' | undefined>('nombre')
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

  const toggleSort = (key: 'nombre' | 'comisionDegravamen') => {
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
                    <TableHead className="w-[60px]">Logo</TableHead>
                    <TableHead>
                      <button className="inline-flex items-center gap-1" onClick={() => toggleSort('nombre')} aria-label="Ordenar por nombre">
                        Nombre <ArrowUpDown className="h-4 w-4" />
                      </button>
                    </TableHead>
                    <TableHead>Contacto</TableHead>
                    <TableHead>Dirección</TableHead>
                    <TableHead>
                      <button className="inline-flex items-center gap-1" onClick={() => toggleSort('comisionDegravamen')} aria-label="Ordenar por comisión degravamen">
                        Comisiones <ArrowUpDown className="h-4 w-4" />
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
                      <TableCell>
                        <div className="w-10 h-10 rounded border border-border overflow-hidden bg-muted flex items-center justify-center shrink-0">
                          {a.logo ? (
                            <img 
                              src={a.logo} 
                              alt={`Logo ${a.nombre}`}
                              className="w-full h-full object-contain"
                            />
                          ) : (
                            <Building2 className="w-5 h-5 text-muted-foreground" />
                          )}
                        </div>
                      </TableCell>
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
                      <TableCell>
                        <div className="text-sm">
                          <div>D: {fmtPct(a.comisionDegravamen)}</div>
                          <div className="text-muted-foreground">C: {fmtPct(a.comisionCesantia)}</div>
                        </div>
                      </TableCell>
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
                              <DropdownMenuItem onClick={() => setViewAlianza(a)}>
                                <Eye className="mr-2 h-4 w-4" />
                                Ver detalles
                              </DropdownMenuItem>
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

      {/* Diálogo de Ver Detalles */}
      <ViewAlianzaDialog alianza={viewAlianza} open={!!viewAlianza} onOpenChange={(open) => !open && setViewAlianza(null)} />
    </main>
  )
}

function CreateAlianzaButton({ onCreate, loading }: { onCreate: (v: NuevaAlianzaInput) => void; loading?: boolean }) {
  const form = useForm<NuevaAlianzaInput>({
    resolver: zodResolver(alianzaSchema),
    defaultValues: { 
      nombre: '',
      code: '',
      rut: '',
      contacto: { fono: '', email: '' }, 
      direccion: '',
      descripcion: '', 
      comisionDegravamen: 0, 
      comisionCesantia: 0,
      activo: true,
      fechaInicio: new Date(),
      fechaTermino: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      logo: '' 
    },
    mode: 'onSubmit',
    reValidateMode: 'onChange',
  })
  const [open, setOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [pendingData, setPendingData] = useState<NuevaAlianzaInput | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  
  const comisionDegravamenValue = form.watch('comisionDegravamen')
  const comisionCesantiaValue = form.watch('comisionCesantia')
  const showDegravamenWarning = comisionDegravamenValue !== undefined && comisionDegravamenValue !== null && 
    (comisionDegravamenValue < 1 || comisionDegravamenValue > 10) && comisionDegravamenValue >= 0 && comisionDegravamenValue <= 100
  const showCesantiaWarning = comisionCesantiaValue !== undefined && comisionCesantiaValue !== null && 
    (comisionCesantiaValue < 1 || comisionCesantiaValue > 50) && comisionCesantiaValue >= 0 && comisionCesantiaValue <= 100

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

  const handleFormSubmit = (v: NuevaAlianzaInput) => {
    setPendingData(v)
    setConfirmOpen(true)
  }

  const confirmCreate = () => {
    if (pendingData) {
      onCreate({ 
        ...pendingData, 
        comisionDegravamen: Number(pendingData.comisionDegravamen),
        comisionCesantia: Number(pendingData.comisionCesantia)
      })
      setConfirmOpen(false)
      setOpen(false)
      form.reset()
      setLogoPreview(null)
      setPendingData(null)
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="hero" className="inline-flex items-center gap-2" aria-label="Crear Alianza">
            <Plus className="h-4 w-4" /> Crear Alianza
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto" aria-describedby="form-desc">
          <DialogHeader>
            <DialogTitle>Nueva Alianza</DialogTitle>
            <DialogDescription id="form-desc">Completa la información de la alianza comercial.</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-4">
              {/* Información Básica */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="nombre"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nombre *</FormLabel>
                      <FormControl>
                        <Input placeholder="Ej: Sindicato XYZ" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Código *</FormLabel>
                      <FormControl>
                        <Input placeholder="Ej: SIN-001" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="rut"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>RUT *</FormLabel>
                      <FormControl>
                        <Input placeholder="12.345.678-9" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="descripcion"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Descripción</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Información relevante sobre la alianza"
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Fila 2: Comisiones */}
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="comisionDegravamen"
                  render={({ field: { value, onChange, ...field } }) => (
                    <FormItem>
                      <FormLabel>Seguro de Degravamen *</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input 
                            type="number" 
                            step="0.01" 
                            min={0} 
                            max={100} 
                            placeholder="0.00"
                            className="pr-8"
                            value={value || ''}
                            onChange={(e) => onChange(e.target.valueAsNumber || 0)}
                            {...field} 
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>
                        </div>
                      </FormControl>
                      {showDegravamenWarning && (
                        <Alert variant="default" className="mt-2 border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/20">
                          <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-500" />
                          <AlertDescription className="text-xs text-amber-800 dark:text-amber-400">
                            Comisión de degravamen fuera del rango típico (1% - 10%). Verifica que el valor sea correcto.
                          </AlertDescription>
                        </Alert>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="comisionCesantia"
                  render={({ field: { value, onChange, ...field } }) => (
                    <FormItem>
                      <FormLabel>Seguro de Cesantía *</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input 
                            type="number" 
                            step="0.01" 
                            min={0} 
                            max={100} 
                            placeholder="0.00"
                            className="pr-8"
                            value={value || ''}
                            onChange={(e) => onChange(e.target.valueAsNumber || 0)}
                            {...field} 
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>
                        </div>
                      </FormControl>
                      {showCesantiaWarning && (
                        <Alert variant="default" className="mt-2 border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/20">
                          <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-500" />
                          <AlertDescription className="text-xs text-amber-800 dark:text-amber-400">
                            Comisión de cesantía fuera del rango típico (1% - 50%). Verifica que el valor sea correcto.
                          </AlertDescription>
                        </Alert>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

            {/* Fila 3: Contacto y Dirección */}
            <div className="grid grid-cols-3 gap-4">
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
              <FormField
                control={form.control}
                name="direccion"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Dirección</FormLabel>
                    <FormControl>
                      <Input placeholder="Calle, comuna, ciudad" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Fila 4: Fechas de Vigencia */}
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

            {/* Fila 5: Logo y Estado */}
            <div className="grid grid-cols-2 gap-4 items-start">
              <FormField
                control={form.control}
                name="logo"
                render={({ field: { value, onChange, ...field } }) => (
                  <FormItem>
                    <FormLabel>Logo de la Alianza</FormLabel>
                    <FormControl>
                      <Input
                        type="file"
                        accept="image/*"
                        onChange={handleLogoChange}
                        {...field}
                      />
                    </FormControl>
                    {logoPreview && (
                      <div className="flex items-center gap-2 p-2 border rounded-md bg-muted/30 mt-2">
                        <img src={logoPreview} alt="Vista previa" className="h-10 w-10 object-contain rounded" />
                        <span className="text-xs text-muted-foreground">Imagen seleccionada</span>
                      </div>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="activo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Estado</FormLabel>
                    <div className="flex items-center justify-between rounded-lg border p-3">
                      <span className="text-sm font-medium">Alianza Activa</span>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter className="gap-2 sm:gap-0 pt-2">
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

    <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Confirmar Creación de Alianza</AlertDialogTitle>
          <AlertDialogDescription>
            Se creará una nueva alianza con los siguientes datos:
          </AlertDialogDescription>
        </AlertDialogHeader>
        
        {pendingData && (
          <div className="space-y-2 my-4 p-4 rounded-lg bg-muted/50 border">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="font-medium">Nombre:</span>
                <p className="text-muted-foreground">{pendingData.nombre}</p>
              </div>
              <div>
                <span className="font-medium">Código:</span>
                <p className="text-muted-foreground">{pendingData.code}</p>
              </div>
              <div>
                <span className="font-medium">RUT:</span>
                <p className="text-muted-foreground">{pendingData.rut}</p>
              </div>
              <div>
                <span className="font-medium">Comisión Degravamen:</span>
                <p className="text-muted-foreground">{pendingData.comisionDegravamen}%</p>
              </div>
              <div>
                <span className="font-medium">Comisión Cesantía:</span>
                <p className="text-muted-foreground">{pendingData.comisionCesantia}%</p>
              </div>
              {pendingData.contacto.email && (
                <div>
                  <span className="font-medium">Email:</span>
                  <p className="text-muted-foreground">{pendingData.contacto.email}</p>
                </div>
              )}
              {pendingData.contacto.fono && (
                <div>
                  <span className="font-medium">Teléfono:</span>
                  <p className="text-muted-foreground">{pendingData.contacto.fono}</p>
                </div>
              )}
              {pendingData.direccion && (
                <div className="col-span-2">
                  <span className="font-medium">Dirección:</span>
                  <p className="text-muted-foreground">{pendingData.direccion}</p>
                </div>
              )}
              {pendingData.descripcion && (
                <div className="col-span-2">
                  <span className="font-medium">Descripción:</span>
                  <p className="text-muted-foreground">{pendingData.descripcion}</p>
                </div>
              )}
              <div>
                <span className="font-medium">Vigencia:</span>
                <p className="text-muted-foreground">
                  {pendingData.fechaInicio && format(pendingData.fechaInicio, "dd/MM/yyyy")} - {pendingData.fechaTermino && format(pendingData.fechaTermino, "dd/MM/yyyy")}
                </p>
              </div>
              <div>
                <span className="font-medium">Estado:</span>
                <p className="text-muted-foreground">{pendingData.activo ? 'Activa' : 'Inactiva'}</p>
              </div>
            </div>
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={confirmCreate} disabled={loading}>
            {loading ? 'Creando...' : 'Confirmar y Crear'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  )
}

function ViewAlianzaDialog({ alianza, open, onOpenChange }: { alianza: Alianza | null; open: boolean; onOpenChange: (open: boolean) => void }) {
  if (!alianza) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Detalles de la Alianza</DialogTitle>
          <DialogDescription>Información completa de la alianza comercial</DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Logo y Estado */}
          {alianza.logo && (
            <div className="flex justify-center">
              <div className="w-32 h-32 rounded border border-border overflow-hidden bg-muted flex items-center justify-center">
                <img 
                  src={alianza.logo} 
                  alt={`Logo ${alianza.nombre}`}
                  className="w-full h-full object-contain"
                />
              </div>
            </div>
          )}

          {/* Información Básica */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Información Básica</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Nombre</label>
                <p className="text-sm mt-1">{alianza.nombre}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Código</label>
                <p className="text-sm mt-1">{alianza.code}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">RUT</label>
                <p className="text-sm mt-1">{alianza.rut}</p>
              </div>
            </div>
            {alianza.descripcion && (
              <div>
                <label className="text-sm font-medium text-muted-foreground">Descripción</label>
                <p className="text-sm mt-1">{alianza.descripcion}</p>
              </div>
            )}
          </div>

          <Separator />

          {/* Comisiones */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Comisiones</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 border rounded-lg">
                <label className="text-sm font-medium text-muted-foreground">Seguro de Degravamen</label>
                <p className="text-2xl font-bold mt-2">{fmtPct(alianza.comisionDegravamen)}</p>
              </div>
              <div className="p-4 border rounded-lg">
                <label className="text-sm font-medium text-muted-foreground">Seguro de Cesantía</label>
                <p className="text-2xl font-bold mt-2">{fmtPct(alianza.comisionCesantia)}</p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Información de Contacto */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Información de Contacto</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {alianza.contacto.email && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                    <Mail className="h-4 w-4" />
                    Email
                  </label>
                  <p className="text-sm mt-1">{alianza.contacto.email}</p>
                </div>
              )}
              {alianza.contacto.fono && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                    <Phone className="h-4 w-4" />
                    Teléfono
                  </label>
                  <p className="text-sm mt-1">{alianza.contacto.fono}</p>
                </div>
              )}
            </div>
            {alianza.direccion && (
              <div>
                <label className="text-sm font-medium text-muted-foreground">Dirección</label>
                <p className="text-sm mt-1">{alianza.direccion}</p>
              </div>
            )}
          </div>

          <Separator />

          {/* Vigencia */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Vigencia del Contrato</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Inicio</label>
                <p className="text-sm mt-1">{new Date(alianza.fechaInicio).toLocaleDateString('es-CL', { timeZone: 'America/Santiago' })}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Término</label>
                <p className="text-sm mt-1">{new Date(alianza.fechaTermino).toLocaleDateString('es-CL', { timeZone: 'America/Santiago' })}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Estado</label>
                <div className="mt-1">
                  <Badge variant={alianza.activo ? 'default' : 'secondary'}>
                    {alianza.activo ? 'Activo' : 'Inactivo'}
                  </Badge>
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* Metadatos */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-muted-foreground">
            <div>
              <span className="font-medium">Creado:</span> {new Date(alianza.createdAt).toLocaleString('es-CL', { timeZone: 'America/Santiago' })}
            </div>
            <div>
              <span className="font-medium">Actualizado:</span> {new Date(alianza.updatedAt).toLocaleString('es-CL', { timeZone: 'America/Santiago' })}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
