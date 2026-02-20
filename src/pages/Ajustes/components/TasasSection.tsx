import { useMemo, useCallback } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  ShieldCheck,
  Briefcase,
  TrendingDown,
  Download,
  Info,
  Lock,
  Building2,
  Sparkles,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import tasasCesantiaBanco from '@/data/tasas_cesantia_banco.json';
import tasasCesantiaTeDevuelvo from '@/data/tasas_cesantia_te_devuelvo.json';

// ─── Constantes de tasas de desgravamen TDV ─────────────────────────────────
const TDV_DESGRAVAMEN_TASAS = [
  {
    segmento: 'Crédito ≤ $20M · Edad 18–55',
    tasa: 0.0003,
    descripcion: 'Tasa mensual preferencial para créditos hasta 20 millones, clientes hasta 55 años',
    montoLimite: '≤ $20.000.000',
    edadRango: '18 – 55 años',
  },
  {
    segmento: 'Crédito ≤ $20M · Edad 56+',
    tasa: 0.00039,
    descripcion: 'Tasa mensual preferencial para créditos hasta 20 millones, clientes de 56 años o más',
    montoLimite: '≤ $20.000.000',
    edadRango: '56+ años',
  },
  {
    segmento: 'Crédito > $20M · Edad 18–55',
    tasa: 0.000344,
    descripcion: 'Tasa mensual preferencial para créditos sobre 20 millones, clientes hasta 55 años',
    montoLimite: '> $20.000.000',
    edadRango: '18 – 55 años',
  },
  {
    segmento: 'Crédito > $20M · Edad 56+',
    tasa: 0.000343,
    descripcion: 'Tasa mensual preferencial para créditos sobre 20 millones, clientes de 56 años o más',
    montoLimite: '> $20.000.000',
    edadRango: '56+ años',
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatTasa(tasa: number): string {
  return `${(tasa * 100).toFixed(4)}%`;
}

function formatMonto(monto: number | null): string {
  if (monto === null) return 'Sin límite';
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(monto);
}

const TRAMO_LABELS: Record<string, string> = {
  tramo_1: '$500K – $1M',
  tramo_2: '$1M – $3M',
  tramo_3: '$3M – $5M',
  tramo_4: '$5M – $7M',
  tramo_5: '$7M+',
};

// ─── Sub-componentes ─────────────────────────────────────────────────────────

function PendingBadge() {
  return (
    <Badge variant="outline" className="gap-1 text-xs border-amber-300 bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400">
      <Lock className="h-3 w-3" />
      Edición próximamente
    </Badge>
  );
}

function SectionHeader({
  icon: Icon,
  title,
  description,
  color,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  color: string;
}) {
  return (
    <div className="flex items-start gap-3 mb-6">
      <div className={`p-2 rounded-lg ${color} shrink-0 mt-0.5`}>
        <Icon className="h-4 w-4 text-white" />
      </div>
      <div>
        <h3 className="font-semibold text-sm">{title}</h3>
        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{description}</p>
      </div>
    </div>
  );
}

// ─── Tabla cesantía ───────────────────────────────────────────────────────────

function TablaCesantia({
  bancos,
  tdvTasas,
}: {
  bancos: Record<string, Record<string, { desde: number; hasta: number | null; tasa_mensual: number }>>;
  tdvTasas: Record<string, { desde: number; hasta: number | null; tasa_mensual: number }>;
}) {
  const tramosKeys = ['tramo_1', 'tramo_2', 'tramo_3', 'tramo_4', 'tramo_5'];
  const bancosNombres = Object.keys(bancos);

  // Calcular ahorro TDV vs banco para cada tramo
  const bancoPrimero = Object.values(bancos)[0] ?? {};

  return (
    <div className="space-y-6">
      {/* Header informativo */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {tramosKeys.slice(0, 3).map(tramo => {
          const bancoDato = bancoPrimero[tramo as keyof typeof bancoPrimero] as any;
          const tdvDato = tdvTasas[tramo as keyof typeof tdvTasas];
          if (!bancoDato || !tdvDato) return null;
          const ahorroPct = ((bancoDato.tasa_mensual - tdvDato.tasa_mensual) / bancoDato.tasa_mensual * 100);
          return (
            <div key={tramo} className="rounded-lg border border-border/60 bg-muted/20 p-3">
              <p className="text-xs text-muted-foreground font-medium">{TRAMO_LABELS[tramo]}</p>
              <div className="flex items-end justify-between mt-1">
                <div>
                  <p className="text-xs text-muted-foreground">Banco</p>
                  <p className="font-mono text-sm font-semibold">{formatTasa(bancoDato.tasa_mensual)}</p>
                </div>
                <TrendingDown className="h-4 w-4 text-emerald-500" />
                <div className="text-right">
                  <p className="text-xs text-emerald-600 dark:text-emerald-400">TDV</p>
                  <p className="font-mono text-sm font-bold text-emerald-600 dark:text-emerald-400">{formatTasa(tdvDato.tasa_mensual)}</p>
                </div>
              </div>
              <div className="mt-1.5 pt-1.5 border-t border-border/40">
                <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                  Ahorro: {ahorroPct.toFixed(1)}% menos
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Tabla principal */}
      <div className="rounded-xl border border-border/60 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground min-w-[160px]">Institución</th>
                {tramosKeys.map(t => (
                  <th key={t} className="text-right px-3 py-3 font-medium text-muted-foreground whitespace-nowrap">
                    {TRAMO_LABELS[t]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* Fila TDV destacada */}
              <tr className="border-b bg-emerald-50/60 dark:bg-emerald-950/20">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="p-1 rounded-md bg-emerald-500/10">
                      <Sparkles className="h-3.5 w-3.5 text-emerald-600" />
                    </div>
                    <span className="font-semibold text-emerald-700 dark:text-emerald-400">Te Devuelvo</span>
                    <Badge className="text-[10px] h-4 bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 hover:bg-emerald-100">TDV</Badge>
                  </div>
                </td>
                {tramosKeys.map(t => {
                  const dato = tdvTasas[t as keyof typeof tdvTasas];
                  return (
                    <td key={t} className="px-3 py-3 text-right font-mono font-bold text-emerald-700 dark:text-emerald-400">
                      {dato ? formatTasa(dato.tasa_mensual) : '—'}
                    </td>
                  );
                })}
              </tr>

              {/* Bancos */}
              {bancosNombres.map((banco, i) => (
                <tr key={banco} className={`border-b transition-colors hover:bg-muted/30 ${i % 2 === 0 ? '' : 'bg-muted/10'}`}>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="font-medium text-xs">{banco}</span>
                    </div>
                  </td>
                  {tramosKeys.map(t => {
                    const dato = bancos[banco][t as keyof (typeof bancos)[string]] as any;
                    const tdvDato = tdvTasas[t as keyof typeof tdvTasas];
                    const isCheaper = dato && tdvDato && tdvDato.tasa_mensual < dato.tasa_mensual;
                    return (
                      <td key={t} className="px-3 py-2.5 text-right font-mono text-xs">
                        <span className={isCheaper ? 'text-red-600 dark:text-red-400' : ''}>
                          {dato ? formatTasa(dato.tasa_mensual) : '—'}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-2.5 border-t bg-muted/20 flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-red-400 shrink-0" />
          <p className="text-xs text-muted-foreground">Las tasas en rojo indican que TDV ofrece una tasa menor (mejor para el cliente)</p>
        </div>
      </div>
    </div>
  );
}

// ─── Tabla desgravamen TDV ────────────────────────────────────────────────────

function TablaDesgravamenTDV() {
  return (
    <div className="space-y-6">
      {/* Cards de segmentos */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {TDV_DESGRAVAMEN_TASAS.map((item) => (
          <div
            key={item.segmento}
            className="rounded-xl border border-border/60 p-4 bg-indigo-50/30 dark:bg-indigo-950/10 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20 transition-colors"
          >
            <div className="flex items-start justify-between gap-2 mb-3">
              <p className="text-sm font-semibold leading-tight">{item.segmento}</p>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5 cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-[220px] text-xs">
                    {item.descripcion}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>

            <div className="flex items-center justify-between mb-3">
              <span className="font-mono text-3xl font-bold text-indigo-700 dark:text-indigo-400">
                {formatTasa(item.tasa)}
              </span>
              <span className="text-xs text-muted-foreground text-right leading-tight">mensual</span>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-3 border-t border-border/40">
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">Monto crédito</p>
                <p className="text-xs font-medium">{item.montoLimite}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">Edad cliente</p>
                <p className="text-xs font-medium">{item.edadRango}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Nota informativa */}
      <div className="flex items-start gap-3 rounded-lg bg-muted/40 border border-border/60 p-4">
        <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
        <div className="text-xs text-muted-foreground space-y-1">
          <p>Las tasas de desgravamen TDV son preferenciales y se aplican sobre el <strong>saldo insoluto restante del crédito</strong> en el momento del cálculo.</p>
          <p>Para créditos con tasa superior a $20M se utiliza la tasa preferencial alta, independientemente de la institución financiera original.</p>
        </div>
      </div>
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export function TasasSection() {
  const cesantiaBancos = tasasCesantiaBanco as Record<string, Record<string, { desde: number; hasta: number | null; tasa_mensual: number }>>;
  const cesantiaTDV = (tasasCesantiaTeDevuelvo as any).TE_DEVUELVO_CESANTIA as Record<string, { desde: number; hasta: number | null; tasa_mensual: number }>;

  const handleExport = useCallback(() => {
    const wb = XLSX.utils.book_new();
    const timestamp = new Date().toISOString().slice(0, 10);

    // Hoja 1: Tasas Cesantía Bancos
    const tramosKeys = ['tramo_1', 'tramo_2', 'tramo_3', 'tramo_4', 'tramo_5'];
    const cesantiaRows = Object.entries(cesantiaBancos).map(([banco, tramos]) => {
      const row: Record<string, any> = { 'Institución': banco, 'Tipo': 'Banco', 'Seguro': 'Cesantía' };
      tramosKeys.forEach(t => {
        const dato = tramos[t as keyof typeof tramos] as any;
        row[`Tasa ${TRAMO_LABELS[t]}`] = dato ? dato.tasa_mensual : null;
      });
      return row;
    });
    // Agregar fila TDV al final
    const tdvRow: Record<string, any> = { 'Institución': 'Te Devuelvo', 'Tipo': 'TDV', 'Seguro': 'Cesantía' };
    tramosKeys.forEach(t => {
      const dato = cesantiaTDV[t as keyof typeof cesantiaTDV];
      tdvRow[`Tasa ${TRAMO_LABELS[t]}`] = dato ? dato.tasa_mensual : null;
    });
    cesantiaRows.push(tdvRow);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(cesantiaRows), 'Cesantía');

    // Hoja 2: Tasas Desgravamen TDV
    const desgravamenRows = TDV_DESGRAVAMEN_TASAS.map(item => ({
      'Segmento': item.segmento,
      'Monto Crédito': item.montoLimite,
      'Edad Cliente': item.edadRango,
      'Tasa Mensual': item.tasa,
      'Tasa Mensual (%)': `${(item.tasa * 100).toFixed(4)}%`,
      'Descripción': item.descripcion,
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(desgravamenRows), 'Desgravamen TDV');

    XLSX.writeFile(wb, `tasas-tdv-${timestamp}.xlsx`);
  }, [cesantiaBancos, cesantiaTDV]);

  return (
    <div className="space-y-6">
      {/* Header de sección */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Tasas de Referencia</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Tasas mensuales utilizadas para el cálculo de devoluciones de seguros.
            Las tasas TDV son preferenciales y determinan el monto a recuperar para el cliente.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <PendingBadge />
          <Button variant="outline" size="sm" onClick={handleExport} className="gap-2">
            <Download className="h-3.5 w-3.5" />
            Exportar Excel
          </Button>
        </div>
      </div>

      {/* Tabs de tipos de seguro */}
      <Tabs defaultValue="cesantia" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 max-w-sm">
          <TabsTrigger value="cesantia" className="gap-2">
            <Briefcase className="h-3.5 w-3.5" />
            Cesantía
          </TabsTrigger>
          <TabsTrigger value="desgravamen" className="gap-2">
            <ShieldCheck className="h-3.5 w-3.5" />
            Desgravamen
          </TabsTrigger>
        </TabsList>

        {/* ── Tab Cesantía ── */}
        <TabsContent value="cesantia" className="space-y-6 mt-0">
          <SectionHeader
            icon={Briefcase}
            title="Tasas de Cesantía · Bancos vs TDV"
            description="Tasas mensuales por tramo de monto del crédito. TDV ofrece tasas menores en todos los tramos, generando el diferencial que se devuelve al cliente."
            color="bg-blue-500"
          />
          <TablaCesantia bancos={cesantiaBancos} tdvTasas={cesantiaTDV} />
        </TabsContent>

        {/* ── Tab Desgravamen ── */}
        <TabsContent value="desgravamen" className="space-y-6 mt-0">
          <SectionHeader
            icon={ShieldCheck}
            title="Tasas Preferenciales TDV · Desgravamen"
            description="Tasas que TDV aplica para recalcular el seguro de desgravamen. Se segmentan por monto del crédito y edad del cliente al momento del cálculo."
            color="bg-indigo-500"
          />
          <TablaDesgravamenTDV />

          {/* Nota sobre tasas bancarias de desgravamen */}
          <div className="rounded-xl border border-border/60 bg-muted/20 p-5">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-950/40 shrink-0">
                <Info className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-sm font-semibold mb-1">Tasas bancarias de desgravamen</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Las tasas de desgravamen que cobran los bancos varían por institución, monto del crédito, plazo
                  (número de cuotas) y tramo de edad. Están almacenadas en la tabla de tasas formateadas y
                  son consultadas dinámicamente durante el cálculo de simulación.
                  La edición de estas tasas estará disponible próximamente.
                </p>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
