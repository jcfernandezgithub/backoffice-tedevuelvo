import { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tooltip as RechartsTooltip, TooltipProps } from 'recharts';
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
  Legend,
} from 'recharts';
import { TrendingUp, TrendingDown, Minus, AlertTriangle, CheckCircle2, Settings } from 'lucide-react';
import { readPlanCumplimiento, MESES, type MesIndex } from '@/hooks/usePlanCumplimiento';
import { format, parseISO, startOfMonth } from 'date-fns';
import { es } from 'date-fns/locale';

function formatCLP(value: number, compact = false): string {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    notation: compact ? 'compact' : 'standard',
    maximumFractionDigits: 0,
  }).format(value);
}

interface MonthlyPrimaData {
  monthKey: string; // 'yyyy-MM'
  prima: number;
  label: string;
  labelShort: string;
}

interface PlanCumplimientoChartProps {
  monthlyData: MonthlyPrimaData[];
}

interface PlanRow {
  mes: string;          // 'Ene 2026'
  mesCorto: string;     // 'Ene'
  monthKey: string;
  real: number;
  plan: number;
  desviacion: number;   // real - plan
  desviacionPct: number | null;
  cumple: boolean;
  sinPlan: boolean;
}

// Tooltip personalizado
const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload as PlanRow;
  if (!d) return null;

  const desvPct = d.desviacionPct;
  const isOver = d.desviacion >= 0;

  return (
    <div className="bg-background border rounded-xl p-4 shadow-xl min-w-[260px] space-y-3">
      <p className="font-semibold text-sm">{d.mes}</p>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <div className="w-2.5 h-2.5 rounded-sm" style={{ background: 'hsl(239, 84%, 67%)' }} />
            Prima Real
          </span>
          <span className="font-mono text-xs font-semibold">{formatCLP(d.real)}</span>
        </div>

        {!d.sinPlan && (
          <>
            <div className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <div className="w-2.5 h-0.5 rounded-full" style={{ background: 'hsl(31, 91%, 54%)' }} />
                Plan
              </span>
              <span className="font-mono text-xs font-semibold">{formatCLP(d.plan)}</span>
            </div>

            <div className="border-t pt-2 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Desviación vs Plan</span>
              <span className={`font-mono text-xs font-bold flex items-center gap-1 ${isOver ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                {isOver ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {isOver ? '+' : ''}{formatCLP(d.desviacion)}
                {desvPct !== null && <span className="text-xs opacity-75">({isOver ? '+' : ''}{desvPct.toFixed(1)}%)</span>}
              </span>
            </div>
          </>
        )}

        {d.sinPlan && (
          <p className="text-xs text-muted-foreground italic">Sin plan configurado para este mes</p>
        )}
      </div>
    </div>
  );
};

export function PlanCumplimientoChart({ monthlyData }: PlanCumplimientoChartProps) {
  // Leer el plan actual desde localStorage de forma síncrona
  const planes = readPlanCumplimiento();

  const rows = useMemo((): PlanRow[] => {
    return monthlyData.map(item => {
      const [yearStr, mesStr] = item.monthKey.split('-');
      const anio = Number(yearStr);
      const mesIdx = (Number(mesStr) - 1) as MesIndex;

      const plan = planes[anio]?.[mesIdx] ?? 0;
      const sinPlan = plan === 0;
      const desviacion = item.prima - plan;
      const desviacionPct = !sinPlan && plan > 0 ? (desviacion / plan) * 100 : null;
      const cumple = !sinPlan && item.prima >= plan;

      return {
        mes: item.label,
        mesCorto: item.labelShort,
        monthKey: item.monthKey,
        real: item.prima,
        plan,
        desviacion,
        desviacionPct,
        cumple,
        sinPlan,
      };
    });
  }, [monthlyData, planes]);

  // Solo filas que tienen plan configurado para los KPIs globales
  const rowsConPlan = rows.filter(r => !r.sinPlan);
  const mesesCumplen = rowsConPlan.filter(r => r.cumple).length;
  const mesesNoCumplen = rowsConPlan.filter(r => !r.cumple).length;
  const totalReal = rowsConPlan.reduce((s, r) => s + r.real, 0);
  const totalPlan = rowsConPlan.reduce((s, r) => s + r.plan, 0);
  const totalDesv = totalReal - totalPlan;
  const totalDesvPct = totalPlan > 0 ? (totalDesv / totalPlan) * 100 : null;

  const noPlanConfigured = rowsConPlan.length === 0;

  if (noPlanConfigured) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-12 flex flex-col items-center justify-center gap-3 text-center">
          <div className="p-3 rounded-full bg-muted">
            <Settings className="h-6 w-6 text-muted-foreground" />
          </div>
          <div>
            <p className="font-semibold text-sm">Sin plan de cumplimiento configurado</p>
            <p className="text-xs text-muted-foreground mt-1">
              Ve a <strong>Ajustes → Plan de Cumplimiento</strong> para configurar los montos objetivos de prima recuperada por mes.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Total real vs plan */}
        <Card className={`border-l-4 ${totalDesv >= 0 ? 'border-l-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/10' : 'border-l-red-500 bg-red-50/40 dark:bg-red-950/10'}`}>
          <CardContent className="px-4 py-3">
            <p className="text-xs text-muted-foreground mb-0.5">Desviación total</p>
            <p className={`text-lg font-bold tabular-nums ${totalDesv >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}`}>
              {totalDesv >= 0 ? '+' : ''}{formatCLP(totalDesv, true)}
            </p>
            {totalDesvPct !== null && (
              <p className={`text-xs font-medium flex items-center gap-0.5 mt-0.5 ${totalDesv >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {totalDesv >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {totalDesv >= 0 ? '+' : ''}{totalDesvPct.toFixed(1)}% vs plan
              </p>
            )}
          </CardContent>
        </Card>

        {/* Meses que cumplen */}
        <Card className="border-l-4 border-l-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/10">
          <CardContent className="px-4 py-3">
            <p className="text-xs text-muted-foreground mb-0.5">Meses sobre plan</p>
            <p className="text-lg font-bold text-emerald-700 dark:text-emerald-400">{mesesCumplen} <span className="text-sm font-normal text-muted-foreground">/ {rowsConPlan.length}</span></p>
            <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-0.5">
              <CheckCircle2 className="h-3 w-3 text-emerald-500" />
              Sobre el objetivo
            </p>
          </CardContent>
        </Card>

        {/* Meses bajo plan */}
        <Card className="border-l-4 border-l-red-500 bg-red-50/40 dark:bg-red-950/10">
          <CardContent className="px-4 py-3">
            <p className="text-xs text-muted-foreground mb-0.5">Meses bajo plan</p>
            <p className="text-lg font-bold text-red-700 dark:text-red-400">{mesesNoCumplen} <span className="text-sm font-normal text-muted-foreground">/ {rowsConPlan.length}</span></p>
            <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-0.5">
              <AlertTriangle className="h-3 w-3 text-red-500" />
              Requieren atención
            </p>
          </CardContent>
        </Card>

        {/* Cumplimiento % */}
        <Card className="border-l-4 border-l-indigo-500 bg-indigo-50/40 dark:bg-indigo-950/10">
          <CardContent className="px-4 py-3">
            <p className="text-xs text-muted-foreground mb-0.5">Prima real acumulada</p>
            <p className="text-lg font-bold text-indigo-700 dark:text-indigo-400 tabular-nums">{formatCLP(totalReal, true)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Plan: {formatCLP(totalPlan, true)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Gráfico combinado */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Prima Recuperada · Real vs Plan</CardTitle>
          <CardDescription>
            Las barras muestran la prima real mensual (verde = sobre plan, rojo = bajo plan). La línea naranja es el objetivo mensual.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={rows} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="mesCorto" stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <YAxis
                stroke="hsl(var(--muted-foreground))"
                fontSize={11}
                tickFormatter={v => formatCLP(v, true)}
                width={75}
              />
              <RechartsTooltip content={<CustomTooltip />} />
              <Legend
                iconType="square"
                formatter={(value) => value === 'real' ? 'Prima Real' : 'Plan Objetivo'}
                wrapperStyle={{ fontSize: 12 }}
              />
              <Bar dataKey="real" name="real" radius={[4, 4, 0, 0]}>
                {rows.map((entry, index) => {
                  const color = entry.sinPlan
                    ? 'hsl(239, 84%, 67%)'
                    : entry.cumple
                    ? 'hsl(142, 71%, 45%)'
                    : 'hsl(0, 84%, 60%)';
                  return <Cell key={`cell-${index}`} fill={color} fillOpacity={0.85} />;
                })}
              </Bar>
              <Line
                dataKey="plan"
                name="plan"
                type="monotone"
                stroke="hsl(31, 91%, 54%)"
                strokeWidth={2}
                strokeDasharray="5 3"
                dot={(props: any) => {
                  const { cx, cy, payload } = props;
                  if (payload.sinPlan || payload.plan === 0) return <g key={props.key} />;
                  return <circle key={props.key} cx={cx} cy={cy} r={3} fill="hsl(31, 91%, 54%)" stroke="white" strokeWidth={1.5} />;
                }}
                activeDot={{ r: 5 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Tabla de desviación mensual */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Desviación Mensual vs Plan</CardTitle>
          <CardDescription>Detalle mes a mes de la diferencia entre prima real y objetivo planificado.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Mes</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Prima Real</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Plan Objetivo</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Desviación</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">% vs Plan</th>
                  <th className="text-center px-4 py-3 font-medium text-muted-foreground">Estado</th>
                </tr>
              </thead>
              <tbody>
                {[...rows].reverse().map((row, i) => {
                  const isFirst = i === 0;
                  return (
                    <tr
                      key={row.monthKey}
                      className={`border-b transition-colors hover:bg-muted/30 ${isFirst ? 'font-medium bg-muted/20' : ''}`}
                    >
                      <td className="px-4 py-3 capitalize">{row.mes}</td>
                      <td className="px-4 py-3 text-right tabular-nums font-medium">{formatCLP(row.real)}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                        {row.sinPlan ? <span className="text-xs italic">Sin plan</span> : formatCLP(row.plan)}
                      </td>
                      <td className={`px-4 py-3 text-right tabular-nums font-semibold ${row.sinPlan ? 'text-muted-foreground' : row.desviacion >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                        {row.sinPlan ? '—' : `${row.desviacion >= 0 ? '+' : ''}${formatCLP(row.desviacion)}`}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {row.sinPlan || row.desviacionPct === null ? (
                          <span className="text-muted-foreground text-xs">—</span>
                        ) : (
                          <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${row.desviacion >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                            {row.desviacion >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                            {row.desviacion >= 0 ? '+' : ''}{row.desviacionPct.toFixed(1)}%
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {row.sinPlan ? (
                          <Badge variant="outline" className="text-xs text-muted-foreground">Sin plan</Badge>
                        ) : row.cumple ? (
                          <Badge className="text-xs bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100">
                            <CheckCircle2 className="h-3 w-3 mr-1" />Cumple
                          </Badge>
                        ) : (
                          <Badge variant="destructive" className="text-xs">
                            <AlertTriangle className="h-3 w-3 mr-1" />Bajo plan
                          </Badge>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {/* Totales */}
              {rowsConPlan.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 bg-muted/30 font-semibold">
                    <td className="px-4 py-3 text-sm">Total ({rowsConPlan.length} meses con plan)</td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatCLP(totalReal)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">{formatCLP(totalPlan)}</td>
                    <td className={`px-4 py-3 text-right tabular-nums ${totalDesv >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                      {totalDesv >= 0 ? '+' : ''}{formatCLP(totalDesv)}
                    </td>
                    <td className={`px-4 py-3 text-right text-sm font-semibold ${totalDesv >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                      {totalDesvPct !== null ? `${totalDesv >= 0 ? '+' : ''}${totalDesvPct.toFixed(1)}%` : '—'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge className={`text-xs ${totalDesv >= 0 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-200 hover:bg-emerald-100' : 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300 border-red-200 hover:bg-red-100'}`}>
                        {totalDesv >= 0 ? `${mesesCumplen}/${rowsConPlan.length} cumple` : `${mesesNoCumplen} bajo plan`}
                      </Badge>
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
