import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { TrendingUp, RotateCcw, Save, ChevronRight, Copy } from 'lucide-react';
import { usePlanCumplimiento, MESES, planAnualVacio, type PlanAnual, type MesIndex } from '@/hooks/usePlanCumplimiento';

function formatCLP(value: number): string {
  if (value === 0) return '';
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(value);
}

function parseCLP(raw: string): number {
  const cleaned = raw.replace(/[^0-9]/g, '');
  const num = parseInt(cleaned, 10);
  return isNaN(num) ? 0 : num;
}

const TRIMESTRES = [
  { label: 'Q1', meses: [0, 1, 2] },
  { label: 'Q2', meses: [3, 4, 5] },
  { label: 'Q3', meses: [6, 7, 8] },
  { label: 'Q4', meses: [9, 10, 11] },
];

const QUARTER_COLORS: Record<string, string> = {
  Q1: 'from-sky-500 to-sky-600',
  Q2: 'from-violet-500 to-violet-600',
  Q3: 'from-amber-500 to-amber-600',
  Q4: 'from-emerald-500 to-emerald-600',
};

const QUARTER_BG: Record<string, string> = {
  Q1: 'bg-sky-50 dark:bg-sky-950/20',
  Q2: 'bg-violet-50 dark:bg-violet-950/20',
  Q3: 'bg-amber-50 dark:bg-amber-950/20',
  Q4: 'bg-emerald-50 dark:bg-emerald-950/20',
};

export function PlanCumplimientoForm() {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const { getPlanAnio, savePlanAnio, resetPlanAnio, tieneplan, aniosConPlan } = usePlanCumplimiento();

  const [draft, setDraft] = useState<PlanAnual>(() => getPlanAnio(selectedYear));
  const [rawInputs, setRawInputs] = useState<Record<number, string>>(() =>
    Object.fromEntries(MESES.map((_, i) => [i, getPlanAnio(selectedYear)[i as MesIndex] > 0 ? formatCLP(getPlanAnio(selectedYear)[i as MesIndex]) : '']))
  );
  const [isDirty, setIsDirty] = useState(false);

  // Sincronizar cuando cambia el año
  useEffect(() => {
    const plan = getPlanAnio(selectedYear);
    setDraft({ ...plan });
    setRawInputs(Object.fromEntries(MESES.map((_, i) => [i, plan[i as MesIndex] > 0 ? formatCLP(plan[i as MesIndex]) : ''])));
    setIsDirty(false);
  }, [selectedYear, getPlanAnio]);

  const handleChange = (mesIdx: number, raw: string) => {
    const val = parseCLP(raw);
    setRawInputs(prev => ({ ...prev, [mesIdx]: raw === '' ? '' : formatCLP(val) }));
    setDraft(prev => ({ ...prev, [mesIdx]: val }));
    setIsDirty(true);
  };

  const handleFocus = (mesIdx: number) => {
    setRawInputs(prev => ({
      ...prev,
      [mesIdx]: draft[mesIdx as MesIndex] > 0 ? String(draft[mesIdx as MesIndex]) : '',
    }));
  };

  const handleBlur = (mesIdx: number) => {
    const val = draft[mesIdx as MesIndex];
    setRawInputs(prev => ({
      ...prev,
      [mesIdx]: val > 0 ? formatCLP(val) : '',
    }));
  };

  const handleSave = () => {
    savePlanAnio(selectedYear, draft);
    setIsDirty(false);
    toast.success(`Plan ${selectedYear} guardado`, {
      description: 'Los cambios se reflejarán en el tab Detalle Financiero.',
    });
  };

  const handleReset = () => {
    resetPlanAnio(selectedYear);
    const empty = planAnualVacio();
    setDraft(empty);
    setRawInputs(Object.fromEntries(MESES.map((_, i) => [i, ''])));
    setIsDirty(false);
    toast.info(`Plan ${selectedYear} eliminado.`);
  };

  // Distribuir uniformemente el total anual en 12 meses
  const handleDistribuirUniforme = () => {
    const total = Object.values(draft).reduce((s, v) => s + v, 0);
    if (total === 0) return;
    const porMes = Math.round(total / 12);
    const nuevosDraft = Object.fromEntries(MESES.map((_, i) => [i, porMes])) as PlanAnual;
    setDraft(nuevosDraft);
    setRawInputs(Object.fromEntries(MESES.map((_, i) => [i, formatCLP(porMes)])));
    setIsDirty(true);
    toast.info('Total distribuido uniformemente entre los 12 meses.');
  };

  // Copiar plan del año anterior
  const handleCopiarAnterior = () => {
    const planAnterior = getPlanAnio(selectedYear - 1);
    setDraft({ ...planAnterior });
    setRawInputs(Object.fromEntries(MESES.map((_, i) => [i, planAnterior[i as MesIndex] > 0 ? formatCLP(planAnterior[i as MesIndex]) : ''])));
    setIsDirty(true);
    toast.info(`Plan copiado desde ${selectedYear - 1}.`);
  };

  const totalAnual = Object.values(draft).reduce((s, v) => s + v, 0);

  const yearsToShow = Array.from(
    new Set([currentYear - 1, currentYear, currentYear + 1, ...aniosConPlan])
  ).sort((a, b) => b - a);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Plan de Cumplimiento · Prima Recuperada
            </CardTitle>
            <CardDescription className="mt-1">
              Define el monto objetivo de prima recuperada para cada mes del año.
              Se compara contra los valores reales en el tab <strong>Detalle Financiero</strong>.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {isDirty && (
              <Badge variant="outline" className="bg-amber-50 border-amber-300 text-amber-700 whitespace-nowrap">
                Cambios sin guardar
              </Badge>
            )}
            <Select value={String(selectedYear)} onValueChange={v => setSelectedYear(Number(v))}>
              <SelectTrigger className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {yearsToShow.map(y => (
                  <SelectItem key={y} value={String(y)}>
                    {y} {tieneplan(y) ? '✓' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Grid de trimestres */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {TRIMESTRES.map(({ label, meses }) => {
            const qTotal = meses.reduce((s, i) => s + (draft[i as MesIndex] ?? 0), 0);
            const gradient = QUARTER_COLORS[label];
            const bg = QUARTER_BG[label];

            return (
              <div key={label} className={`rounded-xl border border-border/60 overflow-hidden ${bg}`}>
                {/* Header del trimestre */}
                <div className={`px-4 py-2 bg-gradient-to-r ${gradient} flex items-center justify-between`} style={{}}>
                  <span className="text-white font-semibold text-sm">{label} · {MESES[meses[0]].slice(0, 3)}–{MESES[meses[2]].slice(0, 3)}</span>
                  <span className="text-white/90 text-xs font-mono tabular-nums">
                    {qTotal > 0 ? formatCLP(qTotal) : 'Sin plan'}
                  </span>
                </div>

                {/* Meses del trimestre */}
                <div className="divide-y divide-border/40">
                  {meses.map(mesIdx => (
                    <div key={mesIdx} className="flex items-center gap-3 px-4 py-2.5">
                      <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
                      <span className="text-sm font-medium w-24 text-foreground">{MESES[mesIdx]}</span>
                      <Input
                        type="text"
                        inputMode="numeric"
                        placeholder="$ Sin plan"
                        value={rawInputs[mesIdx] ?? ''}
                        onFocus={() => handleFocus(mesIdx)}
                        onBlur={() => handleBlur(mesIdx)}
                        onChange={e => handleChange(mesIdx, e.target.value)}
                        className="flex-1 text-right font-mono text-sm h-8"
                      />
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <Separator />

        {/* Resumen anual */}
        <div className="flex items-center justify-between rounded-lg bg-muted/50 px-4 py-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <TrendingUp className="h-4 w-4" />
            <span>Total plan anual {selectedYear}</span>
          </div>
          <span className="font-bold text-foreground text-lg tabular-nums">
            {totalAnual > 0 ? formatCLP(totalAnual) : '—'}
          </span>
        </div>

        {/* Acciones */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopiarAnterior}
              className="gap-2 text-muted-foreground"
              title={`Copiar plan de ${selectedYear - 1}`}
            >
              <Copy className="h-3.5 w-3.5" />
              Copiar {selectedYear - 1}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDistribuirUniforme}
              disabled={totalAnual === 0}
              className="gap-2 text-muted-foreground"
              title="Distribuir el total actual en partes iguales por mes"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Distribuir uniforme
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleReset}
              className="gap-2"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Borrar plan
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={!isDirty}
              className="gap-2"
            >
              <Save className="h-3.5 w-3.5" />
              Guardar plan
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
