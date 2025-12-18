import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarIcon, Calculator, TrendingDown, Shield, Info, AlertCircle, Download } from "lucide-react";
import { jsPDF } from "jspdf";
import { cn } from "@/lib/utils";
import { formatCurrency, calcularEdad } from "@/lib/formatters";
import { calcularDevolucion, INSTITUCIONES_DISPONIBLES, CalculationResult } from "@/lib/calculadoraUtils";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";

const formSchema = z.object({
  institucion: z.string().min(1, "Selecciona una institución"),
  fechaNacimiento: z.date({
    required_error: "Ingresa tu fecha de nacimiento",
  }).refine((date) => {
    const edad = calcularEdad(date);
    return edad >= 18 && edad <= 65;
  }, "La edad debe estar entre 18 y 65 años"),
  montoCredito: z.number({
    required_error: "Ingresa el monto del crédito",
  }).min(500000, "El monto mínimo es $500.000").max(60000000, "El monto máximo es $60.000.000"),
  cuotasTotales: z.number({
    required_error: "Ingresa las cuotas totales",
  }).min(6, "Mínimo 6 cuotas").max(72, "Máximo 72 cuotas"),
  cuotasPendientes: z.number({
    required_error: "Ingresa las cuotas pendientes",
  }).min(1, "Mínimo 1 cuota pendiente"),
  tipoSeguro: z.enum(["desgravamen", "cesantia", "ambos"], {
    required_error: "Selecciona el tipo de seguro",
  }),
});

type FormData = z.infer<typeof formSchema>;

export default function CalculadoraPage() {
  const [resultado, setResultado] = useState<CalculationResult | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [formDataSnapshot, setFormDataSnapshot] = useState<FormData | null>(null);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      tipoSeguro: "desgravamen",
    },
  });

  const cuotasTotales = form.watch("cuotasTotales");

  const onSubmit = (data: FormData) => {
    setIsCalculating(true);
    
    // Validar cuotas pendientes
    if (data.cuotasPendientes > data.cuotasTotales) {
      form.setError("cuotasPendientes", {
        message: "Las cuotas pendientes no pueden ser mayores a las totales",
      });
      setIsCalculating(false);
      return;
    }

    const edad = calcularEdad(data.fechaNacimiento);
    
    const result = calcularDevolucion(
      data.institucion,
      edad,
      data.montoCredito,
      data.cuotasTotales,
      data.cuotasPendientes,
      data.tipoSeguro
    );

    setTimeout(() => {
      setResultado(result);
      setFormDataSnapshot(data);
      setIsCalculating(false);
    }, 500);
  };

  const exportarPDF = () => {
    if (!resultado || resultado.error || !formDataSnapshot) return;

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    let y = 20;

    // Header
    doc.setFontSize(20);
    doc.setTextColor(41, 98, 255);
    doc.text("Calculadora de Ahorro en Seguros", pageWidth / 2, y, { align: "center" });
    y += 10;

    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Generado el ${format(new Date(), "PPP", { locale: es })}`, pageWidth / 2, y, { align: "center" });
    y += 15;

    // Datos del crédito
    doc.setFontSize(14);
    doc.setTextColor(0);
    doc.text("Datos del Credito", 20, y);
    y += 8;

    doc.setFontSize(10);
    doc.setTextColor(60);
    const edad = calcularEdad(formDataSnapshot.fechaNacimiento);
    
    doc.text(`Institucion: ${formDataSnapshot.institucion}`, 20, y); y += 6;
    doc.text(`Edad: ${edad} anos`, 20, y); y += 6;
    doc.text(`Monto del credito: ${formatCurrency(formDataSnapshot.montoCredito)}`, 20, y); y += 6;
    doc.text(`Cuotas totales: ${formDataSnapshot.cuotasTotales}`, 20, y); y += 6;
    doc.text(`Cuotas pendientes: ${formDataSnapshot.cuotasPendientes}`, 20, y); y += 6;
    
    const tipoSeguroLabel = formDataSnapshot.tipoSeguro === "desgravamen" 
      ? "Desgravamen" 
      : formDataSnapshot.tipoSeguro === "cesantia" 
        ? "Cesantia" 
        : "Ambos seguros";
    doc.text(`Tipo de seguro: ${tipoSeguroLabel}`, 20, y);
    y += 15;

    // Resultado destacado
    doc.setFillColor(240, 247, 255);
    doc.roundedRect(20, y, pageWidth - 40, 25, 3, 3, "F");
    y += 10;
    
    doc.setFontSize(12);
    doc.setTextColor(100);
    doc.text("Ahorro Estimado", pageWidth / 2, y, { align: "center" });
    y += 8;
    
    doc.setFontSize(18);
    doc.setTextColor(41, 98, 255);
    doc.text(formatCurrency(resultado.montoDevolucion), pageWidth / 2, y, { align: "center" });
    y += 20;

    // Detalles por tipo de seguro
    if (resultado.desgravamen) {
      doc.setFontSize(12);
      doc.setTextColor(0);
      doc.text("Seguro de Desgravamen", 20, y);
      y += 8;

      doc.setFontSize(10);
      doc.setTextColor(60);
      doc.text(`Prima banco: ${formatCurrency(resultado.desgravamen.primaBanco)}`, 25, y); y += 6;
      doc.text(`Prima preferencial: ${formatCurrency(resultado.desgravamen.primaPreferencial)}`, 25, y); y += 6;
      doc.text(`Devolucion: ${formatCurrency(resultado.desgravamen.montoDevolucion)}`, 25, y);
      y += 12;
    }

    if (resultado.cesantia) {
      doc.setFontSize(12);
      doc.setTextColor(0);
      doc.text("Seguro de Cesantia", 20, y);
      y += 8;

      doc.setFontSize(10);
      doc.setTextColor(60);
      doc.text(`Prima banco: ${formatCurrency(resultado.cesantia.primaBanco)}`, 25, y); y += 6;
      doc.text(`Prima preferencial: ${formatCurrency(resultado.cesantia.primaPreferencial)}`, 25, y); y += 6;
      doc.text(`Devolucion: ${formatCurrency(resultado.cesantia.montoDevolucion)}`, 25, y);
      y += 12;
    }

    if (resultado.ahorroMensual > 0) {
      y += 5;
      doc.setFontSize(11);
      doc.setTextColor(34, 139, 34);
      doc.text(`Ahorro mensual estimado: ${formatCurrency(resultado.ahorroMensual)}/mes`, 20, y);
      y += 15;
    }

    // Disclaimer
    y += 5;
    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.text("IMPORTANTE: Este calculo es solo informativo y esta sujeto a verificacion.", 20, y);
    y += 5;
    doc.text("Los montos finales pueden variar segun las condiciones especificas de tu credito.", 20, y);

    // Guardar
    doc.save(`calculo-ahorro-seguros-${format(new Date(), "yyyy-MM-dd")}.pdf`);
  };

  const formatInputCurrency = (value: string) => {
    const number = parseInt(value.replace(/\D/g, ""), 10);
    if (isNaN(number)) return "";
    return number.toLocaleString("es-CL");
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <div className="mb-8 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
          <Calculator className="w-8 h-8 text-primary" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight mb-2">Calculadora de Ahorro en Seguros</h1>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          Estima cuánto podrías ahorrar en tus seguros de desgravamen y cesantía asociados a créditos de consumo.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Formulario */}
        <Card className="shadow-lg border-border/50">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Shield className="w-5 h-5 text-primary" />
              Datos de tu crédito
            </CardTitle>
            <CardDescription>
              Completa la información para calcular tu ahorro estimado
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                {/* Institución */}
                <FormField
                  control={form.control}
                  name="institucion"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Institución financiera</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecciona tu banco o cooperativa" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {INSTITUCIONES_DISPONIBLES.map((inst) => (
                            <SelectItem key={inst} value={inst}>
                              {inst}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Fecha de nacimiento */}
                <FormField
                  control={form.control}
                  name="fechaNacimiento"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Fecha de nacimiento</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              className={cn(
                                "w-full pl-3 text-left font-normal",
                                !field.value && "text-muted-foreground"
                              )}
                            >
                              {field.value ? (
                                format(field.value, "PPP", { locale: es })
                              ) : (
                                <span>Selecciona tu fecha de nacimiento</span>
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
                            disabled={(date) =>
                              date > new Date() || date < new Date("1959-01-01")
                            }
                            defaultMonth={new Date(1985, 0)}
                            captionLayout="dropdown-buttons"
                            fromYear={1959}
                            toYear={2006}
                            initialFocus
                            className={cn("p-3 pointer-events-auto")}
                          />
                        </PopoverContent>
                      </Popover>
                      <FormDescription>
                        Edad entre 18 y 65 años
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Monto del crédito */}
                <FormField
                  control={form.control}
                  name="montoCredito"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Monto del crédito</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                          <Input
                            placeholder="10.000.000"
                            className="pl-7"
                            value={field.value ? formatInputCurrency(field.value.toString()) : ""}
                            onChange={(e) => {
                              const value = parseInt(e.target.value.replace(/\D/g, ""), 10);
                              field.onChange(isNaN(value) ? undefined : value);
                            }}
                          />
                        </div>
                      </FormControl>
                      <FormDescription>
                        Entre $500.000 y $60.000.000
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Cuotas totales y pendientes */}
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="cuotasTotales"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cuotas totales</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="36"
                            min={6}
                            max={72}
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value, 10) || undefined)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="cuotasPendientes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cuotas pendientes</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="24"
                            min={1}
                            max={cuotasTotales || 72}
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value, 10) || undefined)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Tipo de seguro */}
                <FormField
                  control={form.control}
                  name="tipoSeguro"
                  render={({ field }) => (
                    <FormItem className="space-y-3">
                      <FormLabel>Tipo de seguro a calcular</FormLabel>
                      <FormControl>
                        <RadioGroup
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                          className="flex flex-col space-y-1"
                        >
                          <FormItem className="flex items-center space-x-3 space-y-0">
                            <FormControl>
                              <RadioGroupItem value="desgravamen" />
                            </FormControl>
                            <FormLabel className="font-normal cursor-pointer">
                              Desgravamen
                            </FormLabel>
                          </FormItem>
                          <FormItem className="flex items-center space-x-3 space-y-0">
                            <FormControl>
                              <RadioGroupItem value="cesantia" />
                            </FormControl>
                            <FormLabel className="font-normal cursor-pointer">
                              Cesantía
                            </FormLabel>
                          </FormItem>
                          <FormItem className="flex items-center space-x-3 space-y-0">
                            <FormControl>
                              <RadioGroupItem value="ambos" />
                            </FormControl>
                            <FormLabel className="font-normal cursor-pointer">
                              Ambos seguros
                            </FormLabel>
                          </FormItem>
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button type="submit" className="w-full" size="lg" disabled={isCalculating}>
                  {isCalculating ? (
                    <>
                      <span className="animate-spin mr-2">⏳</span>
                      Calculando...
                    </>
                  ) : (
                    <>
                      <Calculator className="w-4 h-4 mr-2" />
                      Calcular ahorro
                    </>
                  )}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        {/* Resultados */}
        <div className="space-y-4">
          {resultado ? (
            resultado.error ? (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error en el cálculo</AlertTitle>
                <AlertDescription>{resultado.error}</AlertDescription>
              </Alert>
            ) : (
              <>
                {/* Monto de devolución destacado */}
                <Card className="bg-gradient-to-br from-primary/10 via-primary/5 to-background border-primary/20 shadow-lg">
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <p className="text-sm font-medium text-muted-foreground mb-1">
                        Ahorro estimado
                      </p>
                      <p className="text-4xl font-bold text-primary tracking-tight">
                        {formatCurrency(resultado.montoDevolucion)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-2 flex items-center justify-center gap-1">
                        <Info className="w-3 h-3" />
                        Monto aproximado que podrías recuperar
                      </p>
                    </div>
                  </CardContent>
                </Card>

                {/* Comparativa */}
                <Card className="shadow-md">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <TrendingDown className="w-4 h-4 text-green-600" />
                      Comparativa de primas
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {resultado.desgravamen && (
                      <div className="space-y-2">
                        <h4 className="text-sm font-medium text-muted-foreground">Desgravamen</h4>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                            <p className="text-xs text-muted-foreground">Prima banco</p>
                            <p className="text-lg font-semibold text-destructive">
                              {formatCurrency(resultado.desgravamen.primaBanco)}
                            </p>
                          </div>
                          <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                            <p className="text-xs text-muted-foreground">Prima preferencial</p>
                            <p className="text-lg font-semibold text-green-600">
                              {formatCurrency(resultado.desgravamen.primaPreferencial)}
                            </p>
                          </div>
                        </div>
                        <p className="text-sm text-center text-muted-foreground">
                          Devolución: <span className="font-medium text-primary">{formatCurrency(resultado.desgravamen.montoDevolucion)}</span>
                        </p>
                      </div>
                    )}

                    {resultado.cesantia && (
                      <>
                        {resultado.desgravamen && <Separator />}
                        <div className="space-y-2">
                          <h4 className="text-sm font-medium text-muted-foreground">Cesantía</h4>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                              <p className="text-xs text-muted-foreground">Prima banco</p>
                              <p className="text-lg font-semibold text-destructive">
                                {formatCurrency(resultado.cesantia.primaBanco)}
                              </p>
                            </div>
                            <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                              <p className="text-xs text-muted-foreground">Prima preferencial</p>
                              <p className="text-lg font-semibold text-green-600">
                                {formatCurrency(resultado.cesantia.primaPreferencial)}
                              </p>
                            </div>
                          </div>
                          <p className="text-sm text-center text-muted-foreground">
                            Devolución: <span className="font-medium text-primary">{formatCurrency(resultado.cesantia.montoDevolucion)}</span>
                          </p>
                        </div>
                      </>
                    )}

                    {resultado.ahorroMensual > 0 && (
                      <>
                        <Separator />
                        <div className="text-center py-2">
                          <p className="text-sm text-muted-foreground">Ahorro mensual estimado</p>
                          <p className="text-xl font-bold text-green-600">
                            {formatCurrency(resultado.ahorroMensual)}/mes
                          </p>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>

                {/* Botón exportar PDF */}
                <Button 
                  onClick={exportarPDF} 
                  variant="outline" 
                  className="w-full"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Descargar PDF
                </Button>

                {/* Disclaimer */}
                <Alert className="bg-muted/50">
                  <Info className="h-4 w-4" />
                  <AlertTitle className="text-sm">Cálculo estimado</AlertTitle>
                  <AlertDescription className="text-xs">
                    Este cálculo es solo informativo y está sujeto a verificación. 
                    Los montos finales pueden variar según las condiciones específicas de tu crédito.
                  </AlertDescription>
                </Alert>
              </>
            )
          ) : (
            <Card className="shadow-md border-dashed">
              <CardContent className="py-12">
                <div className="text-center text-muted-foreground">
                  <Calculator className="w-12 h-12 mx-auto mb-4 opacity-30" />
                  <p className="text-sm">
                    Completa el formulario para ver tu ahorro estimado
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
