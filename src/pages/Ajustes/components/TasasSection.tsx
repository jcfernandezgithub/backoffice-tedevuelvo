import { useState, useMemo, useCallback } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
  ShieldCheck,
  Briefcase,
  TrendingDown,
  Download,
  Info,
  Lock,
  Building2,
  Sparkles,
  UserRound,
  Users,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import tasasCesantiaBanco from '@/data/tasas_cesantia_banco.json';
import tasasCesantiaTeDevuelvo from '@/data/tasas_cesantia_te_devuelvo.json';
import tasasDesgravamen from '@/data/tasas_formateadas_te_devuelvo.json';

// ─── Constantes de tasas TDV desgravamen ────────────────────────────────────

const TDV_DESGRAVAMEN_TASAS = [
  { segmento: 'Crédito ≤ $20M · Edad 18–55', tasa: 0.0003, montoLimite: '≤ $20.000.000', edadRango: '18 – 55 años', descripcion: 'Tasa mensual preferencial para créditos hasta 20 millones, clientes hasta 55 años' },
  { segmento: 'Crédito ≤ $20M · Edad 56+',   tasa: 0.00039, montoLimite: '≤ $20.000.000', edadRango: '56+ años', descripcion: 'Tasa mensual preferencial para créditos hasta 20 millones, clientes de 56 años o más' },
  { segmento: 'Crédito > $20M · Edad 18–55', tasa: 0.000344, montoLimite: '> $20.000.000', edadRango: '18 – 55 años', descripcion: 'Tasa mensual preferencial para créditos sobre 20 millones, clientes hasta 55 años' },
  { segmento: 'Crédito > $20M · Edad 56+',   tasa: 0.000343, montoLimite: '> $20.000.000', edadRango: '56+ años', descripcion: 'Tasa mensual preferencial para créditos sobre 20 millones, clientes de 56 años o más' },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatTasa(tasa: number): string {
  return `${(tasa * 100).toFixed(4)}%`;
}

function formatMontoCLP(monto: number): string {
  if (monto >= 1_000_000) return `$${(monto / 1_000_000).toFixed(0)}M`;
  if (monto >= 1_000) return `$${(monto / 1_000).toFixed(0)}K`;
  return `$${monto}`;
}

const TRAMO_LABELS: Record<string, string> = {
  tramo_1: '$500K – $1M',
  tramo_2: '$1M – $3M',
  tramo_3: '$3M – $5M',
  tramo_4: '$5M – $7M',
  tramo_5: '$7M+',
};

// Intensidad de color según valor de tasa (más alta = más oscuro/cálido)
function getTasaColorClass(tasa: number, minTasa: number, maxTasa: number): string {
  if (maxTasa === minTasa) return '';
  const ratio = (tasa - minTasa) / (maxTasa - minTasa);
  if (ratio < 0.2)  return 'bg-emerald-50  dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300';
  if (ratio < 0.4)  return 'bg-lime-50     dark:bg-lime-950/30    text-lime-800    dark:text-lime-300';
  if (ratio < 0.6)  return 'bg-yellow-50   dark:bg-yellow-950/30  text-yellow-800  dark:text-yellow-300';
  if (ratio < 0.8)  return 'bg-orange-50   dark:bg-orange-950/30  text-orange-800  dark:text-orange-300';
  return               'bg-red-50      dark:bg-red-950/30      text-red-800     dark:text-red-300';
}

// ─── Sub-componentes generales ───────────────────────────────────────────────

function PendingBadge() {
  return (
    <Badge variant="outline" className="gap-1 text-xs border-amber-300 bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400">
      <Lock className="h-3 w-3" />
      Edición próximamente
    </Badge>
  );
}

function SectionHeader({ icon: Icon, title, description, color }: { icon: React.ElementType; title: string; description: string; color: string }) {
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
  const bancoPrimero = Object.values(bancos)[0] ?? {};

  return (
    <div className="space-y-6">
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
                <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">Ahorro: {ahorroPct.toFixed(1)}% menos</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="rounded-xl border border-border/60 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground min-w-[160px]">Institución</th>
                {tramosKeys.map(t => (
                  <th key={t} className="text-right px-3 py-3 font-medium text-muted-foreground whitespace-nowrap">{TRAMO_LABELS[t]}</th>
                ))}
              </tr>
            </thead>
            <tbody>
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
                        <span className={isCheaper ? 'text-red-600 dark:text-red-400' : ''}>{dato ? formatTasa(dato.tasa_mensual) : '—'}</span>
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

// ─── Tabla desgravamen bancario ───────────────────────────────────────────────

type DesgravamenData = Record<string, Record<string, Record<string, Record<string, number>>>>;

function TablaDesgravamenBancos() {
  const data = tasasDesgravamen as unknown as DesgravamenData;
  const bancos = Object.keys(data);
  const [bancoSeleccionado, setBancoSeleccionado] = useState(bancos[0]);
  const [tramoEdad, setTramoEdad] = useState<'hasta_55' | 'desde_56'>('hasta_55');

  // Extraer montos y cuotas disponibles para el banco/tramo seleccionado
  const { montos, cuotas, matriz, minTasa, maxTasa } = useMemo(() => {
    const datosBanco = data[bancoSeleccionado]?.[tramoEdad] ?? {};
    const montosRaw = Object.keys(datosBanco).map(Number).sort((a, b) => a - b);
    const cuotasSet = new Set<number>();
    montosRaw.forEach(m => {
      Object.keys(datosBanco[String(m)] ?? {}).forEach(c => cuotasSet.add(Number(c)));
    });
    const cuotasRaw = Array.from(cuotasSet).sort((a, b) => a - b);

    let min = Infinity, max = -Infinity;
    montosRaw.forEach(m => {
      cuotasRaw.forEach(c => {
        const v = datosBanco[String(m)]?.[String(c)];
        if (typeof v === 'number') { min = Math.min(min, v); max = Math.max(max, v); }
      });
    });

    return {
      montos: montosRaw,
      cuotas: cuotasRaw,
      matriz: datosBanco,
      minTasa: min === Infinity ? 0 : min,
      maxTasa: max === -Infinity ? 0 : max,
    };
  }, [bancoSeleccionado, tramoEdad, data]);

  return (
    <div className="space-y-5">
      {/* Controles */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Selector banco */}
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
          <Select value={bancoSeleccionado} onValueChange={setBancoSeleccionado}>
            <SelectTrigger className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {bancos.map(b => (
                <SelectItem key={b} value={b}>{b}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Tramo edad */}
        <ToggleGroup
          type="single"
          value={tramoEdad}
          onValueChange={(v) => v && setTramoEdad(v as 'hasta_55' | 'desde_56')}
          className="border rounded-lg p-0.5 bg-muted/30"
        >
          <ToggleGroupItem value="hasta_55" className="gap-1.5 text-xs px-3 h-8 data-[state=on]:bg-background data-[state=on]:shadow-sm">
            <UserRound className="h-3.5 w-3.5" />
            18 – 55 años
          </ToggleGroupItem>
          <ToggleGroupItem value="desde_56" className="gap-1.5 text-xs px-3 h-8 data-[state=on]:bg-background data-[state=on]:shadow-sm">
            <Users className="h-3.5 w-3.5" />
            56+ años
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      {/* Leyenda de color */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-xs text-muted-foreground">Tasa:</span>
        {['bg-emerald-50 text-emerald-800', 'bg-lime-50 text-lime-800', 'bg-yellow-50 text-yellow-800', 'bg-orange-50 text-orange-800', 'bg-red-50 text-red-800'].map((cls, i) => (
          <span key={i} className={`text-[10px] font-medium px-2 py-0.5 rounded ${cls}`}>
            {['Muy baja', 'Baja', 'Media', 'Alta', 'Muy alta'][i]}
          </span>
        ))}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>
              <Info className="h-3.5 w-3.5 text-muted-foreground" />
            </TooltipTrigger>
            <TooltipContent className="text-xs max-w-[220px]">
              El color indica la posición relativa de la tasa dentro del rango disponible para este banco y tramo de edad.
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Tabla monto × cuotas */}
      <div className="rounded-xl border border-border/60 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground sticky left-0 bg-muted/50 z-10 min-w-[100px]">
                  Monto crédito
                </th>
                {cuotas.map(c => (
                  <th key={c} className="text-center px-3 py-3 font-medium text-muted-foreground whitespace-nowrap min-w-[80px]">
                    {c} cuotas
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {montos.map((monto, rowIdx) => (
                <tr key={monto} className={`border-b hover:brightness-95 transition-all ${rowIdx % 2 === 0 ? 'bg-background' : 'bg-muted/10'}`}>
                  <td className="px-4 py-2.5 font-semibold text-xs sticky left-0 bg-inherit z-10 border-r border-border/40">
                    {formatMontoCLP(monto)}
                  </td>
                  {cuotas.map(c => {
                    const tasa = matriz[String(monto)]?.[String(c)];
                    const colorClass = typeof tasa === 'number' ? getTasaColorClass(tasa, minTasa, maxTasa) : '';
                    return (
                      <td key={c} className="px-2 py-2 text-center">
                        {typeof tasa === 'number' ? (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className={`inline-block font-mono text-xs font-semibold px-2 py-1 rounded-md cursor-default ${colorClass}`}>
                                  {(tasa * 100).toFixed(4)}%
                                </span>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="text-xs space-y-1">
                                <p className="font-semibold">{bancoSeleccionado}</p>
                                <p>Monto: {formatMontoCLP(monto)} · {c} cuotas · {tramoEdad === 'hasta_55' ? '18–55 años' : '56+ años'}</p>
                                <p>Prima única: <strong>{(tasa * 100).toFixed(5)}%</strong> del capital</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        ) : (
                          <span className="text-muted-foreground/40 text-xs">—</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer info */}
        <div className="px-4 py-3 border-t bg-muted/20 flex flex-wrap items-center gap-x-6 gap-y-1 text-xs text-muted-foreground">
          <span><strong>{montos.length}</strong> tramos de monto</span>
          <span><strong>{cuotas.length}</strong> plazos disponibles</span>
          <span>Tasas expresadas como <strong>prima única</strong> (% del capital del crédito)</span>
          <span>Min: <strong className="font-mono">{(minTasa * 100).toFixed(4)}%</strong> · Max: <strong className="font-mono">{(maxTasa * 100).toFixed(4)}%</strong></span>
        </div>
      </div>
    </div>
  );
}

// ─── Tabla desgravamen TDV ────────────────────────────────────────────────────

function TablaDesgravamenTDV() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {TDV_DESGRAVAMEN_TASAS.map((item) => (
          <div key={item.segmento} className="rounded-xl border border-border/60 p-4 bg-indigo-50/30 dark:bg-indigo-950/10 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20 transition-colors">
            <div className="flex items-start justify-between gap-2 mb-3">
              <p className="text-sm font-semibold leading-tight">{item.segmento}</p>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5 cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-[220px] text-xs">{item.descripcion}</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div className="flex items-center justify-between mb-3">
              <span className="font-mono text-3xl font-bold text-indigo-700 dark:text-indigo-400">{formatTasa(item.tasa)}</span>
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
  const desgravamenData = tasasDesgravamen as unknown as DesgravamenData;

  const handleExport = useCallback(() => {
    const wb = XLSX.utils.book_new();
    const timestamp = new Date().toISOString().slice(0, 10);
    const tramosKeys = ['tramo_1', 'tramo_2', 'tramo_3', 'tramo_4', 'tramo_5'];

    // Hoja 1: Tasas Cesantía
    const cesantiaRows = Object.entries(cesantiaBancos).map(([banco, tramos]) => {
      const row: Record<string, any> = { 'Institución': banco, 'Tipo': 'Banco', 'Seguro': 'Cesantía' };
      tramosKeys.forEach(t => {
        const dato = tramos[t as keyof typeof tramos] as any;
        row[`Tasa ${TRAMO_LABELS[t]}`] = dato ? dato.tasa_mensual : null;
      });
      return row;
    });
    const tdvRow: Record<string, any> = { 'Institución': 'Te Devuelvo', 'Tipo': 'TDV', 'Seguro': 'Cesantía' };
    tramosKeys.forEach(t => {
      const dato = cesantiaTDV[t as keyof typeof cesantiaTDV];
      tdvRow[`Tasa ${TRAMO_LABELS[t]}`] = dato ? dato.tasa_mensual : null;
    });
    cesantiaRows.push(tdvRow);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(cesantiaRows), 'Cesantía');

    // Hoja 2: Desgravamen Bancos (una hoja por banco)
    Object.entries(desgravamenData).forEach(([banco, tramos]) => {
      const rows: Record<string, any>[] = [];
      (['hasta_55', 'desde_56'] as const).forEach(tramo => {
        const montos = tramos[tramo] ?? {};
        Object.entries(montos).forEach(([monto, cuotasObj]) => {
          Object.entries(cuotasObj as Record<string, number>).forEach(([cuotas, tasa]) => {
            rows.push({
              'Banco': banco,
              'Tramo Edad': tramo === 'hasta_55' ? '18-55 años' : '56+ años',
              'Monto Crédito': Number(monto),
              'Cuotas': Number(cuotas),
              'Tasa Prima Única': tasa,
              'Tasa Prima Única (%)': `${(tasa * 100).toFixed(5)}%`,
            });
          });
        });
      });
      const sheetName = banco.replace('BANCO ', '').slice(0, 31);
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), sheetName);
    });

    // Hoja final: Desgravamen TDV
    const desgravTdvRows = TDV_DESGRAVAMEN_TASAS.map(item => ({
      'Segmento': item.segmento, 'Monto Crédito': item.montoLimite, 'Edad Cliente': item.edadRango,
      'Tasa Mensual': item.tasa, 'Tasa Mensual (%)': `${(item.tasa * 100).toFixed(4)}%`,
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(desgravTdvRows), 'Desgravamen TDV');

    XLSX.writeFile(wb, `tasas-tdv-${timestamp}.xlsx`);
  }, [cesantiaBancos, cesantiaTDV, desgravamenData]);

  return (
    <div className="space-y-6">
      {/* Header */}
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

      {/* Tabs seguro */}
      <Tabs defaultValue="desgravamen" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 max-w-sm">
          <TabsTrigger value="desgravamen" className="gap-2">
            <ShieldCheck className="h-3.5 w-3.5" />
            Desgravamen
          </TabsTrigger>
          <TabsTrigger value="cesantia" className="gap-2">
            <Briefcase className="h-3.5 w-3.5" />
            Cesantía
          </TabsTrigger>
        </TabsList>

        {/* ── Tab Desgravamen ── */}
        <TabsContent value="desgravamen" className="space-y-8 mt-0">
          {/* Tasas bancarias */}
          <div>
            <SectionHeader
              icon={Building2}
              title="Tasas Bancarias · Desgravamen"
              description="Prima única por banco, monto de crédito y plazo. Selecciona el banco y el tramo de edad para explorar la tabla completa."
              color="bg-blue-500"
            />
            <TablaDesgravamenBancos />
          </div>

          <div className="h-px bg-border" />

          {/* Tasas TDV */}
          <div>
            <SectionHeader
              icon={ShieldCheck}
              title="Tasas Preferenciales TDV · Desgravamen"
              description="Tasas que TDV aplica para recalcular el seguro de desgravamen, segmentadas por monto del crédito y edad del cliente."
              color="bg-indigo-500"
            />
            <TablaDesgravamenTDV />
          </div>
        </TabsContent>

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
      </Tabs>
    </div>
  );
}
