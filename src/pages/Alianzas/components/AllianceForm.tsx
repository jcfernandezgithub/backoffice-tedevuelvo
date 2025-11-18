import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { alianzaSchema, type NuevaAlianzaInput } from '@/schemas/alianzaSchema'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { Plus, Building2, DollarSign, Mail, CalendarIcon, AlertTriangle, Info } from 'lucide-react'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'

interface AllianceFormProps {
  onCreate: (data: NuevaAlianzaInput) => void
  loading?: boolean
}

export function CreateAllianceButton({ onCreate, loading }: AllianceFormProps) {
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
        <DialogContent className="max-w-[98vw] lg:max-w-[90vw] max-h-[92vh] overflow-hidden flex flex-col p-0" aria-describedby="form-desc">
          <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                <Plus className="h-4 w-4 text-primary-foreground" />
              </div>
              Nueva Alianza Comercial
            </DialogTitle>
            <DialogDescription id="form-desc" className="text-sm">
              Completa la información para registrar una nueva alianza en el sistema.
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleFormSubmit)} className="flex flex-col h-full">
              <div className="flex-1 overflow-y-auto px-6 py-4">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Columna Izquierda */}
                  <div className="space-y-4">
                    {/* Información Básica */}
                    <Card className="border-l-4 border-l-primary h-[280px] flex flex-col">
                    <CardHeader className="pb-2 px-4 pt-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <div className="w-6 h-6 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Building2 className="h-3.5 w-3.5 text-primary" />
                        </div>
                        Información Básica
                      </CardTitle>
                    </CardHeader>
                      <CardContent className="space-y-3 px-4 pb-4 flex-1 overflow-y-auto">
                      <div className="grid grid-cols-2 gap-3">
                        <FormField
                          control={form.control}
                          name="nombre"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs">Nombre Comercial *</FormLabel>
                              <FormControl>
                                <Input placeholder="Ej: Sindicato Financiero XYZ" {...field} />
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
                              <FormLabel className="text-xs">Código Único *</FormLabel>
                              <FormControl>
                                <Input placeholder="Ej: SFX-001" {...field} className="font-mono" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      <FormField
                        control={form.control}
                        name="rut"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">RUT *</FormLabel>
                            <FormControl>
                              <Input placeholder="12.345.678-9" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="descripcion"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Descripción</FormLabel>
                            <FormControl>
                              <Textarea placeholder="Información relevante sobre la alianza comercial..." {...field} className="resize-none h-20" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </CardContent>
                  </Card>

                  {/* Comisiones */}
                  <Card className="border-l-4 border-l-accent h-[280px] flex flex-col">
                    <CardHeader className="pb-2 px-4 pt-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <div className="w-6 h-6 rounded-lg bg-accent/10 flex items-center justify-center">
                          <DollarSign className="h-3.5 w-3.5 text-accent" />
                        </div>
                        Comisiones por Producto
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 px-4 pb-4 flex-1 overflow-y-auto">
                      <FormField
                        control={form.control}
                        name="comisionDegravamen"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Seguro de Degravamen *</FormLabel>
                            <div className="relative">
                              <FormControl>
                                <Input
                                  type="number"
                                  step="0.01"
                                  placeholder="0.00"
                                  {...field}
                                  onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                                  className="pr-8"
                                />
                              </FormControl>
                              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>
                            </div>
                            {showDegravamenWarning && (
                              <div className="flex items-start gap-2 mt-2 p-2 rounded-md bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
                                <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-500 mt-0.5 shrink-0" />
                                <p className="text-xs text-amber-800 dark:text-amber-300">
                                  Comisión fuera del rango típico (1-10%). Verifica que sea correcta.
                                </p>
                              </div>
                            )}
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="comisionCesantia"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Seguro de Cesantía *</FormLabel>
                            <div className="relative">
                              <FormControl>
                                <Input
                                  type="number"
                                  step="0.01"
                                  placeholder="0.00"
                                  {...field}
                                  onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                                  className="pr-8"
                                />
                              </FormControl>
                              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>
                            </div>
                            {showCesantiaWarning && (
                              <div className="flex items-start gap-2 mt-2 p-2 rounded-md bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
                                <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-500 mt-0.5 shrink-0" />
                                <p className="text-xs text-amber-800 dark:text-amber-300">
                                  Comisión fuera del rango típico (1-50%). Verifica que sea correcta.
                                </p>
                              </div>
                            )}
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </CardContent>
                  </Card>
                </div>

                {/* Columna Derecha */}
                <div className="space-y-4">
                  {/* Datos de Contacto */}
                  <Card className="border-l-4 border-l-blue-500 h-[280px] flex flex-col">
                    <CardHeader className="pb-2 px-4 pt-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <div className="w-6 h-6 rounded-lg bg-blue-500/10 flex items-center justify-center">
                          <Mail className="h-3.5 w-3.5 text-blue-500" />
                        </div>
                        Datos de Contacto
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 px-4 pb-4 flex-1 overflow-y-auto">
                      <FormField
                        control={form.control}
                        name="contacto.email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Email</FormLabel>
                            <FormControl>
                              <Input type="email" placeholder="contacto@alianza.cl" {...field} />
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
                            <FormLabel className="text-xs">Teléfono</FormLabel>
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
                            <FormLabel className="text-xs">Dirección</FormLabel>
                            <FormControl>
                              <Textarea placeholder="Dirección física de la alianza..." {...field} className="resize-none h-20" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </CardContent>
                  </Card>

                  {/* Vigencia del Contrato */}
                  <Card className="border-l-4 border-l-purple-500 h-[280px] flex flex-col">
                    <CardHeader className="pb-2 px-4 pt-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <div className="w-6 h-6 rounded-lg bg-purple-500/10 flex items-center justify-center">
                          <CalendarIcon className="h-3.5 w-3.5 text-purple-500" />
                        </div>
                        Vigencia del Contrato
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 px-4 pb-4 flex-1 overflow-y-auto">
                      <FormField
                        control={form.control}
                        name="fechaInicio"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Fecha de Inicio *</FormLabel>
                            <FormControl>
                              <div className="flex gap-2">
                                <Input
                                  type="text"
                                  placeholder="dd/mm/aaaa"
                                  value={field.value ? format(field.value, "dd/MM/yyyy") : ''}
                                  onChange={(e) => {
                                    const value = e.target.value
                                    const parts = value.split('/')
                                    if (parts.length === 3) {
                                      const [day, month, year] = parts
                                      const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
                                      if (!isNaN(date.getTime())) {
                                        field.onChange(date)
                                      }
                                    }
                                  }}
                                  className="flex-1"
                                />
                                <Popover>
                                  <PopoverTrigger asChild>
                                    <Button variant="outline" size="icon" className="shrink-0" type="button">
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
                            <FormLabel className="text-xs">Fecha de Término *</FormLabel>
                            <FormControl>
                              <div className="flex gap-2">
                                <Input
                                  type="text"
                                  placeholder="dd/mm/aaaa"
                                  value={field.value ? format(field.value, "dd/MM/yyyy") : ''}
                                  onChange={(e) => {
                                    const value = e.target.value
                                    const parts = value.split('/')
                                    if (parts.length === 3) {
                                      const [day, month, year] = parts
                                      const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
                                      if (!isNaN(date.getTime())) {
                                        field.onChange(date)
                                      }
                                    }
                                  }}
                                  className="flex-1"
                                />
                                <Popover>
                                  <PopoverTrigger asChild>
                                    <Button variant="outline" size="icon" className="shrink-0" type="button">
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
                      <div className="flex items-start gap-2 p-2 rounded-md bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
                        <Info className="h-4 w-4 text-blue-600 dark:text-blue-500 mt-0.5 shrink-0" />
                        <p className="text-xs text-blue-800 dark:text-blue-300">
                          El sistema validará las fechas de inicio y término del contrato.
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                  </div>
                </div>
              </div>

              <div className="border-t bg-background px-6 py-4 flex justify-end gap-3 shrink-0">
                <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={loading}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={loading} className="min-w-[140px]">
                  {loading ? 'Creando...' : 'Crear Alianza'}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Creación de Alianza</AlertDialogTitle>
            <AlertDialogDescription>
              Por favor, revisa los datos antes de crear la alianza:
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2 text-sm">
            <p><strong>Nombre:</strong> {pendingData?.nombre}</p>
            <p><strong>Código:</strong> {pendingData?.code}</p>
            <p><strong>RUT:</strong> {pendingData?.rut}</p>
            <p><strong>Comisión Degravamen:</strong> {pendingData?.comisionDegravamen}%</p>
            <p><strong>Comisión Cesantía:</strong> {pendingData?.comisionCesantia}%</p>
            <p><strong>Vigencia:</strong> {pendingData?.fechaInicio ? format(pendingData.fechaInicio, 'dd/MM/yyyy') : ''} - {pendingData?.fechaTermino ? format(pendingData.fechaTermino, 'dd/MM/yyyy') : ''}</p>
          </div>
          <AlertDialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>Cancelar</Button>
            <Button onClick={confirmCreate} disabled={loading}>Confirmar</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
