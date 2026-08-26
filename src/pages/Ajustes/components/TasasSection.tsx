import { useState, useMemo, useCallback, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  ShieldCheck, Briefcase, Download, Info, Building2, Sparkles, UserRound, Users,
  Plus, Pencil, Trash2, RefreshCw, Cloud, AlertTriangle, ArrowRight, Zap,
  Search,
} from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { useBankCesantiaRates, useTdvCesantiaRates, useBankRateMatrix, useRatesMutations } from '@/hooks/useRates';
import type { MonthlyRateRanges, RateRangeInput } from '@/services/ratesService';

// ─── Constantes de tasas TDV desgravamen ────────────────────────────────────

const TDV_DESGRAVAMEN_TASAS = [
  {
    tramo: 'Tramo 1',
    edadRango: 'Hasta 55 años',
    tasa: 0.0029704,
    descripcion: 'Tasa mensual TDV para clientes de hasta 55 años. Se aplica sobre el saldo insoluto del crédito.',
  },
  {
    tramo: 'Tramo 2',
    edadRango: 'Desde 56 años',
    tasa: 0.0037379,
    descripcion: 'Tasa mensual TDV para clientes de 56 años o más. Se aplica sobre el saldo insoluto del crédito.',
  },
];

const TDV_CESANTIA_KEY = 'TE_DEVUELVO_CESANTIA';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatTasa(tasa: number): string {
  return `${(tasa * 100).toFixed(4)}%`;
}

function formatMontoCLP(monto: number): string {
  if (monto >= 1_000_000) return `$${(monto / 1_000_000).toFixed(0)}M`;
  if (monto >= 1_000) return `$${(monto / 1_000).toFixed(0)}K`;
  return `$${monto}`;
}

function rangeLabel(r?: { desde: number; hasta: number | null }): string {
  if (!r) return '—';
  return `${formatMontoCLP(r.desde)} – ${r.hasta === null ? '∞' : formatMontoCLP(r.hasta)}`;
}

function sortTramoKeys(keys: string[]): string[] {
  return [...keys].sort((a, b) => {
    const na = Number(a.replace(/\D/g, '')) || 0;
    const nb = Number(b.replace(/\D/g, '')) || 0;
    return na - nb || a.localeCompare(b);
  });
}

function getTasaColorClass(tasa: number, minTasa: number, maxTasa: number): string {
  if (maxTasa === minTasa) return '';
  const ratio = (tasa - minTasa) / (maxTasa - minTasa);
  if (ratio < 0.2) return 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300';
  if (ratio < 0.4) return 'bg-lime-50 dark:bg-lime-950/30 text-lime-800 dark:text-lime-300';
  if (ratio < 0.6) return 'bg-yellow-50 dark:bg-yellow-950/30 text-yellow-800 dark:text-yellow-300';
  if (ratio < 0.8) return 'bg-orange-50 dark:bg-orange-950/30 text-orange-800 dark:text-orange-300';
  return 'bg-red-50 dark:bg-red-950/30 text-red-800 dark:text-red-300';
}

function errMsg(e: unknown) {
  return e instanceof Error ? e.message : 'Error inesperado';
}

// ─── Sub-componentes generales ───────────────────────────────────────────────

function SectionHeader({
  icon: Icon, title, description, color, action,
}: { icon: React.ElementType; title: string; description: string; color: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 mb-6">
      <div className="flex items-start gap-3">
        <div className={`p-2 rounded-lg ${color} shrink-0 mt-0.5`}>
          <Icon className="h-4 w-4 text-white" />
        </div>
        <div>
          <h3 className="font-semibold text-sm">{title}</h3>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{description}</p>
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-9 w-full" />
      ))}
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 flex items-start gap-3">
      <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
      <div className="flex-1">
        <p className="text-sm font-medium text-destructive">No se pudieron cargar las tasas</p>
        <p className="text-xs text-muted-foreground mt-0.5">{message}</p>
      </div>
      <Button size="sm" variant="outline" onClick={onRetry} className="gap-1.5">
        <RefreshCw className="h-3.5 w-3.5" /> Reintentar
      </Button>
    </div>
  );
}

// ─── Diálogo: editar tramo mensual ───────────────────────────────────────────

interface RangeEditState {
  scope: 'bank' | 'tdv';
  owner: string;
  tramo: string;
  desde: number;
  hasta: number | null;
  tasa_mensual: number;
}

// ─── Confirmación de cambio crítico de tasas ─────────────────────────────────

interface CriticalChangeRow {
  label: string;
  before: string;
  after: string;
  changed: boolean;
}

function CriticalRateConfirmDialog({
  open, onOpenChange, context, rows, onConfirm, pending,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  context: string;
  rows: CriticalChangeRow[];
  onConfirm: () => void;
  pending?: boolean;
}) {
  const [ack, setAck] = useState(false);
  useEffect(() => { if (!open) setAck(false); }, [open]);

  return (
    <AlertDialog open={open} onOpenChange={(o) => { if (!pending) onOpenChange(o); }}>
      <AlertDialogContent className="sm:max-w-lg">
        <AlertDialogHeader>
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <AlertTriangle className="h-5 w-5" />
            </span>
            <div className="space-y-1">
              <AlertDialogTitle>Cambio crítico de tasas</AlertDialogTitle>
              <AlertDialogDescription className="text-left">
                Esta modificación se aplica <strong>de forma instantánea</strong> al cálculo de
                devoluciones en el portal <strong>Te Devuelvo</strong> y en la <strong>Calculadora</strong>.
                Las simulaciones y montos estimados posteriores usarán la nueva tasa.
              </AlertDialogDescription>
            </div>
          </div>
        </AlertDialogHeader>

        <div className="rounded-lg border border-border/70 overflow-hidden">
          <div className="px-3 py-2 bg-muted/40 text-xs font-medium text-muted-foreground">{context}</div>
          <div className="divide-y divide-border/60">
            {rows.map((r) => (
              <div key={r.label} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                <span className="text-muted-foreground">{r.label}</span>
                <span className="flex items-center gap-2 font-mono text-xs">
                  <span className={r.changed ? 'text-muted-foreground line-through' : 'text-muted-foreground'}>{r.before}</span>
                  {r.changed && (
                    <>
                      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="font-semibold text-foreground">{r.after}</span>
                    </>
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>

        <label className="flex items-start gap-3 rounded-lg border border-border/70 bg-muted/20 px-3 py-3 cursor-pointer">
          <Checkbox checked={ack} onCheckedChange={(v) => setAck(v === true)} className="mt-0.5" />
          <span className="text-sm leading-snug">
            Entiendo que este cambio impacta inmediatamente los cálculos de devolución en producción.
          </span>
        </label>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            disabled={!ack || pending}
            onClick={(e) => { e.preventDefault(); onConfirm(); }}
          >
            <Zap className="h-4 w-4" />
            {pending ? 'Aplicando…' : 'Aplicar cambio'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function RangeEditDialog({
  state, onClose,
}: { state: RangeEditState | null; onClose: () => void }) {
  const { updateBankRange, updateTdvRange } = useRatesMutations();
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [tasa, setTasa] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    if (!state) return;
    setDesde(String(state.desde));
    setHasta(state.hasta === null ? '' : String(state.hasta));
    setTasa(String(state.tasa_mensual * 100));
    setConfirmOpen(false);
  }, [state]);

  const saving = updateBankRange.isPending || updateTdvRange.isPending;

  const requestSave = () => {
    if (!state) return;
    if (!isFinite(Number(desde)) || desde.trim() === '' || !isFinite(Number(tasa)) || tasa.trim() === '') {
      toast.error('Valores inválidos');
      return;
    }
    setConfirmOpen(true);
  };

  const fmtCLP = (v: number | null) => (v === null ? 'Sin límite' : `$${v.toLocaleString('es-CL')}`);
  const confirmRows: CriticalChangeRow[] = state ? [
    {
      label: 'Tasa mensual',
      before: `${(state.tasa_mensual * 100).toFixed(4)}%`,
      after: `${(Number(tasa) || 0).toFixed(4)}%`,
      changed: Number(tasa) !== state.tasa_mensual * 100,
    },
    {
      label: 'Desde',
      before: fmtCLP(state.desde),
      after: fmtCLP(Number(desde)),
      changed: Number(desde) !== state.desde,
    },
    {
      label: 'Hasta',
      before: fmtCLP(state.hasta),
      after: fmtCLP(hasta.trim() === '' ? null : Number(hasta)),
      changed: (hasta.trim() === '' ? null : Number(hasta)) !== state.hasta,
    },
  ] : [];

  const handleSave = async () => {
    if (!state) return;
    const patch = {
      desde: Number(desde),
      hasta: hasta.trim() === '' ? null : Number(hasta),
      tasa_mensual: Number(tasa) / 100,
    };
    if (!isFinite(patch.desde) || !isFinite(patch.tasa_mensual)) {
      toast.error('Valores inválidos');
      return;
    }
    try {
      if (state.scope === 'bank') {
        await updateBankRange.mutateAsync({ bankName: state.owner, rangeName: state.tramo, patch });
      } else {
        await updateTdvRange.mutateAsync({ name: state.owner, rangeName: state.tramo, patch });
      }
      toast.success('Tramo actualizado');
      setConfirmOpen(false);
      onClose();
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  return (
    <>
    <Dialog open={!!state} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar tramo</DialogTitle>
          <DialogDescription>
            {state?.owner} · {state?.tramo}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="desde">Desde (CLP)</Label>
              <Input id="desde" type="number" value={desde} onChange={(e) => setDesde(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="hasta">Hasta (CLP)</Label>
              <Input id="hasta" type="number" placeholder="Sin límite" value={hasta} onChange={(e) => setHasta(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tasa">Tasa mensual (%)</Label>
            <Input id="tasa" type="number" step="0.0001" value={tasa} onChange={(e) => setTasa(e.target.value)} />
            <p className="text-xs text-muted-foreground">
              Valor almacenado: {(Number(tasa) / 100 || 0).toFixed(6)}
            </p>
          </div>
          <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-muted-foreground">
            <AlertTriangle className="h-4 w-4 shrink-0 text-destructive mt-0.5" />
            <span>Cambio crítico: impacta de inmediato los cálculos de devolución en el portal Te Devuelvo y la Calculadora.</span>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={requestSave} disabled={saving}>{saving ? 'Guardando…' : 'Revisar y guardar'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    <CriticalRateConfirmDialog
      open={confirmOpen}
      onOpenChange={setConfirmOpen}
      context={`Cesantía · ${state?.owner ?? ''} · ${state?.tramo ?? ''}`}
      rows={confirmRows}
      onConfirm={handleSave}
      pending={saving}
    />
    </>
  );
}

// ─── Diálogo: crear entidad de tasas mensuales ───────────────────────────────

const DEFAULT_TRAMOS: RateRangeInput[] = [
  { tramo: 'tramo_1', orden: 1, desde: 500000, hasta: 1000000, tasa_mensual: 0 },
  { tramo: 'tramo_2', orden: 2, desde: 1000001, hasta: 3000000, tasa_mensual: 0 },
  { tramo: 'tramo_3', orden: 3, desde: 3000001, hasta: 5000000, tasa_mensual: 0 },
  { tramo: 'tramo_4', orden: 4, desde: 5000001, hasta: 7000000, tasa_mensual: 0 },
  { tramo: 'tramo_5', orden: 5, desde: 7000001, hasta: null, tasa_mensual: 0 },
];

function CreateMonthlyRateDialog({
  open, onOpenChange, scope, nextOrden,
}: { open: boolean; onOpenChange: (o: boolean) => void; scope: 'bank' | 'tdv'; nextOrden: number }) {
  const { createBank, createTdv } = useRatesMutations();
  const [nombre, setNombre] = useState('');
  const [tramos, setTramos] = useState<RateRangeInput[]>(DEFAULT_TRAMOS);

  useEffect(() => {
    if (open) { setNombre(''); setTramos(DEFAULT_TRAMOS); }
  }, [open]);

  const saving = createBank.isPending || createTdv.isPending;

  const handleCreate = async () => {
    if (!nombre.trim()) { toast.error('Ingresa un nombre'); return; }
    try {
      if (scope === 'bank') {
        await createBank.mutateAsync({ banco: nombre.trim().toUpperCase(), orden: nextOrden, tramos });
      } else {
        await createTdv.mutateAsync({ nombre: nombre.trim().toUpperCase(), orden: nextOrden, tramos });
      }
      toast.success(scope === 'bank' ? 'Entidad creada' : 'Configuración creada');
      onOpenChange(false);
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  const setTasa = (idx: number, value: string) => {
    setTramos((prev) => prev.map((t, i) => (i === idx ? { ...t, tasa_mensual: Number(value) / 100 || 0 } : t)));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{scope === 'bank' ? 'Nueva entidad de cesantía' : 'Nueva configuración TDV'}</DialogTitle>
          <DialogDescription>Define la tasa mensual para cada tramo de monto.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="nombre">{scope === 'bank' ? 'Institución' : 'Nombre de configuración'}</Label>
            <Input
              id="nombre"
              placeholder={scope === 'bank' ? 'BANCO EJEMPLO' : 'TE_DEVUELVO_CESANTIA'}
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
            />
          </div>
          <div className="rounded-lg border divide-y">
            {tramos.map((t, i) => (
              <div key={t.tramo} className="flex items-center gap-3 px-3 py-2">
                <span className="text-xs font-medium w-20">{t.tramo}</span>
                <span className="text-xs text-muted-foreground flex-1">{rangeLabel(t)}</span>
                <div className="flex items-center gap-1">
                  <Input
                    className="h-8 w-24 text-right font-mono text-xs"
                    type="number"
                    step="0.0001"
                    value={t.tasa_mensual * 100 || ''}
                    onChange={(e) => setTasa(i, e.target.value)}
                  />
                  <span className="text-xs text-muted-foreground">%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleCreate} disabled={saving}>{saving ? 'Creando…' : 'Crear'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Tabla cesantía (bancos + TDV) ───────────────────────────────────────────

function TablaCesantia() {
  const bankQuery = useBankCesantiaRates();
  const tdvQuery = useTdvCesantiaRates();
  const { deleteBank } = useRatesMutations();

  const [editing, setEditing] = useState<RangeEditState | null>(null);
  const [creating, setCreating] = useState<null | 'bank' | 'tdv'>(null);
  const [toDelete, setToDelete] = useState<string | null>(null);

  const bancos = bankQuery.data ?? {};
  const tdvConfigs = tdvQuery.data ?? {};
  const tdvTasas: MonthlyRateRanges = tdvConfigs[TDV_CESANTIA_KEY] ?? Object.values(tdvConfigs)[0] ?? {};
  const tdvName = tdvConfigs[TDV_CESANTIA_KEY] ? TDV_CESANTIA_KEY : Object.keys(tdvConfigs)[0] ?? TDV_CESANTIA_KEY;

  const tramosKeys = useMemo(() => {
    const set = new Set<string>(Object.keys(tdvTasas));
    Object.values(bancos).forEach((r) => Object.keys(r).forEach((k) => set.add(k)));
    return sortTramoKeys(Array.from(set));
  }, [bancos, tdvTasas]);

  const bancosNombres = Object.keys(bancos);

  function getAhorroPct(banco: string, tramo: string): number | null {
    const bancoDato = bancos[banco]?.[tramo];
    const tdvDato = tdvTasas[tramo];
    if (!bancoDato || !tdvDato || bancoDato.tasa_mensual === 0) return null;
    return ((bancoDato.tasa_mensual - tdvDato.tasa_mensual) / bancoDato.tasa_mensual) * 100;
  }

  const handleDelete = async () => {
    if (!toDelete) return;
    try {
      await deleteBank.mutateAsync(toDelete);
      toast.success('Entidad eliminada');
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setToDelete(null);
    }
  };

  if (bankQuery.isLoading || tdvQuery.isLoading) return <TableSkeleton />;
  if (bankQuery.isError) return <ErrorState message={errMsg(bankQuery.error)} onRetry={() => bankQuery.refetch()} />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Haz clic en el ícono de edición de cada celda para actualizar la tasa del tramo.
        </p>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setCreating('tdv')}>
            <Plus className="h-3.5 w-3.5" /> Configuración TDV
          </Button>
          <Button size="sm" className="gap-1.5" onClick={() => setCreating('bank')}>
            <Plus className="h-3.5 w-3.5" /> Nueva entidad
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-border/60 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground min-w-[160px]">Institución</th>
                {tramosKeys.map((t) => (
                  <th key={t} className="text-right px-3 py-3 font-medium text-muted-foreground whitespace-nowrap">
                    {rangeLabel(tdvTasas[t] ?? Object.values(bancos).map((b) => b[t]).find(Boolean))}
                  </th>
                ))}
                <th className="text-right px-4 py-3 font-medium text-muted-foreground whitespace-nowrap min-w-[100px]">Ahorro TDV</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {/* Fila TDV */}
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
                {tramosKeys.map((t) => {
                  const dato = tdvTasas[t];
                  return (
                    <td key={t} className="px-3 py-3 text-right font-mono font-bold text-emerald-700 dark:text-emerald-400">
                      <span className="inline-flex items-center gap-1 justify-end">
                        {dato ? formatTasa(dato.tasa_mensual) : '—'}
                        {dato && (
                          <button
                            className="opacity-40 hover:opacity-100 transition-opacity"
                            aria-label={`Editar ${t} TDV`}
                            onClick={() => setEditing({ scope: 'tdv', owner: tdvName, tramo: t, ...dato })}
                          >
                            <Pencil className="h-3 w-3" />
                          </button>
                        )}
                      </span>
                    </td>
                  );
                })}
                <td className="px-4 py-3 text-right"><span className="text-xs text-muted-foreground/50">—</span></td>
                <td />
              </tr>

              {bancosNombres.map((banco, i) => {
                const ahorros = tramosKeys.map((t) => getAhorroPct(banco, t)).filter((v): v is number => v !== null);
                const ahorroPromedio = ahorros.length > 0 ? ahorros.reduce((a, b) => a + b, 0) / ahorros.length : null;

                return (
                  <tr key={banco} className={`border-b transition-colors hover:bg-muted/30 ${i % 2 === 0 ? '' : 'bg-muted/10'}`}>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="font-medium text-xs">{banco}</span>
                      </div>
                    </td>
                    {tramosKeys.map((t) => {
                      const dato = bancos[banco][t];
                      const ahorroPct = getAhorroPct(banco, t);
                      return (
                        <td key={t} className="px-3 py-2.5 text-right font-mono text-xs">
                          <span className="inline-flex items-center gap-1 justify-end group">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="cursor-default">{dato ? formatTasa(dato.tasa_mensual) : '—'}</span>
                                </TooltipTrigger>
                                {ahorroPct !== null && (
                                  <TooltipContent side="top" className="text-xs">
                                    TDV ahorra <strong>{ahorroPct.toFixed(1)}%</strong> en este tramo
                                  </TooltipContent>
                                )}
                              </Tooltip>
                            </TooltipProvider>
                            {dato && (
                              <button
                                className="opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity"
                                aria-label={`Editar ${t} de ${banco}`}
                                onClick={() => setEditing({ scope: 'bank', owner: banco, tramo: t, ...dato })}
                              >
                                <Pencil className="h-3 w-3" />
                              </button>
                            )}
                          </span>
                        </td>
                      );
                    })}
                    <td className="px-4 py-2.5 text-right">
                      {ahorroPromedio !== null ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 px-2 py-0.5 rounded-full">
                          −{ahorroPromedio.toFixed(1)}%
                        </span>
                      ) : '—'}
                    </td>
                    <td className="pr-3">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        aria-label={`Eliminar ${banco}`}
                        onClick={() => setToDelete(banco)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
              {bancosNombres.length === 0 && (
                <tr>
                  <td colSpan={tramosKeys.length + 3} className="px-4 py-10 text-center text-sm text-muted-foreground">
                    No hay entidades configuradas.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <RangeEditDialog state={editing} onClose={() => setEditing(null)} />
      <CreateMonthlyRateDialog
        open={creating !== null}
        onOpenChange={(o) => !o && setCreating(null)}
        scope={creating ?? 'bank'}
        nextOrden={(creating === 'tdv' ? Object.keys(tdvConfigs).length : bancosNombres.length) + 1}
      />
      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar {toDelete}</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminarán todos los tramos de cesantía de esta entidad. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Diálogo: crear matriz de desgravamen ────────────────────────────────────

function CreateMatrixDialog({
  open, onOpenChange, nextOrden,
}: { open: boolean; onOpenChange: (o: boolean) => void; nextOrden: number }) {
  const { createMatrix } = useRatesMutations();
  const [banco, setBanco] = useState('');
  const [monto, setMonto] = useState('2000000');
  const [filas, setFilas] = useState<{ plazo: string; hasta55: string; desde56: string }[]>([
    { plazo: '12', hasta55: '', desde56: '' },
  ]);

  useEffect(() => {
    if (open) {
      setBanco(''); setMonto('2000000');
      setFilas([{ plazo: '12', hasta55: '', desde56: '' }]);
    }
  }, [open]);

  const handleCreate = async () => {
    if (!banco.trim()) { toast.error('Ingresa el nombre del banco'); return; }
    const montoNum = Number(monto);
    if (!montoNum) { toast.error('Monto inválido'); return; }
    const build = (field: 'hasta55' | 'desde56') =>
      filas
        .filter((f) => f.plazo && f[field] !== '')
        .map((f, i) => ({ plazo: Number(f.plazo), orden: i + 1, tasa: Number(f[field]) / 100 }));

    const gruposEdad = [
      { grupo: 'hasta_55', orden: 1, montos: [{ monto: montoNum, orden: 1, plazos: build('hasta55') }] },
      { grupo: 'desde_56', orden: 2, montos: [{ monto: montoNum, orden: 1, plazos: build('desde56') }] },
    ].filter((g) => g.montos[0].plazos.length > 0);

    if (gruposEdad.length === 0) { toast.error('Ingresa al menos una tasa'); return; }

    try {
      await createMatrix.mutateAsync({ banco: banco.trim().toUpperCase(), orden: nextOrden, gruposEdad });
      toast.success('Matriz creada');
      onOpenChange(false);
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nueva matriz de desgravamen</DialogTitle>
          <DialogDescription>
            Crea el banco con un monto inicial. Luego podrás editar cada tasa desde la tabla.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="mbanco">Banco</Label>
              <Input id="mbanco" placeholder="BANCO EJEMPLO" value={banco} onChange={(e) => setBanco(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mmonto">Monto crédito (CLP)</Label>
              <Input id="mmonto" type="number" value={monto} onChange={(e) => setMonto(e.target.value)} />
            </div>
          </div>
          <div className="rounded-lg border">
            <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 px-3 py-2 border-b bg-muted/30 text-xs font-medium text-muted-foreground">
              <span>Plazo</span><span>18–55 (%)</span><span>56+ (%)</span><span />
            </div>
            {filas.map((f, i) => (
              <div key={i} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 px-3 py-2 items-center">
                <Input className="h-8" type="number" value={f.plazo}
                  onChange={(e) => setFilas((p) => p.map((x, j) => (j === i ? { ...x, plazo: e.target.value } : x)))} />
                <Input className="h-8" type="number" step="0.0001" value={f.hasta55}
                  onChange={(e) => setFilas((p) => p.map((x, j) => (j === i ? { ...x, hasta55: e.target.value } : x)))} />
                <Input className="h-8" type="number" step="0.0001" value={f.desde56}
                  onChange={(e) => setFilas((p) => p.map((x, j) => (j === i ? { ...x, desde56: e.target.value } : x)))} />
                <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Quitar fila"
                  onClick={() => setFilas((p) => p.filter((_, j) => j !== i))}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
            <div className="px-3 py-2 border-t">
              <Button size="sm" variant="ghost" className="gap-1.5"
                onClick={() => setFilas((p) => [...p, { plazo: '', hasta55: '', desde56: '' }])}>
                <Plus className="h-3.5 w-3.5" /> Agregar plazo
              </Button>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleCreate} disabled={createMatrix.isPending}>
            {createMatrix.isPending ? 'Creando…' : 'Crear'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Resumen compacto de una matriz bancaria ─────────────────────────────────

function BankMatrixSummary({ data, edad }: { data: import('@/services/ratesService').AgeGroupRates; edad: 'hasta_55' | 'desde_56' }) {
  const datosEdad = data[edad] ?? {};
  const montos = Object.keys(datosEdad).map(Number).sort((a, b) => a - b);
  const cuotasSet = new Set<number>();
  montos.forEach((m) => Object.keys(datosEdad[String(m)] ?? {}).forEach((c) => cuotasSet.add(Number(c))));
  const cuotas = Array.from(cuotasSet).sort((a, b) => a - b);

  let min = Infinity, max = -Infinity;
  montos.forEach((m) => cuotas.forEach((c) => {
    const v = datosEdad[String(m)]?.[String(c)];
    if (typeof v === 'number') { min = Math.min(min, v); max = Math.max(max, v); }
  }));

  return (
    <div className="hidden sm:flex items-center gap-4 text-xs text-muted-foreground">
      <span><strong>{montos.length}</strong> montos</span>
      <span><strong>{cuotas.length}</strong> plazos</span>
      {min !== Infinity && (
        <span className="font-mono">
          {(min * 100).toFixed(4)}% – {(max * 100).toFixed(4)}%
        </span>
      )}
    </div>
  );
}

// ─── Tabla interna de montos × plazos para un banco ──────────────────────────

function BankMatrixTable({
  bankName, data, edad, onEdit, onBulkEdit,
}: {
  bankName: string;
  data: import('@/services/ratesService').AgeGroupRates;
  edad: 'hasta_55' | 'desde_56';
  onEdit: (monto: number, plazo: number, tasa: number) => void;
  onBulkEdit: (plazo: number, montos: number[]) => void;
}) {
  const datosEdad = data[edad] ?? {};
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [q, setQ] = useState('');


  const { montos, cuotas, matriz, minTasa, maxTasa } = useMemo(() => {
    const montosRaw = Object.keys(datosEdad).map(Number).sort((a, b) => a - b);
    const cuotasSet = new Set<number>();
    montosRaw.forEach((m) => Object.keys(datosEdad[String(m)] ?? {}).forEach((c) => cuotasSet.add(Number(c))));
    const cuotasRaw = Array.from(cuotasSet).sort((a, b) => a - b);
    let min = Infinity, max = -Infinity;
    montosRaw.forEach((m) => cuotasRaw.forEach((c) => {
      const v = datosEdad[String(m)]?.[String(c)];
      if (typeof v === 'number') { min = Math.min(min, v); max = Math.max(max, v); }
    }));
    return {
      montos: montosRaw,
      cuotas: cuotasRaw,
      matriz: datosEdad,
      minTasa: min === Infinity ? 0 : min,
      maxTasa: max === -Infinity ? 0 : max,
    };
  }, [datosEdad]);

  const filteredMontos = useMemo(() => {
    if (!q.trim()) return montos;
    const term = q.toLowerCase().replace(/[^\dkm]/gi, '');
    return montos.filter((m) => formatMontoCLP(m).toLowerCase().includes(q.toLowerCase()) || String(m).includes(term));
  }, [montos, q]);

  const totalPages = Math.max(1, Math.ceil(filteredMontos.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageMontos = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filteredMontos.slice(start, start + pageSize);
  }, [filteredMontos, safePage, pageSize]);

  useEffect(() => { setPage(1); }, [q, pageSize, edad, bankName]);

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 pt-2">
        <div className="relative flex-1 max-w-[220px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Buscar monto..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-8 h-8 text-xs"
          />
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>Mostrar</span>
          <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
            <SelectTrigger className="h-8 w-[72px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[10, 20, 50].map((n) => (
                <SelectItem key={n} value={String(n)}>{n}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span>filas · {filteredMontos.length} montos</span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b bg-muted/30">
              <th className="text-left px-4 py-2.5 font-medium text-muted-foreground sticky left-0 bg-muted/30 z-10 min-w-[110px]">
                Monto crédito
              </th>
              {cuotas.map((c) => (
                <th key={c} className="text-center px-3 py-2 font-medium text-muted-foreground whitespace-nowrap min-w-[86px]">
                  <div className="flex flex-col items-center gap-0.5">
                    <span>{c} cuotas</span>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            onClick={() => onBulkEdit(c, filteredMontos)}
                            disabled={filteredMontos.length === 0}
                            className="inline-flex items-center gap-1 text-[10px] font-medium text-primary hover:underline disabled:opacity-40 disabled:no-underline"
                          >
                            <Zap className="h-3 w-3" /> Aplicar a columna
                          </button>
                        </TooltipTrigger>
                        <TooltipContent className="text-xs max-w-[220px]">
                          Actualiza esta columna en los {filteredMontos.length} montos del filtro actual.
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </th>
              ))}

            </tr>
          </thead>
          <tbody>
            {pageMontos.map((monto, rowIdx) => (
              <tr key={monto} className={`border-b ${rowIdx % 2 === 0 ? 'bg-background' : 'bg-muted/10'}`}>
                <td className="px-4 py-2 font-semibold text-xs sticky left-0 bg-inherit z-10 border-r border-border/40">
                  {formatMontoCLP(monto)}
                </td>
                {cuotas.map((c) => {
                  const tasa = matriz[String(monto)]?.[String(c)];
                  const colorClass = typeof tasa === 'number' ? getTasaColorClass(tasa, minTasa, maxTasa) : '';
                  return (
                    <td key={c} className="px-2 py-1.5 text-center">
                      {typeof tasa === 'number' ? (
                        <button
                          className={`inline-block font-mono text-xs font-semibold px-2 py-1 rounded-md hover:ring-2 hover:ring-primary/40 transition-all ${colorClass}`}
                          onClick={() => onEdit(monto, c, tasa)}
                          title="Editar tasa"
                        >
                          {(tasa * 100).toFixed(4)}%
                        </button>
                      ) : (
                        <span className="text-muted-foreground/40 text-xs">—</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
            {pageMontos.length === 0 && (
              <tr>
                <td colSpan={cuotas.length + 1} className="px-4 py-8 text-center text-sm text-muted-foreground">
                  {q ? `No se encontraron montos para "${q}"` : 'Sin datos para este tramo de edad.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {filteredMontos.length > pageSize && (
        <div className="flex items-center justify-between px-4 pb-3">
          <span className="text-xs text-muted-foreground">
            Página {safePage} de {totalPages}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={safePage === 1}
              className="h-8 text-xs"
            >
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage === totalPages}
              className="h-8 text-xs"
            >
              Siguiente
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tabla desgravamen bancario ───────────────────────────────────────────────

function TablaDesgravamenBancos() {
  const matrixQuery = useBankRateMatrix();
  const { updateMatrixRate } = useRatesMutations();
  const data = matrixQuery.data ?? {};
  const bancos = Object.keys(data);

  const [q, setQ] = useState('');
  const [tramoEdad, setTramoEdad] = useState<'hasta_55' | 'desde_56'>('hasta_55');
  const [creating, setCreating] = useState(false);
  const [cellEdit, setCellEdit] = useState<{
    bankName: string; monto: number; plazo: number; valor: string; original: number; edad: 'hasta_55' | 'desde_56';
  } | null>(null);
  const [confirmCell, setConfirmCell] = useState(false);
  const [bulkEdit, setBulkEdit] = useState<{
    bankName: string; plazo: number; montos: number[]; valor: string; edad: 'hasta_55' | 'desde_56';
  } | null>(null);
  const [bulkRunning, setBulkRunning] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ done: 0, total: 0, failed: 0 });

  const applyBulkColumn = async () => {
    if (!bulkEdit) return;
    const tasa = Number(bulkEdit.valor) / 100;
    if (!bulkEdit.valor.trim() || !isFinite(tasa) || tasa <= 0) { toast.error('Tasa inválida'); return; }

    const montos = bulkEdit.montos;
    setBulkRunning(true);
    setBulkProgress({ done: 0, total: montos.length, failed: 0 });

    const CONCURRENCY = 6;
    let cursor = 0;
    let failed = 0;

    const worker = async () => {
      while (cursor < montos.length) {
        const monto = montos[cursor++];
        try {
          await updateMatrixRate.mutateAsync({
            bankName: bulkEdit.bankName,
            ageGroup: bulkEdit.edad,
            amount: monto,
            term: bulkEdit.plazo,
            tasa,
          });
        } catch {
          failed += 1;
        }
        setBulkProgress((p) => ({ ...p, done: p.done + 1, failed }));
      }
    };

    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, montos.length) }, worker));
    setBulkRunning(false);

    if (failed === 0) {
      toast.success(`${montos.length} tasas actualizadas en la columna ${bulkEdit.plazo} cuotas`);
      setBulkEdit(null);
    } else {
      toast.error(`${failed} de ${montos.length} tasas no se pudieron actualizar. Reintenta para completarlas.`);
    }
  };


  const bancosFiltrados = useMemo(() =>
    bancos.filter((b) => b.toLowerCase().includes(q.toLowerCase())),
  [bancos, q]);

  const handleSaveCell = async () => {
    if (!cellEdit) return;
    const tasa = Number(cellEdit.valor) / 100;
    if (!isFinite(tasa)) { toast.error('Tasa inválida'); return; }
    try {
      await updateMatrixRate.mutateAsync({
        bankName: cellEdit.bankName,
        ageGroup: cellEdit.edad,
        amount: cellEdit.monto,
        term: cellEdit.plazo,
        tasa,
      });
      toast.success('Tasa actualizada');
      setConfirmCell(false);
      setCellEdit(null);
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  if (matrixQuery.isLoading) return <TableSkeleton rows={8} />;
  if (matrixQuery.isError) return <ErrorState message={errMsg(matrixQuery.error)} onRetry={() => matrixQuery.refetch()} />;

  return (
    <div className="space-y-5">
      {/* Barra de control: buscador + edad + nuevo banco */}
      <div className="flex flex-col lg:flex-row lg:items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Buscar banco..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-8 h-9"
          />
        </div>

        <div className="flex items-center gap-3 ml-auto">
          <div className="flex rounded-lg border border-border overflow-hidden bg-muted/30">
            {(['hasta_55', 'desde_56'] as const).map((val) => {
              const isActive = tramoEdad === val;
              return (
                <button
                  key={val}
                  onClick={() => setTramoEdad(val)}
                  className={`flex items-center gap-1.5 text-xs px-3 h-8 transition-all font-medium ${
                    isActive ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                  }`}
                >
                  {val === 'hasta_55' ? <UserRound className="h-3.5 w-3.5" /> : <Users className="h-3.5 w-3.5" />}
                  {val === 'hasta_55' ? '18 – 55 años' : '56+ años'}
                </button>
              );
            })}
          </div>

          <Button size="sm" className="gap-1.5" onClick={() => setCreating(true)}>
            <Plus className="h-3.5 w-3.5" /> Nuevo banco
          </Button>
        </div>
      </div>

      {/* Leyenda de color */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-xs text-muted-foreground">Intensidad de tasa:</span>
        {['bg-emerald-50 text-emerald-800', 'bg-lime-50 text-lime-800', 'bg-yellow-50 text-yellow-800', 'bg-orange-50 text-orange-800', 'bg-red-50 text-red-800'].map((cls, i) => (
          <span key={i} className={`text-[10px] font-medium px-2 py-0.5 rounded ${cls}`}>
            {['Muy baja', 'Baja', 'Media', 'Alta', 'Muy alta'][i]}
          </span>
        ))}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger><Info className="h-3.5 w-3.5 text-muted-foreground" /></TooltipTrigger>
            <TooltipContent className="text-xs max-w-[240px]">
              Haz clic en una celda para editar la tasa directamente en el servicio.
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Lista de bancos en acordeones */}
      <div className="rounded-xl border border-border/60 overflow-hidden">
        {bancosFiltrados.length > 0 ? (
          <Accordion type="multiple" defaultValue={bancosFiltrados.slice(0, 1)} className="w-full">
            {bancosFiltrados.map((banco) => (
              <AccordionItem key={banco} value={banco} className="border-b last:border-b-0">
                <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/20 transition-colors">
                  <div className="flex flex-1 items-center justify-between gap-4 pr-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="p-1.5 rounded-md bg-blue-500/10 shrink-0">
                        <Building2 className="h-4 w-4 text-blue-600" />
                      </div>
                      <span className="font-medium text-sm truncate">{banco}</span>
                    </div>
                    <BankMatrixSummary data={data[banco]} edad={tramoEdad} />
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-0 pb-0">
                  <BankMatrixTable
                    bankName={banco}
                    data={data[banco]}
                    edad={tramoEdad}
                    onEdit={(monto, plazo, tasa) =>
                      setCellEdit({ bankName: banco, monto, plazo, valor: String(tasa * 100), original: tasa, edad: tramoEdad })
                    }
                    onBulkEdit={(plazo, montos) =>
                      setBulkEdit({ bankName: banco, plazo, montos, valor: '', edad: tramoEdad })
                    }

                  />
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        ) : (
          <div className="px-4 py-12 text-center text-sm text-muted-foreground">
            {q ? `No se encontraron bancos para "${q}"` : 'No hay bancos configurados.'}
          </div>
        )}
      </div>

      {/* Editar celda */}
      <Dialog open={!!cellEdit} onOpenChange={(o) => !o && setCellEdit(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Editar tasa</DialogTitle>
            <DialogDescription>
              {cellEdit?.bankName} · {cellEdit?.edad === 'hasta_55' ? '18–55 años' : '56+ años'} ·{' '}
              {cellEdit ? `${formatMontoCLP(cellEdit.monto)} · ${cellEdit.plazo} cuotas` : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="cell-tasa">Prima única (%)</Label>
            <Input
              id="cell-tasa"
              type="number"
              step="0.0001"
              value={cellEdit?.valor ?? ''}
              onChange={(e) => setCellEdit((p) => (p ? { ...p, valor: e.target.value } : p))}
            />
          </div>
          <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-muted-foreground">
            <AlertTriangle className="h-4 w-4 shrink-0 text-destructive mt-0.5" />
            <span>Cambio crítico: impacta de inmediato los cálculos de devolución en el portal Te Devuelvo y la Calculadora.</span>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCellEdit(null)}>Cancelar</Button>
            <Button
              onClick={() => {
                if (!cellEdit || !isFinite(Number(cellEdit.valor)) || cellEdit.valor.trim() === '') {
                  toast.error('Tasa inválida');
                  return;
                }
                setConfirmCell(true);
              }}
              disabled={updateMatrixRate.isPending}
            >
              {updateMatrixRate.isPending ? 'Guardando…' : 'Revisar y guardar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CriticalRateConfirmDialog
        open={confirmCell}
        onOpenChange={setConfirmCell}
        context={`Desgravamen · ${cellEdit?.bankName ?? ''} · ${cellEdit?.edad === 'hasta_55' ? '18–55 años' : '56+ años'}${cellEdit ? ` · ${formatMontoCLP(cellEdit.monto)} · ${cellEdit.plazo} cuotas` : ''}`}
        rows={cellEdit ? [{
          label: 'Prima única',
          before: `${(cellEdit.original * 100).toFixed(4)}%`,
          after: `${(Number(cellEdit.valor) || 0).toFixed(4)}%`,
          changed: Number(cellEdit.valor) !== cellEdit.original * 100,
        }] : []}
        onConfirm={handleSaveCell}
        pending={updateMatrixRate.isPending}
      />

      <CreateMatrixDialog open={creating} onOpenChange={setCreating} nextOrden={bancos.length + 1} />
    </div>
  );
}

// ─── Tabla desgravamen TDV ────────────────────────────────────────────────────

function TablaDesgravamenTDV() {
  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-border/60 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40">
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Tramo</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Edad</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">Tasa mensual</th>
            </tr>
          </thead>
          <tbody>
            {TDV_DESGRAVAMEN_TASAS.map((item, i) => (
              <tr key={item.tramo} className={`border-b hover:bg-muted/20 transition-colors ${i % 2 === 0 ? 'bg-background' : 'bg-muted/10'}`}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-primary/60 shrink-0" />
                    <span className="font-medium text-sm">{item.tramo}</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    <UserRound className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="text-sm">{item.edadRango}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-right">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="font-mono text-base font-bold text-primary cursor-default">
                          {(item.tasa * 100).toFixed(7)}%
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="left" className="text-xs max-w-[200px]">{item.descripcion}</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="px-4 py-2.5 border-t bg-muted/20 flex items-center gap-2 text-xs text-muted-foreground">
          <Info className="h-3.5 w-3.5 shrink-0" />
          Tasa mensual aplicada sobre el saldo insoluto del crédito en el momento del cálculo
        </div>
      </div>
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export function TasasSection() {
  const bankQuery = useBankCesantiaRates();
  const tdvQuery = useTdvCesantiaRates();
  const matrixQuery = useBankRateMatrix();

  const isFetching = bankQuery.isFetching || tdvQuery.isFetching || matrixQuery.isFetching;

  const handleRefresh = useCallback(() => {
    bankQuery.refetch();
    tdvQuery.refetch();
    matrixQuery.refetch();
    toast.info('Actualizando tasas…');
  }, [bankQuery, tdvQuery, matrixQuery]);

  const handleExport = useCallback(() => {
    const cesantiaBancos = bankQuery.data ?? {};
    const cesantiaTDVAll = tdvQuery.data ?? {};
    const desgravamenData = matrixQuery.data ?? {};

    const wb = XLSX.utils.book_new();
    const timestamp = new Date().toISOString().slice(0, 10);
    const tramosSet = new Set<string>();
    Object.values(cesantiaBancos).forEach((r) => Object.keys(r).forEach((k) => tramosSet.add(k)));
    Object.values(cesantiaTDVAll).forEach((r) => Object.keys(r).forEach((k) => tramosSet.add(k)));
    const tramosKeys = sortTramoKeys(Array.from(tramosSet));

    const cesantiaRows = Object.entries(cesantiaBancos).map(([banco, tramos]) => {
      const row: Record<string, any> = { 'Institución': banco, 'Tipo': 'Banco', 'Seguro': 'Cesantía' };
      tramosKeys.forEach((t) => { row[`Tasa ${t}`] = tramos[t]?.tasa_mensual ?? null; });
      return row;
    });
    Object.entries(cesantiaTDVAll).forEach(([nombre, tramos]) => {
      const row: Record<string, any> = { 'Institución': nombre, 'Tipo': 'TDV', 'Seguro': 'Cesantía' };
      tramosKeys.forEach((t) => { row[`Tasa ${t}`] = tramos[t]?.tasa_mensual ?? null; });
      cesantiaRows.push(row);
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(cesantiaRows), 'Cesantía');

    Object.entries(desgravamenData).forEach(([banco, grupos]) => {
      const rows: Record<string, any>[] = [];
      Object.entries(grupos).forEach(([grupo, montos]) => {
        Object.entries(montos).forEach(([monto, cuotasObj]) => {
          Object.entries(cuotasObj).forEach(([cuotas, tasa]) => {
            rows.push({
              'Banco': banco,
              'Tramo Edad': grupo === 'hasta_55' ? '18-55 años' : '56+ años',
              'Monto Crédito': Number(monto),
              'Cuotas': Number(cuotas),
              'Tasa Prima Única': tasa,
              'Tasa Prima Única (%)': `${(Number(tasa) * 100).toFixed(5)}%`,
            });
          });
        });
      });
      const sheetName = banco.replace('BANCO ', '').slice(0, 31);
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), sheetName);
    });

    const desgravTdvRows = TDV_DESGRAVAMEN_TASAS.map((item) => ({
      'Tramo': item.tramo,
      'Edad Cliente': item.edadRango,
      'Tasa Mensual': item.tasa,
      'Tasa Mensual (formato)': item.tasa.toFixed(7),
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(desgravTdvRows), 'Desgravamen TDV');

    XLSX.writeFile(wb, `tasas-tdv-${timestamp}.xlsx`);
  }, [bankQuery.data, tdvQuery.data, matrixQuery.data]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Tasas para Cálculo</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Tasas mensuales utilizadas para el cálculo de devoluciones de seguros.
            Se administran en línea y alimentan directamente la calculadora y los certificados.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Badge variant="outline" className="gap-1 text-xs border-emerald-300 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400">
            <Cloud className="h-3 w-3" />
            Servicio de tasas
          </Badge>
          <Button variant="outline" size="sm" onClick={handleRefresh} className="gap-2" disabled={isFetching}>
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport} className="gap-2">
            <Download className="h-3.5 w-3.5" />
            Exportar Excel
          </Button>
        </div>
      </div>

      <Tabs defaultValue="desgravamen" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 max-w-sm">
          <TabsTrigger value="desgravamen" className="gap-2">
            <ShieldCheck className="h-3.5 w-3.5" /> Desgravamen
          </TabsTrigger>
          <TabsTrigger value="cesantia" className="gap-2">
            <Briefcase className="h-3.5 w-3.5" /> Cesantía
          </TabsTrigger>
        </TabsList>

        <TabsContent value="desgravamen" className="space-y-8 mt-0">
          <div>
            <SectionHeader
              icon={Building2}
              title="Tasas Bancarias · Desgravamen"
              description="Prima única por banco, monto de crédito y plazo. Haz clic en una celda para editarla."
              color="bg-blue-500"
            />
            <TablaDesgravamenBancos />
          </div>

          <div className="h-px bg-border" />

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

        <TabsContent value="cesantia" className="space-y-6 mt-0">
          <SectionHeader
            icon={Briefcase}
            title="Tasas de Cesantía · Bancos vs TDV"
            description="Tasas mensuales por tramo de monto del crédito, administradas desde el servicio de tasas."
            color="bg-blue-500"
          />
          <TablaCesantia />
        </TabsContent>
      </Tabs>
    </div>
  );
}
