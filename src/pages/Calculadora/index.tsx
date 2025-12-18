import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Calculator, TrendingDown, Shield, Info, AlertCircle, Download, MessageCircle, Mail, RotateCcw, ChevronDown } from "lucide-react";
import { jsPDF } from "jspdf";
import { cn } from "@/lib/utils";
import { formatCurrency, calcularEdad } from "@/lib/formatters";
import { calcularDevolucion, INSTITUCIONES_DISPONIBLES, CalculationResult } from "@/lib/calculadoraUtils";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

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

    // Detalle del cálculo
    y += 5;
    doc.setFontSize(12);
    doc.setTextColor(0);
    doc.text("Detalle del Calculo", 20, y);
    y += 10;

    doc.setFontSize(9);
    doc.setTextColor(60);

    if (resultado.desgravamen) {
      doc.setFontSize(10);
      doc.setTextColor(40);
      doc.text("Desgravamen - Tasas y parametros:", 20, y);
      y += 6;
      
      doc.setFontSize(9);
      doc.setTextColor(80);
      doc.text(`Tasa banco: ${(resultado.desgravamen.tasaBanco * 100).toFixed(4)}%`, 25, y); y += 5;
      doc.text(`Tasa preferencial: ${(resultado.desgravamen.tasaPreferencial * 100).toFixed(4)}%`, 25, y); y += 5;
      
      if (resultado.desgravamen.cuotasUtilizadas) {
        doc.text(`Cuotas utilizadas para tasa: ${resultado.desgravamen.cuotasUtilizadas}`, 25, y); y += 5;
      }
      if (resultado.desgravamen.montoRedondeado) {
        doc.text(`Monto redondeado: ${formatCurrency(resultado.desgravamen.montoRedondeado)}`, 25, y); y += 5;
      }
      
      y += 3;
      doc.setFontSize(8);
      doc.setTextColor(100);
      doc.text("Formula: Prima unica = Monto x Tasa", 25, y); y += 4;
      doc.text("Seguro total = (Prima unica / Cuotas utilizadas) x Cuotas totales", 25, y); y += 4;
      doc.text("Seguro restante = Prima mensual x Cuotas pendientes", 25, y); y += 4;
      doc.text("Devolucion = Seguro restante banco - Seguro restante preferencial", 25, y);
      y += 10;
    }

    if (resultado.cesantia) {
      doc.setFontSize(10);
      doc.setTextColor(40);
      doc.text("Cesantia - Tasas y parametros:", 20, y);
      y += 6;
      
      doc.setFontSize(9);
      doc.setTextColor(80);
      doc.text(`Tramo: ${resultado.cesantia.tramoUsado}`, 25, y); y += 5;
      doc.text(`Tasa banco: ${(resultado.cesantia.tasaBanco * 100).toFixed(4)}%`, 25, y); y += 5;
      doc.text(`Tasa preferencial: ${(resultado.cesantia.tasaPreferencial * 100).toFixed(4)}%`, 25, y); y += 5;
      
      y += 3;
      doc.setFontSize(8);
      doc.setTextColor(100);
      doc.text("Formula: Prima restante = Monto x Tasa mensual x Cuotas pendientes", 25, y); y += 4;
      doc.text("Devolucion = Prima banco - Prima preferencial", 25, y);
      y += 10;
    }

    // Margen aplicado
    doc.setFontSize(10);
    doc.setTextColor(40);
    doc.text("Margen de seguridad:", 20, y);
    y += 6;
    
    doc.setFontSize(9);
    doc.setTextColor(80);
    doc.text(`Margen aplicado: 15%`, 25, y); y += 5;
    doc.text(`Tramo etario: ${resultado.tramoUsado}`, 25, y); y += 5;
    
    doc.setFontSize(8);
    doc.setTextColor(100);
    doc.text("El monto final incluye un margen de seguridad del 15% sobre la devolucion calculada.", 25, y);
    y += 15;

    // Disclaimer
    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.text("IMPORTANTE: Este calculo es solo informativo y esta sujeto a verificacion.", 20, y);
    y += 5;
    doc.text("Los montos finales pueden variar segun las condiciones especificas de tu credito.", 20, y);

    // Guardar
    doc.save(`calculo-ahorro-seguros-${format(new Date(), "yyyy-MM-dd")}.pdf`);
  };

  const generarTextoCompartir = () => {
    if (!resultado || resultado.error || !formDataSnapshot) return "";
    
    const edad = calcularEdad(formDataSnapshot.fechaNacimiento);
    const tipoSeguroLabel = formDataSnapshot.tipoSeguro === "desgravamen" 
      ? "Desgravamen" 
      : formDataSnapshot.tipoSeguro === "cesantia" 
        ? "Cesantia" 
        : "Ambos seguros";

    let texto = `*Calculadora de Ahorro en Seguros*\n\n`;
    texto += `*Datos del credito:*\n`;
    texto += `- Institucion: ${formDataSnapshot.institucion}\n`;
    texto += `- Edad: ${edad} anos\n`;
    texto += `- Monto: ${formatCurrency(formDataSnapshot.montoCredito)}\n`;
    texto += `- Cuotas: ${formDataSnapshot.cuotasPendientes}/${formDataSnapshot.cuotasTotales}\n`;
    texto += `- Tipo: ${tipoSeguroLabel}\n\n`;
    texto += `*AHORRO ESTIMADO: ${formatCurrency(resultado.montoDevolucion)}*\n\n`;
    
    if (resultado.desgravamen) {
      texto += `Desgravamen: ${formatCurrency(resultado.desgravamen.montoDevolucion)}\n`;
    }
    if (resultado.cesantia) {
      texto += `Cesantia: ${formatCurrency(resultado.cesantia.montoDevolucion)}\n`;
    }
    if (resultado.ahorroMensual > 0) {
      texto += `Ahorro mensual: ${formatCurrency(resultado.ahorroMensual)}/mes\n`;
    }
    
    texto += `\n_Calculo estimado, sujeto a verificacion._`;
    
    return texto;
  };

  const compartirWhatsApp = () => {
    const texto = generarTextoCompartir();
    if (!texto) return;
    
    const url = `https://wa.me/?text=${encodeURIComponent(texto)}`;
    window.open(url, "_blank");
  };

  const compartirEmail = () => {
    if (!resultado || resultado.error || !formDataSnapshot) return;
    
    const asunto = `Calculo de Ahorro en Seguros - ${formatCurrency(resultado.montoDevolucion)}`;
    const cuerpo = generarTextoCompartir().replace(/\*/g, "").replace(/_/g, "");
    
    const url = `mailto:?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(cuerpo)}`;
    window.location.href = url;
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

                {/* Fecha de nacimiento - Selectores simples */}
                <FormField
                  control={form.control}
                  name="fechaNacimiento"
                  render={({ field }) => {
                    const currentYear = new Date().getFullYear();
                    const minYear = currentYear - 65;
                    const maxYear = currentYear - 18;
                    
                    const years = Array.from({ length: maxYear - minYear + 1 }, (_, i) => maxYear - i);
                    const months = [
                      { value: 0, label: "Enero" },
                      { value: 1, label: "Febrero" },
                      { value: 2, label: "Marzo" },
                      { value: 3, label: "Abril" },
                      { value: 4, label: "Mayo" },
                      { value: 5, label: "Junio" },
                      { value: 6, label: "Julio" },
                      { value: 7, label: "Agosto" },
                      { value: 8, label: "Septiembre" },
                      { value: 9, label: "Octubre" },
                      { value: 10, label: "Noviembre" },
                      { value: 11, label: "Diciembre" },
                    ];
                    
                    const selectedDate = field.value ? new Date(field.value) : null;
                    const selectedDay = selectedDate?.getDate();
                    const selectedMonth = selectedDate?.getMonth();
                    const selectedYear = selectedDate?.getFullYear();
                    
                    const daysInMonth = selectedMonth !== undefined && selectedYear 
                      ? new Date(selectedYear, selectedMonth + 1, 0).getDate()
                      : 31;
                    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
                    
                    const handleDayChange = (val: string) => {
                      const day = Number(val);
                      const month = selectedMonth ?? 0;
                      const year = selectedYear ?? maxYear;
                      field.onChange(new Date(year, month, day));
                    };
                    
                    const handleMonthChange = (val: string) => {
                      const month = Number(val);
                      const day = selectedDay ?? 1;
                      const year = selectedYear ?? maxYear;
                      // Ajustar día si excede los días del nuevo mes
                      const maxDays = new Date(year, month + 1, 0).getDate();
                      const adjustedDay = Math.min(day, maxDays);
                      field.onChange(new Date(year, month, adjustedDay));
                    };
                    
                    const handleYearChange = (val: string) => {
                      const year = Number(val);
                      const month = selectedMonth ?? 0;
                      const day = selectedDay ?? 1;
                      // Ajustar día si excede los días del mes (ej. 29 feb en año no bisiesto)
                      const maxDays = new Date(year, month + 1, 0).getDate();
                      const adjustedDay = Math.min(day, maxDays);
                      field.onChange(new Date(year, month, adjustedDay));
                    };
                    
                    return (
                      <FormItem>
                        <FormLabel>Fecha de nacimiento</FormLabel>
                        <div className="grid grid-cols-3 gap-2">
                          <Select
                            value={selectedDay?.toString() ?? ""}
                            onValueChange={handleDayChange}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Día" />
                            </SelectTrigger>
                            <SelectContent>
                              {days.map((day) => (
                                <SelectItem key={day} value={day.toString()}>
                                  {day}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          
                          <Select
                            value={selectedMonth?.toString() ?? ""}
                            onValueChange={handleMonthChange}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Mes" />
                            </SelectTrigger>
                            <SelectContent>
                              {months.map((month) => (
                                <SelectItem key={month.value} value={month.value.toString()}>
                                  {month.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          
                          <Select
                            value={selectedYear?.toString() ?? ""}
                            onValueChange={handleYearChange}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Año" />
                            </SelectTrigger>
                            <SelectContent>
                              {years.map((year) => (
                                <SelectItem key={year} value={year.toString()}>
                                  {year}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <FormDescription>
                          Edad entre 18 y 65 años
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    );
                  }}
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

                <div className="flex gap-2">
                  <Button type="submit" className="flex-1" size="lg" disabled={isCalculating}>
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
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="lg"
                    onClick={() => {
                      form.reset();
                      setResultado(null);
                      setFormDataSnapshot(null);
                    }}
                  >
                    <RotateCcw className="w-4 h-4" />
                  </Button>
                </div>
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

                {/* Detalle del cálculo */}
                <Collapsible>
                  <Card className="shadow-md">
                    <CollapsibleTrigger className="w-full">
                      <CardHeader className="pb-3 cursor-pointer hover:bg-muted/50 transition-colors">
                        <CardTitle className="text-base flex items-center justify-between">
                          <span className="flex items-center gap-2">
                            <Info className="w-4 h-4 text-muted-foreground" />
                            Detalle del cálculo
                          </span>
                          <ChevronDown className="w-4 h-4 text-muted-foreground transition-transform" />
                        </CardTitle>
                      </CardHeader>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <CardContent className="pt-0 space-y-4 text-sm">
                        {resultado.desgravamen && (
                          <div className="space-y-2">
                            <h4 className="font-medium text-muted-foreground border-b pb-1">Seguro de Desgravamen</h4>
                            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                              <span className="text-muted-foreground">Tasa banco:</span>
                              <span className="font-mono">{(resultado.desgravamen.tasaBanco * 100).toFixed(4)}%</span>
                              
                              <span className="text-muted-foreground">Tasa preferencial:</span>
                              <span className="font-mono">{(resultado.desgravamen.tasaPreferencial * 100).toFixed(4)}%</span>
                              
                              {resultado.desgravamen.cuotasUtilizadas && (
                                <>
                                  <span className="text-muted-foreground">Cuotas utilizadas:</span>
                                  <span className="font-mono">{resultado.desgravamen.cuotasUtilizadas}</span>
                                </>
                              )}
                              
                              {resultado.desgravamen.montoRedondeado && (
                                <>
                                  <span className="text-muted-foreground">Monto redondeado:</span>
                                  <span className="font-mono">{formatCurrency(resultado.desgravamen.montoRedondeado)}</span>
                                </>
                              )}
                            </div>
                            <div className="bg-muted/50 p-2 rounded text-xs space-y-1">
                              <p><strong>Fórmula:</strong></p>
                              <p className="text-muted-foreground">Prima única = Monto × Tasa</p>
                              <p className="text-muted-foreground">Seguro total = (Prima única / Cuotas utilizadas) × Cuotas totales</p>
                              <p className="text-muted-foreground">Prima mensual = Seguro total / Cuotas totales</p>
                              <p className="text-muted-foreground">Seguro restante = Prima mensual × Cuotas pendientes</p>
                              <p className="text-muted-foreground">Devolución = Seguro restante banco - Seguro restante preferencial</p>
                            </div>
                          </div>
                        )}
                        
                        {resultado.cesantia && (
                          <div className="space-y-2">
                            <h4 className="font-medium text-muted-foreground border-b pb-1">Seguro de Cesantía</h4>
                            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                              <span className="text-muted-foreground">Tramo:</span>
                              <span className="font-mono">{resultado.cesantia.tramoUsado}</span>
                              
                              <span className="text-muted-foreground">Tasa banco:</span>
                              <span className="font-mono">{(resultado.cesantia.tasaBanco * 100).toFixed(4)}%</span>
                              
                              <span className="text-muted-foreground">Tasa preferencial:</span>
                              <span className="font-mono">{(resultado.cesantia.tasaPreferencial * 100).toFixed(4)}%</span>
                            </div>
                            <div className="bg-muted/50 p-2 rounded text-xs space-y-1">
                              <p><strong>Fórmula:</strong></p>
                              <p className="text-muted-foreground">Prima restante = Monto × Tasa mensual × Cuotas pendientes</p>
                              <p className="text-muted-foreground">Devolución = Prima banco - Prima preferencial</p>
                            </div>
                          </div>
                        )}
                        
                        <div className="space-y-2">
                          <h4 className="font-medium text-muted-foreground border-b pb-1">Margen aplicado</h4>
                          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                            <span className="text-muted-foreground">Margen de seguridad:</span>
                            <span className="font-mono">15%</span>
                            
                            <span className="text-muted-foreground">Tramo etario:</span>
                            <span className="font-mono">{resultado.tramoUsado}</span>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            El monto final se calcula aplicando un margen de seguridad del 15% sobre la devolución calculada.
                          </p>
                        </div>
                      </CardContent>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>
                <div className="flex flex-col gap-2">
                  <Button 
                    onClick={exportarPDF} 
                    variant="outline" 
                    className="w-full"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Descargar PDF
                  </Button>
                  
                  <div className="grid grid-cols-2 gap-2">
                    <Button 
                      onClick={compartirWhatsApp} 
                      variant="outline" 
                      className="w-full text-green-600 border-green-200 hover:bg-green-50 hover:text-green-700"
                    >
                      <MessageCircle className="w-4 h-4 mr-2" />
                      WhatsApp
                    </Button>
                    
                    <Button 
                      onClick={compartirEmail} 
                      variant="outline" 
                      className="w-full"
                    >
                      <Mail className="w-4 h-4 mr-2" />
                      Email
                    </Button>
                  </div>
                </div>

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
