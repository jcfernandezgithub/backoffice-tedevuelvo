import { useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useDetalleFinancieroRefunds, useDetalleFinancieroCashflow } from '../hooks/useDetalleFinancieroRefunds';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from 'recharts';
import { TrendingUp, TrendingDown, Minus, DollarSign, ShieldCheck, Receipt, BarChart2, Download } from 'lucide-react';
import * as XLSX from 'xlsx';
import { format, parseISO, startOfMonth } from 'date-fns';
import { es } from 'date-fns/locale';
import { PlanCumplimientoChart } from '../components/PlanCumplimientoChart';


// ─── Helpers ────────────────────────────────────────────────────────────────

function formatCLP(value: number, compact = false): string {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    notation: compact ? 'compact' : 'standard',
    maximumFractionDigits: 0,
  }).format(value);
}

function variationLabel(pct: number | null) {
  if (pct === null) return null;
  if (Math.abs(pct) < 0.5) return { label: 'Sin cambio', icon: <Minus className="h-3.5 w-3.5" />, color: 'text-muted-foreground', badgeClass: 'bg-muted text-muted-foreground' };
  if (pct > 0) return { label: `+${pct.toFixed(1)}%`, icon: <TrendingUp className="h-3.5 w-3.5" />, color: 'text-emerald-600 dark:text-emerald-400', badgeClass: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' };
  return { label: `${pct.toFixed(1)}%`, icon: <TrendingDown className="h-3.5 w-3.5" />, color: 'text-red-600 dark:text-red-400', badgeClass: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300' };
}

// ─── Custom Tooltip ──────────────────────────────────────────────────────────

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  const montoVar = variationLabel(d?.montoPct ?? null);
  const primaVar = variationLabel(d?.primaPct ?? null);
  const ticketVar = variationLabel(d?.ticketPct ?? null);
  const primaAvgVar = variationLabel(d?.primaAvgPct ?? null);

  return (
    <div className="bg-background border rounded-xl p-4 shadow-xl min-w-[240px] space-y-3">
      <p className="font-semibold text-sm">{label}</p>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <DollarSign className="h-3.5 w-3.5 text-emerald-500" />
            Monto Pagado
          </span>
          <span className="font-mono text-xs font-semibold">{formatCLP(d?.monto ?? 0)}</span>
        </div>
        {montoVar && (
          <div className="flex justify-end">
            <span className={`flex items-center gap-1 text-xs font-medium ${montoVar.color}`}>
              {montoVar.icon}{montoVar.label} vs mes anterior
            </span>
          </div>
        )}
      </div>

      <div className="border-t pt-2 space-y-1.5">
        <div className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Receipt className="h-3.5 w-3.5 text-amber-500" />
            Ticket Promedio
          </span>
          <span className="font-mono text-xs font-semibold">{formatCLP(d?.ticketPromedio ?? 0)}</span>
        </div>
        {ticketVar && (
          <div className="flex justify-end">
            <span className={`flex items-center gap-1 text-xs font-medium ${ticketVar.color}`}>
              {ticketVar.icon}{ticketVar.label} vs mes anterior
            </span>
          </div>
        )}
      </div>

      <div className="border-t pt-2 space-y-1.5">
        <div className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5 text-indigo-500" />
            Prima Recuperada
          </span>
          <span className="font-mono text-xs font-semibold">{formatCLP(d?.prima ?? 0)}</span>
        </div>
        {primaVar && (
          <div className="flex justify-end">
            <span className={`flex items-center gap-1 text-xs font-medium ${primaVar.color}`}>
              {primaVar.icon}{primaVar.label} vs mes anterior
            </span>
          </div>
        )}
      </div>

      <div className="border-t pt-2 space-y-1.5">
        <div className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <BarChart2 className="h-3.5 w-3.5 text-violet-500" />
            Prima Promedio
          </span>
          <span className="font-mono text-xs font-semibold">{formatCLP(d?.primaPromedio ?? 0)}</span>
        </div>
        {primaAvgVar && (
          <div className="flex justify-end">
            <span className={`flex items-center gap-1 text-xs font-medium ${primaAvgVar.color}`}>
              {primaAvgVar.icon}{primaAvgVar.label} vs mes anterior
            </span>
          </div>
        )}
      </div>

      <div className="border-t pt-2">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Solicitudes pagadas</span>
          <span className="font-semibold text-foreground">{d?.count ?? 0}</span>
        </div>
      </div>
    </div>
  );
};

// ─── Helper: agregación mensual a partir de un set de refunds ────────────────

function buildMonthlyData(refunds: any[]) {
  const paidRefunds = refunds.filter((r: any) => r.status === 'paid');
  const byMonth: Record<string, { monto: number; prima: number; count: number }> = {};

  paidRefunds.forEach((r: any) => {
    const paidEntry = r.statusHistory?.slice().reverse().find(
      (e: any) => e.to?.toLowerCase() === 'paid'
    );
    const dateStr = paidEntry?.at || r.createdAt;
    if (!dateStr) return;

    const monthKey = format(startOfMonth(parseISO(dateStr.split('T')[0])), 'yyyy-MM');
    if (!byMonth[monthKey]) byMonth[monthKey] = { monto: 0, prima: 0, count: 0 };

    const realAmountEntry = r.statusHistory?.slice().reverse().find((e: any) => {
      const s = e.to?.toLowerCase();
      return (s === 'payment_scheduled' || s === 'paid') && e.realAmount;
    });
    byMonth[monthKey].monto += realAmountEntry?.realAmount || 0;

    const newMonthlyPremium = r.calculationSnapshot?.newMonthlyPremium || 0;
    const remainingInstallments = r.calculationSnapshot?.remainingInstallments || 0;
    byMonth[monthKey].prima += newMonthlyPremium * remainingInstallments;
    byMonth[monthKey].count += 1;
  });

  const sorted = Object.entries(byMonth)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, vals]) => ({ monthKey: key, ...vals }));

  return sorted.map((item, i) => {
    const prev = sorted[i - 1];
    const ticketPromedio = item.count > 0 ? item.monto / item.count : 0;
    const primaPromedio = item.count > 0 ? item.prima / item.count : 0;
    const prevTicket = prev && prev.count > 0 ? prev.monto / prev.count : 0;
    const prevPrimaAvg = prev && prev.count > 0 ? prev.prima / prev.count : 0;

    const montoPct = prev && prev.monto > 0 ? ((item.monto - prev.monto) / prev.monto) * 100 : null;
    const primaPct = prev && prev.prima > 0 ? ((item.prima - prev.prima) / prev.prima) * 100 : null;
    const ticketPct = prev && prevTicket > 0 ? ((ticketPromedio - prevTicket) / prevTicket) * 100 : null;
    const primaAvgPct = prev && prevPrimaAvg > 0 ? ((primaPromedio - prevPrimaAvg) / prevPrimaAvg) * 100 : null;

    return {
      ...item,
      ticketPromedio,
      primaPromedio,
      label: format(parseISO(`${item.monthKey}-01`), 'MMM yyyy', { locale: es }),
      labelShort: format(parseISO(`${item.monthKey}-01`), 'MMM yy', { locale: es }),
      montoPct,
      primaPct,
      ticketPct,
      primaAvgPct,
    };
  });
}

function buildTotals(monthlyData: ReturnType<typeof buildMonthlyData>) {
  const totalMonto = monthlyData.reduce((s, d) => s + d.monto, 0);
  const totalPrima = monthlyData.reduce((s, d) => s + d.prima, 0);
  const totalCount = monthlyData.reduce((s, d) => s + d.count, 0);
  const ticketPromedioGlobal = totalCount > 0 ? totalMonto / totalCount : 0;
  const primaPromedioGlobal = totalCount > 0 ? totalPrima / totalCount : 0;
  const last = monthlyData[monthlyData.length - 1];
  return { totalMonto, totalPrima, totalCount, ticketPromedioGlobal, primaPromedioGlobal, last };
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function TabDetalleFinanciero() {
  // Dos universos paralelos:
  //   - Cohorte: solicitudes CREADAS en el año (listV2 / createdAt)
  //   - Caja real: solicitudes PAGADAS en el año (listV3 + filtro client-side)
  const { data: cohortRefunds = [], isLoading: loadingCohort } = useDetalleFinancieroRefunds();
  const { data: cashflowRefunds = [], isLoading: loadingCashflow } = useDetalleFinancieroCashflow();
  const isLoading = loadingCohort || loadingCashflow;
  const currentYear = new Date().getFullYear();

  const cohortMonthly = useMemo(() => buildMonthlyData(cohortRefunds), [cohortRefunds]);
  const cashflowMonthly = useMemo(() => buildMonthlyData(cashflowRefunds), [cashflowRefunds]);
  const cohortTotals = useMemo(() => buildTotals(cohortMonthly), [cohortMonthly]);
  const cashflowTotals = useMemo(() => buildTotals(cashflowMonthly), [cashflowMonthly]);

  // El gráfico de Plan de cumplimiento usa la caja real del año (lo recuperado en el período).
  const monthlyData = cashflowMonthly;
  const totals = cashflowTotals;

  const handleExport = useCallback(() => {
    const timestamp = new Date().toISOString().slice(0, 10);

    // ── Hoja 1: Detalle mensual ───────────────────────────────────────────────
    const monthlyRows = [...monthlyData].reverse().map(row => ({
      'Mes': row.label,
      'Solicitudes Pagadas': row.count,
      'Monto Total Pagado (CLP)': row.monto,
      'Δ Monto (%)': row.montoPct !== null ? Number(row.montoPct.toFixed(2)) : '',
      'Ticket Promedio (CLP)': Math.round(row.ticketPromedio),
      'Δ Ticket Promedio (%)': row.ticketPct !== null ? Number(row.ticketPct.toFixed(2)) : '',
      'Prima Total Recuperada (CLP)': Math.round(row.prima),
      'Δ Prima (%)': row.primaPct !== null ? Number(row.primaPct.toFixed(2)) : '',
      'Prima Promedio (CLP)': Math.round(row.primaPromedio),
      'Δ Prima Promedio (%)': row.primaAvgPct !== null ? Number(row.primaAvgPct.toFixed(2)) : '',
    }));

    // ── Hoja 2: Resumen de totales del año en curso ──────────────────────────
    const summaryRows = [
      { 'Métrica': `Total solicitudes pagadas (año ${currentYear})`, 'Valor': totals.totalCount },
      { 'Métrica': `Monto total pagado a clientes (año ${currentYear})`, 'Valor': totals.totalMonto },
      { 'Métrica': `Ticket promedio global (año ${currentYear})`, 'Valor': Math.round(totals.ticketPromedioGlobal) },
      { 'Métrica': `Prima total recuperada (año ${currentYear})`, 'Valor': Math.round(totals.totalPrima) },
      { 'Métrica': `Prima promedio global (año ${currentYear})`, 'Valor': Math.round(totals.primaPromedioGlobal) },
      { 'Métrica': '', 'Valor': '' },
      { 'Métrica': 'Meses con datos registrados', 'Valor': monthlyData.length },
      { 'Métrica': 'Fecha de exportación', 'Valor': new Date().toLocaleDateString('es-CL') },
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(monthlyRows), 'Detalle Mensual');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryRows), `Resumen ${currentYear}`);
    XLSX.writeFile(wb, `detalle-financiero-${currentYear}-${timestamp}.xlsx`);
  }, [monthlyData, totals, currentYear]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Card key={i}><CardContent className="pt-6"><Skeleton className="h-20 w-full" /></CardContent></Card>
          ))}
        </div>
        <Card><CardContent className="pt-6"><Skeleton className="h-80 w-full" /></CardContent></Card>
      </div>
    );
  }

  const lastVar = variationLabel(totals.last?.montoPct ?? null);
  const lastPrimaVar = variationLabel(totals.last?.primaPct ?? null);
  const lastTicketVar = variationLabel(totals.last?.ticketPct ?? null);
  const lastPrimaAvgVar = variationLabel(totals.last?.primaAvgPct ?? null);

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Detalle Financiero · Año {currentYear}</h2>
        <div className="flex-1 h-px bg-border" />
        <Badge variant="outline" className="text-xs">Solicitudes creadas en {currentYear}</Badge>
        <Button variant="outline" size="sm" onClick={handleExport} disabled={monthlyData.length === 0}>
          <Download className="h-4 w-4 mr-2" />
          Exportar Excel
        </Button>
      </div>

      {/* KPIs superiores — fila 1: totales */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Monto total histórico */}
        <Card className="border-l-4 border-l-emerald-500 bg-emerald-50/30 dark:bg-emerald-950/10">
          <CardHeader className="pb-1">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">Monto Total Pagado</CardTitle>
              <DollarSign className="h-5 w-5 text-emerald-500" />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">{formatCLP(totals.totalMonto, true)}</p>
            <p className="text-xs text-muted-foreground mt-1">{totals.totalCount} solicitudes · año {currentYear}</p>
            {lastVar && (
              <div className={`flex items-center gap-1 mt-2 text-xs font-medium ${lastVar.color}`}>
                {lastVar.icon}<span>{lastVar.label} vs mes anterior</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Ticket promedio histórico */}
        <Card className="border-l-4 border-l-amber-500 bg-amber-50/30 dark:bg-amber-950/10">
          <CardHeader className="pb-1">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">Ticket Promedio</CardTitle>
              <Receipt className="h-5 w-5 text-amber-500" />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-amber-700 dark:text-amber-400">{formatCLP(totals.ticketPromedioGlobal, true)}</p>
            <p className="text-xs text-muted-foreground mt-1">Por solicitud pagada · año {currentYear}</p>
            {lastTicketVar && (
              <div className={`flex items-center gap-1 mt-2 text-xs font-medium ${lastTicketVar.color}`}>
                {lastTicketVar.icon}<span>{lastTicketVar.label} último mes</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Prima total histórica */}
        <Card className="border-l-4 border-l-indigo-500 bg-indigo-50/30 dark:bg-indigo-950/10">
          <CardHeader className="pb-1">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">Prima Total Recuperada</CardTitle>
              <ShieldCheck className="h-5 w-5 text-indigo-500" />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-indigo-700 dark:text-indigo-400">{formatCLP(totals.totalPrima, true)}</p>
            <p className="text-xs text-muted-foreground mt-1">Año {currentYear}</p>
            {lastPrimaVar && (
              <div className={`flex items-center gap-1 mt-2 text-xs font-medium ${lastPrimaVar.color}`}>
                {lastPrimaVar.icon}<span>{lastPrimaVar.label} vs mes anterior</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Prima promedio histórica */}
        <Card className="border-l-4 border-l-violet-500 bg-violet-50/30 dark:bg-violet-950/10">
          <CardHeader className="pb-1">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">Prima Promedio</CardTitle>
              <BarChart2 className="h-5 w-5 text-violet-500" />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-violet-700 dark:text-violet-400">{formatCLP(totals.primaPromedioGlobal, true)}</p>
            <p className="text-xs text-muted-foreground mt-1">Por solicitud pagada · año {currentYear}</p>
            {lastPrimaAvgVar && (
              <div className={`flex items-center gap-1 mt-2 text-xs font-medium ${lastPrimaAvgVar.color}`}>
                {lastPrimaAvgVar.icon}<span>{lastPrimaAvgVar.label} último mes</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Gráfico: Monto Total Pagado por mes */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Monto Pagado a Clientes · por Mes</CardTitle>
          <CardDescription>Evolución histórica del monto real entregado a clientes. Las barras muestran el total del mes; el color indica si creció (verde) o bajó (rojo) respecto al mes anterior.</CardDescription>
        </CardHeader>
        <CardContent>
          {monthlyData.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">No hay datos de pagos registrados</div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={monthlyData} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="labelShort" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={11}
                  tickFormatter={v => formatCLP(v, true)}
                  width={75}
                />
                <Tooltip content={<CustomTooltip />} />
                <ReferenceLine y={0} stroke="hsl(var(--border))" />
                <Bar dataKey="monto" radius={[4, 4, 0, 0]} name="Monto pagado">
                  {monthlyData.map((entry, index) => {
                    const isPositive = entry.montoPct === null || entry.montoPct >= 0;
                    return (
                      <Cell
                        key={`cell-${index}`}
                        fill={isPositive ? 'hsl(142, 71%, 45%)' : 'hsl(0, 84%, 60%)'}
                        fillOpacity={0.85}
                      />
                    );
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* ── Plan de cumplimiento ────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Plan de Cumplimiento · Prima Recuperada</h2>
          <div className="flex-1 h-px bg-border" />
        </div>
        <PlanCumplimientoChart monthlyData={monthlyData} />
      </div>

      {/* Gráfico: Prima Recuperada por mes */}
      <Card>

        <CardHeader>
          <CardTitle className="text-base">Prima Total Recuperada · por Mes</CardTitle>
          <CardDescription>Prima acumulada de todas las solicitudes pagadas en el mes. Refleja el valor recuperado del seguro original.</CardDescription>
        </CardHeader>
        <CardContent>
          {monthlyData.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">No hay datos registrados</div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={monthlyData} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="labelShort" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={11}
                  tickFormatter={v => formatCLP(v, true)}
                  width={75}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="prima" radius={[4, 4, 0, 0]} name="Prima recuperada">
                  {monthlyData.map((entry, index) => {
                    const isPositive = entry.primaPct === null || entry.primaPct >= 0;
                    return (
                      <Cell
                        key={`cell-p-${index}`}
                        fill={isPositive ? 'hsl(239, 84%, 67%)' : 'hsl(0, 84%, 60%)'}
                        fillOpacity={0.85}
                      />
                    );
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Tabla resumen mensual */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Resumen Mensual Detallado</CardTitle>
          <CardDescription>Valores y variaciones mes a mes. La columna Δ muestra el cambio porcentual respecto al mes anterior.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Mes</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Solic.</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Monto Pagado</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Δ</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Ticket Prom.</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Δ</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Prima Recuperada</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Δ</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Prima Prom.</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Δ</th>
                </tr>
              </thead>
              <tbody>
                {[...monthlyData].reverse().map((row, i) => {
                  const mVar = variationLabel(row.montoPct);
                  const pVar = variationLabel(row.primaPct);
                  const tVar = variationLabel(row.ticketPct);
                  const paVar = variationLabel(row.primaAvgPct);
                  const deltaCell = (v: ReturnType<typeof variationLabel>) =>
                    v ? (
                      <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${v.color}`}>
                        {v.icon}{v.label}
                      </span>
                    ) : <span className="text-muted-foreground text-xs">—</span>;
                  return (
                    <tr key={row.monthKey} className={`border-b transition-colors hover:bg-muted/30 ${i === 0 ? 'font-medium bg-muted/20' : ''}`}>
                      <td className="px-4 py-3 capitalize">{row.label}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{row.count}</td>
                      <td className="px-4 py-3 text-right tabular-nums font-medium">{formatCLP(row.monto)}</td>
                      <td className="px-4 py-3 text-right">{deltaCell(mVar)}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-amber-700 dark:text-amber-400 font-medium">{formatCLP(row.ticketPromedio)}</td>
                      <td className="px-4 py-3 text-right">{deltaCell(tVar)}</td>
                      <td className="px-4 py-3 text-right tabular-nums font-medium">{formatCLP(row.prima)}</td>
                      <td className="px-4 py-3 text-right">{deltaCell(pVar)}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-violet-700 dark:text-violet-400 font-medium">{formatCLP(row.primaPromedio)}</td>
                      <td className="px-4 py-3 text-right">{deltaCell(paVar)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
