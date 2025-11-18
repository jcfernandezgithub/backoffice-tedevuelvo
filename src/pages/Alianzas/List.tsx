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
  const [editAlianza, setEditAlianza] = useState<Alianza | null>(null)
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

  const actualizarMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: NuevaAlianzaInput }) => alianzasService.update(id, input),
    onSuccess: () => {
      toast({ title: 'Alianza actualizada' })
      qc.invalidateQueries({ queryKey: ['alianzas'] })
      setEditAlianza(null)
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
    <main className="p-4 md:p-6 space-y-6 bg-gradient-to-br from-background via-background to-muted/20">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Alianzas Comerciales
          </h1>
          <p className="text-muted-foreground mt-1">Gestiona tus alianzas estratégicas y comisiones</p>
        </div>
        <CreateAlianzaButton onCreate={(v) => crearMutation.mutate(v)} loading={crearMutation.isPending} />
      </div>

      {/* Filtros y búsqueda */}
      <Card className="border-l-4 border-l-primary shadow-md">
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex-1">
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar por nombre, email, teléfono o RUT..."
                  aria-label="Buscar alianzas"
                  className="pl-10 h-11"
                />
              </div>
            </div>
            {listQuery.data && listQuery.data.total > 0 && (
              <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary/5 border border-primary/20">
                <Building2 className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold text-foreground">
                  {listQuery.data.total} {listQuery.data.total === 1 ? 'alianza' : 'alianzas'}
                </span>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {listQuery.isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-40 w-full rounded-xl" />
              ))}
            </div>
          ) : listQuery.data && listQuery.data.items.length > 0 ? (
            <div className="space-y-4">
              {listQuery.data.items.map((a, index) => (
                <Card 
                  key={a.id} 
                  className="group relative overflow-hidden border-l-4 hover:shadow-lg transition-all duration-300 animate-fade-in"
                  style={{ 
                    borderLeftColor: a.activo ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))',
                    animationDelay: `${index * 50}ms`
                  }}
                >
                  <CardContent className="p-6">
                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
                      {/* Columna izquierda: Info principal */}
                      <div className="flex-1 space-y-4">
                        {/* Nombre y código */}
                        <div className="space-y-2">
                          <div className="flex items-start gap-3">
                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/10 to-accent/10 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                              <Building2 className="w-6 h-6 text-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="text-xl font-bold text-foreground truncate">{a.nombre}</h3>
                              <div className="flex items-center gap-2 mt-1">
                                <code className="text-xs font-mono bg-muted px-2 py-1 rounded">{a.code}</code>
                                <span className="text-xs text-muted-foreground">•</span>
                                <span className="text-xs text-muted-foreground">{a.rut}</span>
                              </div>
                            </div>
                          </div>
                          {a.descripcion && (
                            <p className="text-sm text-muted-foreground line-clamp-2 ml-15">{a.descripcion}</p>
                          )}
                        </div>

                        {/* Contacto */}
                        <div className="flex flex-wrap gap-3">
                          {a.contacto.email && (
                            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                              <Mail className="h-3.5 w-3.5 text-primary" />
                              <span className="text-xs font-medium">{a.contacto.email}</span>
                            </div>
                          )}
                          {a.contacto.fono && (
                            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                              <Phone className="h-3.5 w-3.5 text-accent" />
                              <span className="text-xs font-medium">{a.contacto.fono}</span>
                            </div>
                          )}
                          {a.direccion && (
                            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                              <svg className="h-3.5 w-3.5 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                              </svg>
                              <span className="text-xs text-muted-foreground truncate max-w-[200px]">{a.direccion}</span>
                            </div>
                          )}
                        </div>

                        {/* Estado y usuarios */}
                        <div className="flex items-center gap-2">
                          <Badge 
                            variant={a.activo ? 'default' : 'secondary'}
                            className="font-medium"
                          >
                            {a.activo ? '✓ Activa' : 'Inactiva'}
                          </Badge>
                          <AllianceUserCountPill alianzaId={a.id} />
                          <span className="text-xs text-muted-foreground">
                            Creada: {new Date(a.createdAt).toLocaleDateString('es-CL', { timeZone: 'America/Santiago' })}
                          </span>
                        </div>
                      </div>

                      {/* Columna derecha: Comisiones, Vigencia y Acciones */}
                      <div className="flex flex-col gap-4 md:w-72 shrink-0">
                        {/* Comisiones */}
                        <div className="space-y-2">
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Comisiones</p>
                          <div className="grid grid-cols-2 gap-2">
                            <div className="relative overflow-hidden rounded-lg border border-primary/20 bg-gradient-to-br from-primary/5 to-transparent p-3">
                              <div className="absolute top-0 right-0 w-16 h-16 bg-primary/10 rounded-full -mr-8 -mt-8" />
                              <p className="text-xs text-primary font-medium mb-1">Degravamen</p>
                              <p className="text-2xl font-bold text-primary">{fmtPct(a.comisionDegravamen)}</p>
                            </div>
                            <div className="relative overflow-hidden rounded-lg border border-accent/20 bg-gradient-to-br from-accent/5 to-transparent p-3">
                              <div className="absolute top-0 right-0 w-16 h-16 bg-accent/10 rounded-full -mr-8 -mt-8" />
                              <p className="text-xs text-accent font-medium mb-1">Cesantía</p>
                              <p className="text-2xl font-bold text-accent">{fmtPct(a.comisionCesantia)}</p>
                            </div>
                          </div>
                        </div>

                        {/* Vigencia del Contrato */}
                        <div className="space-y-2">
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Vigencia del Contrato</p>
                          <div className="rounded-lg border border-border bg-gradient-to-br from-muted/30 to-transparent p-3 space-y-2">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                                <CalendarIcon className="h-4 w-4 text-primary" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs text-muted-foreground">Inicio</p>
                                <p className="text-sm font-bold text-foreground">
                                  {new Date(a.fechaInicio).toLocaleDateString('es-CL', { 
                                    day: '2-digit',
                                    month: 'short',
                                    year: 'numeric',
                                    timeZone: 'America/Santiago' 
                                  })}
                                </p>
                              </div>
                            </div>
                            <div className="h-px bg-border" />
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
                                <CalendarIcon className="h-4 w-4 text-accent" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs text-muted-foreground">Término</p>
                                <p className="text-sm font-bold text-foreground">
                                  {new Date(a.fechaTermino).toLocaleDateString('es-CL', { 
                                    day: '2-digit',
                                    month: 'short',
                                    year: 'numeric',
                                    timeZone: 'America/Santiago' 
                                  })}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Acciones */}
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setViewAlianza(a)}
                            className="flex-1 hover:bg-primary/5 hover:border-primary/30"
                          >
                            <Eye className="h-4 w-4 mr-1.5" />
                            Ver
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setEditAlianza(a)}
                            className="flex-1 hover:bg-accent/5 hover:border-accent/30"
                          >
                            <Pencil className="h-4 w-4 mr-1.5" />
                            Editar
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="outline" size="sm" className="px-2">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
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
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-16">
              <div className="w-24 h-24 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-4">
                <Building2 className="w-12 h-12 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">No hay alianzas registradas</h3>
              <p className="text-muted-foreground mb-6">Comienza creando tu primera alianza comercial</p>
            </div>
          )}

          {/* Paginación */}
          {listQuery.data && listQuery.data.total > 0 && (
            <div className="mt-6 pt-6 border-t flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
              <p className="text-sm text-muted-foreground">
                Mostrando <span className="font-medium text-foreground">{Math.min((listQuery.data.page - 1) * listQuery.data.pageSize + 1, listQuery.data.total)}</span> - <span className="font-medium text-foreground">{Math.min(listQuery.data.page * listQuery.data.pageSize, listQuery.data.total)}</span> de <span className="font-medium text-foreground">{listQuery.data.total}</span> {listQuery.data.total === 1 ? 'alianza' : 'alianzas'}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={listQuery.data.page === 1 || listQuery.isFetching}
                  className="min-w-24"
                >
                  Anterior
                </Button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, Math.ceil(listQuery.data.total / listQuery.data.pageSize)) }, (_, i) => {
                    const pageNum = i + 1;
                    return (
                      <Button
                        key={pageNum}
                        variant={listQuery.data.page === pageNum ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setPage(pageNum)}
                        disabled={listQuery.isFetching}
                        className="w-9 h-9 p-0"
                      >
                        {pageNum}
                      </Button>
                    );
                  })}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={listQuery.data.page >= Math.ceil(listQuery.data.total / listQuery.data.pageSize) || listQuery.isFetching}
                  className="min-w-24"
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
      
      {/* Diálogo de Editar Alianza */}
      <EditAlianzaDialog 
        alianza={editAlianza} 
        open={!!editAlianza} 
        onOpenChange={(open) => !open && setEditAlianza(null)}
        onUpdate={(input) => editAlianza && actualizarMutation.mutate({ id: editAlianza.id, input })}
        loading={actualizarMutation.isPending}
      />
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
    },
    mode: 'onSubmit',
    reValidateMode: 'onChange',
  })
  const [open, setOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [pendingData, setPendingData] = useState<NuevaAlianzaInput | null>(null)
  
  const comisionDegravamenValue = form.watch('comisionDegravamen')
  const comisionCesantiaValue = form.watch('comisionCesantia')
  const showDegravamenWarning = comisionDegravamenValue !== undefined && comisionDegravamenValue !== null && 
    (comisionDegravamenValue < 1 || comisionDegravamenValue > 10) && comisionDegravamenValue >= 0 && comisionDegravamenValue <= 100
  const showCesantiaWarning = comisionCesantiaValue !== undefined && comisionCesantiaValue !== null && 
    (comisionCesantiaValue < 1 || comisionCesantiaValue > 50) && comisionCesantiaValue >= 0 && comisionCesantiaValue <= 100

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
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto" aria-describedby="form-desc">
          <DialogHeader className="pb-4 border-b">
            <DialogTitle className="text-2xl font-bold flex items-center gap-2">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                <Plus className="h-5 w-5 text-primary-foreground" />
              </div>
              Nueva Alianza Comercial
            </DialogTitle>
            <DialogDescription id="form-desc" className="text-base">
              Completa la información para registrar una nueva alianza en el sistema.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-6 py-4">
              {/* Sección 1: Información Básica */}
              <Card className="border-l-4 border-l-primary">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Building2 className="h-4 w-4 text-primary" />
                    </div>
                    Información Básica
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name="nombre"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Nombre Comercial *</FormLabel>
                          <FormControl>
                            <Input placeholder="Ej: Sindicato Financiero XYZ" {...field} className="font-medium" />
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
                          <FormLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Código Único *</FormLabel>
                          <FormControl>
                            <Input placeholder="Ej: SFX-001" {...field} className="font-mono font-medium" />
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
                          <FormLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">RUT *</FormLabel>
                          <FormControl>
                            <Input placeholder="12.345.678-9" {...field} className="font-medium" />
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
                        <FormLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Descripción</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Información relevante sobre la alianza comercial..."
                            {...field} 
                            rows={3}
                            className="resize-none"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>

              {/* Sección 2: Estructura de Comisiones */}
              <Card className="border-l-4 border-l-accent">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-accent/10 flex items-center justify-center">
                      <svg className="h-4 w-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    Comisiones por Producto
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="comisionDegravamen"
                      render={({ field: { value, onChange, ...field } }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-semibold text-primary uppercase tracking-wide">Seguro de Degravamen *</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Input 
                                type="number" 
                                step="0.01" 
                                min={0} 
                                max={100} 
                                placeholder="0.00"
                                className="pr-12 text-lg font-bold"
                                value={value || ''}
                                onChange={(e) => onChange(e.target.valueAsNumber || 0)}
                                {...field} 
                              />
                              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-lg font-bold text-primary">%</span>
                            </div>
                          </FormControl>
                          {showDegravamenWarning && (
                            <Alert variant="default" className="mt-2 border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/20">
                              <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-500" />
                              <AlertDescription className="text-xs text-amber-800 dark:text-amber-400">
                                Comisión fuera del rango típico (1-10%). Verifica que sea correcta.
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
                          <FormLabel className="text-xs font-semibold text-accent uppercase tracking-wide">Seguro de Cesantía *</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Input 
                                type="number" 
                                step="0.01" 
                                min={0} 
                                max={100} 
                                placeholder="0.00"
                                className="pr-12 text-lg font-bold"
                                value={value || ''}
                                onChange={(e) => onChange(e.target.valueAsNumber || 0)}
                                {...field} 
                              />
                              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-lg font-bold text-accent">%</span>
                            </div>
                          </FormControl>
                          {showCesantiaWarning && (
                            <Alert variant="default" className="mt-2 border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/20">
                              <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-500" />
                              <AlertDescription className="text-xs text-amber-800 dark:text-amber-400">
                                Comisión fuera del rango típico (1-50%). Verifica que sea correcta.
                              </AlertDescription>
                            </Alert>
                          )}
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Sección 3: Información de Contacto */}
                <Card className="border-l-4 border-l-primary">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Mail className="h-4 w-4 text-primary" />
                      </div>
                      Datos de Contacto
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <FormField
                      control={form.control}
                      name="contacto.email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Email</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                              <Input 
                                type="email" 
                                placeholder="contacto@alianza.cl" 
                                {...field} 
                                className="pl-10"
                              />
                            </div>
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
                          <FormLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Teléfono</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                              <Input 
                                type="tel" 
                                placeholder="+56 9 1234 5678" 
                                {...field} 
                                className="pl-10"
                              />
                            </div>
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
                          <FormLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Dirección</FormLabel>
                          <FormControl>
                            <Textarea 
                              placeholder="Av. Principal 1234, Comuna, Ciudad"
                              {...field} 
                              rows={2}
                              className="resize-none"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>

                {/* Sección 4: Vigencia del Contrato */}
                <Card className="border-l-4 border-l-accent">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-accent/10 flex items-center justify-center">
                        <CalendarIcon className="h-4 w-4 text-accent" />
                      </div>
                      Vigencia del Contrato
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <FormField
                      control={form.control}
                      name="fechaInicio"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Fecha de Inicio *</FormLabel>
                          <FormControl>
                            <div className="flex gap-2">
                              <Input
                                type="text"
                                placeholder="dd/mm/aaaa"
                                value={field.value ? format(field.value, "dd/MM/yyyy") : ''}
                                onChange={(e) => {
                                  const value = e.target.value;
                                  // Intentar parsear la fecha en formato dd/mm/yyyy
                                  const parts = value.split('/');
                                  if (parts.length === 3) {
                                    const [day, month, year] = parts;
                                    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
                                    if (!isNaN(date.getTime())) {
                                      field.onChange(date);
                                    }
                                  }
                                }}
                                className="flex-1"
                              />
                              <Popover>
                                <PopoverTrigger asChild>
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    className="shrink-0"
                                    type="button"
                                  >
                                    <CalendarIcon className="h-4 w-4" />
                                  </Button>
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
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="fechaTermino"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Fecha de Término *</FormLabel>
                          <FormControl>
                            <div className="flex gap-2">
                              <Input
                                type="text"
                                placeholder="dd/mm/aaaa"
                                value={field.value ? format(field.value, "dd/MM/yyyy") : ''}
                                onChange={(e) => {
                                  const value = e.target.value;
                                  // Intentar parsear la fecha en formato dd/mm/yyyy
                                  const parts = value.split('/');
                                  if (parts.length === 3) {
                                    const [day, month, year] = parts;
                                    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
                                    if (!isNaN(date.getTime())) {
                                      field.onChange(date);
                                    }
                                  }
                                }}
                                className="flex-1"
                              />
                              <Popover>
                                <PopoverTrigger asChild>
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    className="shrink-0"
                                    type="button"
                                  >
                                    <CalendarIcon className="h-4 w-4" />
                                  </Button>
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
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="activo"
                      render={({ field }) => (
                        <FormItem>
                          <div className="flex items-center justify-between rounded-lg border-2 border-primary/20 bg-gradient-to-r from-primary/5 to-transparent p-4">
                            <div className="space-y-0.5">
                              <FormLabel className="text-sm font-semibold">Estado de la Alianza</FormLabel>
                              <p className="text-xs text-muted-foreground">
                                {field.value ? 'La alianza estará activa inmediatamente' : 'La alianza estará inactiva'}
                              </p>
                            </div>
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
                  </CardContent>
                </Card>
              </div>

              <DialogFooter className="gap-2 sm:gap-0 pt-4 border-t">
                <Button type="button" variant="outline" onClick={() => setOpen(false)} className="min-w-32">
                  Cancelar
                </Button>
                <Button type="submit" disabled={loading} className="min-w-32">
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
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="pb-4 border-b">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-lg border-2 border-primary/20 bg-gradient-to-br from-primary/10 to-accent/10 flex items-center justify-center flex-shrink-0">
              <Building2 className="w-8 h-8 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-2xl font-bold text-foreground">{alianza.nombre}</DialogTitle>
              <DialogDescription className="text-base mt-1 flex items-center gap-2">
                <span className="font-mono text-muted-foreground">{alianza.code}</span>
                <span className="text-muted-foreground">•</span>
                <Badge variant={alianza.activo ? 'default' : 'secondary'} className="font-medium">
                  {alianza.activo ? 'Activa' : 'Inactiva'}
                </Badge>
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          {/* Información Básica */}
          <Card className="border-l-4 border-l-primary shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Building2 className="h-4 w-4 text-primary" />
                </div>
                Información Básica
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Nombre Comercial</label>
                  <p className="text-sm font-medium text-foreground">{alianza.nombre}</p>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Código</label>
                  <p className="text-sm font-mono font-medium text-foreground bg-muted/50 px-2 py-1 rounded inline-block">{alianza.code}</p>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">RUT</label>
                  <p className="text-sm font-medium text-foreground">{alianza.rut}</p>
                </div>
              </div>
              {alianza.descripcion && (
                <div className="space-y-1 pt-2 border-t">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Descripción</label>
                  <p className="text-sm text-foreground leading-relaxed">{alianza.descripcion}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Comisiones */}
          <Card className="border-l-4 border-l-accent shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
                  <svg className="h-4 w-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                Estructura de Comisiones
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="relative overflow-hidden rounded-xl border-2 border-primary/20 bg-gradient-to-br from-primary/5 via-primary/3 to-transparent p-6">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-primary/10 rounded-full -mr-12 -mt-12" />
                  <label className="text-xs font-semibold text-primary uppercase tracking-wide block mb-2">Seguro de Degravamen</label>
                  <p className="text-4xl font-bold text-primary">{fmtPct(alianza.comisionDegravamen)}</p>
                  <p className="text-xs text-muted-foreground mt-2">Comisión por producto</p>
                </div>
                <div className="relative overflow-hidden rounded-xl border-2 border-accent/20 bg-gradient-to-br from-accent/5 via-accent/3 to-transparent p-6">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-accent/10 rounded-full -mr-12 -mt-12" />
                  <label className="text-xs font-semibold text-accent uppercase tracking-wide block mb-2">Seguro de Cesantía</label>
                  <p className="text-4xl font-bold text-accent">{fmtPct(alianza.comisionCesantia)}</p>
                  <p className="text-xs text-muted-foreground mt-2">Comisión por producto</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Información de Contacto */}
            <Card className="border-l-4 border-l-primary shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Mail className="h-4 w-4 text-primary" />
                  </div>
                  Contacto
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {alianza.contacto.email ? (
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted/70 transition-colors">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Mail className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Email</label>
                      <p className="text-sm font-medium text-foreground break-all">{alianza.contacto.email}</p>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 rounded-lg bg-muted/30 text-center">
                    <p className="text-xs text-muted-foreground">Sin email registrado</p>
                  </div>
                )}
                {alianza.contacto.fono ? (
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted/70 transition-colors">
                    <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Phone className="h-4 w-4 text-accent" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Teléfono</label>
                      <p className="text-sm font-medium text-foreground">{alianza.contacto.fono}</p>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 rounded-lg bg-muted/30 text-center">
                    <p className="text-xs text-muted-foreground">Sin teléfono registrado</p>
                  </div>
                )}
                {alianza.direccion && (
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted/70 transition-colors">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <svg className="h-4 w-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Dirección</label>
                      <p className="text-sm font-medium text-foreground">{alianza.direccion}</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Vigencia del Contrato */}
            <Card className="border-l-4 border-l-accent shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
                    <CalendarIcon className="h-4 w-4 text-accent" />
                  </div>
                  Vigencia del Contrato
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3 p-3 rounded-lg bg-gradient-to-r from-primary/5 to-transparent border border-primary/20">
                  <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                    <CalendarIcon className="h-5 w-5 text-primary-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <label className="text-xs font-semibold text-primary uppercase tracking-wide block">Fecha de Inicio</label>
                    <p className="text-base font-bold text-foreground mt-0.5">
                      {new Date(alianza.fechaInicio).toLocaleDateString('es-CL', { 
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        timeZone: 'America/Santiago' 
                      })}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-gradient-to-r from-accent/5 to-transparent border border-accent/20">
                  <div className="w-10 h-10 rounded-full bg-accent flex items-center justify-center flex-shrink-0">
                    <CalendarIcon className="h-5 w-5 text-accent-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <label className="text-xs font-semibold text-accent uppercase tracking-wide block">Fecha de Término</label>
                    <p className="text-base font-bold text-foreground mt-0.5">
                      {new Date(alianza.fechaTermino).toLocaleDateString('es-CL', { 
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        timeZone: 'America/Santiago' 
                      })}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Metadatos */}
          <Card className="bg-muted/30 border-dashed">
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <svg className="h-3 w-3 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                  </div>
                  <div>
                    <span className="font-semibold text-muted-foreground">Creado:</span>
                    <span className="ml-1 text-foreground font-medium">
                      {new Date(alianza.createdAt).toLocaleString('es-CL', { 
                        dateStyle: 'medium',
                        timeStyle: 'short',
                        timeZone: 'America/Santiago' 
                      })}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded bg-accent/10 flex items-center justify-center flex-shrink-0">
                    <Pencil className="h-3 w-3 text-accent" />
                  </div>
                  <div>
                    <span className="font-semibold text-muted-foreground">Actualizado:</span>
                    <span className="ml-1 text-foreground font-medium">
                      {new Date(alianza.updatedAt).toLocaleString('es-CL', { 
                        dateStyle: 'medium',
                        timeStyle: 'short',
                        timeZone: 'America/Santiago' 
                      })}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <DialogFooter className="border-t pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="min-w-32">
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditAlianzaDialog({ 
  alianza, 
  open, 
  onOpenChange, 
  onUpdate,
  loading 
}: { 
  alianza: Alianza | null; 
  open: boolean; 
  onOpenChange: (open: boolean) => void;
  onUpdate: (input: NuevaAlianzaInput) => void;
  loading?: boolean;
}) {
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
    },
    mode: 'onSubmit',
    reValidateMode: 'onChange',
  })

  const [confirmOpen, setConfirmOpen] = useState(false)
  const [pendingData, setPendingData] = useState<NuevaAlianzaInput | null>(null)
  
  const comisionDegravamenValue = form.watch('comisionDegravamen')
  const comisionCesantiaValue = form.watch('comisionCesantia')
  const showDegravamenWarning = comisionDegravamenValue !== undefined && comisionDegravamenValue !== null && 
    (comisionDegravamenValue < 1 || comisionDegravamenValue > 10) && comisionDegravamenValue >= 0 && comisionDegravamenValue <= 100
  const showCesantiaWarning = comisionCesantiaValue !== undefined && comisionCesantiaValue !== null && 
    (comisionCesantiaValue < 1 || comisionCesantiaValue > 50) && comisionCesantiaValue >= 0 && comisionCesantiaValue <= 100

  // Prellenar formulario cuando se abre el diálogo
  useEffect(() => {
    if (alianza && open) {
      form.reset({
        nombre: alianza.nombre,
        code: alianza.code,
        rut: alianza.rut,
        contacto: {
          fono: alianza.contacto.fono || '',
          email: alianza.contacto.email || '',
        },
        direccion: alianza.direccion || '',
        descripcion: alianza.descripcion || '',
        comisionDegravamen: alianza.comisionDegravamen,
        comisionCesantia: alianza.comisionCesantia,
        activo: alianza.activo,
        fechaInicio: new Date(alianza.fechaInicio),
        fechaTermino: new Date(alianza.fechaTermino),
      })
    }
  }, [alianza, open, form])

  const handleFormSubmit = (v: NuevaAlianzaInput) => {
    setPendingData(v)
    setConfirmOpen(true)
  }

  const confirmUpdate = () => {
    if (pendingData) {
      onUpdate({ 
        ...pendingData, 
        comisionDegravamen: Number(pendingData.comisionDegravamen),
        comisionCesantia: Number(pendingData.comisionCesantia)
      })
      setConfirmOpen(false)
      setPendingData(null)
    }
  }

  if (!alianza) return null;

  return (
    <>
      <Dialog open={open && !confirmOpen} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto" aria-describedby="edit-form-desc">
          <DialogHeader className="pb-4 border-b">
            <DialogTitle className="text-2xl font-bold flex items-center gap-2">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                <Pencil className="h-5 w-5 text-primary-foreground" />
              </div>
              Editar Alianza Comercial
            </DialogTitle>
            <DialogDescription id="edit-form-desc" className="text-base">
              Modifica la información de la alianza <strong>{alianza.nombre}</strong>.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-6 py-4">
              {/* Sección 1: Información Básica */}
              <Card className="border-l-4 border-l-primary">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Building2 className="h-4 w-4 text-primary" />
                    </div>
                    Información Básica
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name="nombre"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Nombre Comercial *</FormLabel>
                          <FormControl>
                            <Input placeholder="Ej: Sindicato Financiero XYZ" {...field} className="font-medium" />
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
                          <FormLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Código Único *</FormLabel>
                          <FormControl>
                            <Input placeholder="Ej: SFX-001" {...field} className="font-mono font-medium" />
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
                          <FormLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">RUT *</FormLabel>
                          <FormControl>
                            <Input placeholder="12.345.678-9" {...field} className="font-medium" />
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
                        <FormLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Descripción</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Información relevante sobre la alianza comercial..."
                            {...field} 
                            rows={3}
                            className="resize-none"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>

              {/* Sección 2: Estructura de Comisiones */}
              <Card className="border-l-4 border-l-accent">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-accent/10 flex items-center justify-center">
                      <svg className="h-4 w-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    Comisiones por Producto
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="comisionDegravamen"
                      render={({ field: { value, onChange, ...field } }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-semibold text-primary uppercase tracking-wide">Seguro de Degravamen *</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Input 
                                type="number" 
                                step="0.01" 
                                min={0} 
                                max={100} 
                                placeholder="0.00"
                                className="pr-12 text-lg font-bold"
                                value={value || ''}
                                onChange={(e) => onChange(e.target.valueAsNumber || 0)}
                                {...field} 
                              />
                              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-lg font-bold text-primary">%</span>
                            </div>
                          </FormControl>
                          {showDegravamenWarning && (
                            <Alert variant="default" className="mt-2 border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/20">
                              <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-500" />
                              <AlertDescription className="text-xs text-amber-800 dark:text-amber-400">
                                Comisión fuera del rango típico (1-10%). Verifica que sea correcta.
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
                          <FormLabel className="text-xs font-semibold text-accent uppercase tracking-wide">Seguro de Cesantía *</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Input 
                                type="number" 
                                step="0.01" 
                                min={0} 
                                max={100} 
                                placeholder="0.00"
                                className="pr-12 text-lg font-bold"
                                value={value || ''}
                                onChange={(e) => onChange(e.target.valueAsNumber || 0)}
                                {...field} 
                              />
                              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-lg font-bold text-accent">%</span>
                            </div>
                          </FormControl>
                          {showCesantiaWarning && (
                            <Alert variant="default" className="mt-2 border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/20">
                              <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-500" />
                              <AlertDescription className="text-xs text-amber-800 dark:text-amber-400">
                                Comisión fuera del rango típico (1-50%). Verifica que sea correcta.
                              </AlertDescription>
                            </Alert>
                          )}
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Sección 3: Información de Contacto */}
                <Card className="border-l-4 border-l-primary">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Mail className="h-4 w-4 text-primary" />
                      </div>
                      Datos de Contacto
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <FormField
                      control={form.control}
                      name="contacto.email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Email</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                              <Input 
                                type="email" 
                                placeholder="contacto@alianza.cl" 
                                {...field} 
                                className="pl-10"
                              />
                            </div>
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
                          <FormLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Teléfono</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                              <Input 
                                type="tel" 
                                placeholder="+56 9 1234 5678" 
                                {...field} 
                                className="pl-10"
                              />
                            </div>
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
                          <FormLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Dirección</FormLabel>
                          <FormControl>
                            <Textarea 
                              placeholder="Av. Principal 1234, Comuna, Ciudad"
                              {...field} 
                              rows={2}
                              className="resize-none"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>

                {/* Sección 4: Vigencia del Contrato */}
                <Card className="border-l-4 border-l-accent">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-accent/10 flex items-center justify-center">
                        <CalendarIcon className="h-4 w-4 text-accent" />
                      </div>
                      Vigencia del Contrato
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <FormField
                      control={form.control}
                      name="fechaInicio"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Fecha de Inicio *</FormLabel>
                          <FormControl>
                            <div className="flex gap-2">
                              <Input
                                type="text"
                                placeholder="dd/mm/aaaa"
                                value={field.value ? format(field.value, "dd/MM/yyyy") : ''}
                                onChange={(e) => {
                                  const value = e.target.value;
                                  // Intentar parsear la fecha en formato dd/mm/yyyy
                                  const parts = value.split('/');
                                  if (parts.length === 3) {
                                    const [day, month, year] = parts;
                                    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
                                    if (!isNaN(date.getTime())) {
                                      field.onChange(date);
                                    }
                                  }
                                }}
                                className="flex-1"
                              />
                              <Popover>
                                <PopoverTrigger asChild>
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    className="shrink-0"
                                    type="button"
                                  >
                                    <CalendarIcon className="h-4 w-4" />
                                  </Button>
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
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="fechaTermino"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Fecha de Término *</FormLabel>
                          <FormControl>
                            <div className="flex gap-2">
                              <Input
                                type="text"
                                placeholder="dd/mm/aaaa"
                                value={field.value ? format(field.value, "dd/MM/yyyy") : ''}
                                onChange={(e) => {
                                  const value = e.target.value;
                                  // Intentar parsear la fecha en formato dd/mm/yyyy
                                  const parts = value.split('/');
                                  if (parts.length === 3) {
                                    const [day, month, year] = parts;
                                    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
                                    if (!isNaN(date.getTime())) {
                                      field.onChange(date);
                                    }
                                  }
                                }}
                                className="flex-1"
                              />
                              <Popover>
                                <PopoverTrigger asChild>
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    className="shrink-0"
                                    type="button"
                                  >
                                    <CalendarIcon className="h-4 w-4" />
                                  </Button>
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
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="activo"
                      render={({ field }) => (
                        <FormItem>
                          <div className="flex items-center justify-between rounded-lg border-2 border-primary/20 bg-gradient-to-r from-primary/5 to-transparent p-4">
                            <div className="space-y-0.5">
                              <FormLabel className="text-sm font-semibold">Estado de la Alianza</FormLabel>
                              <p className="text-xs text-muted-foreground">
                                {field.value ? 'La alianza está activa' : 'La alianza está inactiva'}
                              </p>
                            </div>
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
                  </CardContent>
                </Card>
              </div>

              <DialogFooter className="gap-2 sm:gap-0 pt-4 border-t">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="min-w-32">
                  Cancelar
                </Button>
                <Button type="submit" disabled={loading} className="min-w-32">
                  {loading ? 'Actualizando...' : 'Actualizar Alianza'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Diálogo de confirmación */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Actualización de Alianza</AlertDialogTitle>
            <AlertDialogDescription>
              Se actualizará la alianza con los siguientes datos:
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
                <div>
                  <span className="font-medium">Estado:</span>
                  <p className="text-muted-foreground">{pendingData.activo ? 'Activa' : 'Inactiva'}</p>
                </div>
              </div>
            </div>
          )}
          
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmOpen(false)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmUpdate} disabled={loading}>
              {loading ? 'Actualizando...' : 'Confirmar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

