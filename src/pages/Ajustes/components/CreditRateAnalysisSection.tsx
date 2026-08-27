import { useCallback, useMemo, useRef, useState } from 'react';
import {
  UploadCloud,
  FileText,
  Loader2,
  X,
  AlertTriangle,
  CheckCircle2,
  Percent,
  Building2,
  CalendarClock,
  Coins,
  RotateCcw,
  Info,
  Copy,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/formatters';
import {
  analyzeCreditDocument,
  MAX_CREDIT_FILE_SIZE,
  type CreditRateAnalysisResponse,
} from '@/services/creditRateAnalysisService';

const ACCEPTED = '.pdf,.png,.jpg,.jpeg,.webp';

function formatPct(value?: number, digits = 3) {
  if (value === undefined || value === null || Number.isNaN(value)) return '—';
  return `${value.toLocaleString('es-CL', {
    minimumFractionDigits: 2,
    maximumFractionDigits: digits,
  })}%`;
}

function formatMoney(value?: number) {
  if (value === undefined || value === null || Number.isNaN(value)) return '—';
  return formatCurrency(Math.round(value));
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function MetricCard({
  icon: Icon,
  label,
  value,
  hint,
  highlight,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  hint?: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        'rounded-xl border p-4 transition-colors',
        highlight ? 'border-primary/40 bg-primary/5' : 'border-border/60 bg-muted/20',
      )}
    >
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <Icon className={cn('h-3.5 w-3.5', highlight && 'text-primary')} />
        {label}
      </div>
      <p className={cn('mt-1.5 text-xl font-bold tabular-nums leading-none', highlight && 'text-primary')}>
        {value}
      </p>
      {hint && <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function CreditRateAnalysisSection() {
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CreditRateAnalysisResponse | null>(null);

  const doc = result?.documento_analizado;
  const resumen = result?.resumen_tasas;
  const proyecciones = useMemo(
    () => (result?.proyecciones_por_plazo ?? []).slice().sort((a, b) => (a.plazo_meses ?? 0) - (b.plazo_meses ?? 0)),
    [result],
  );

  const hasRates =
    (resumen?.tasa_interes_mensual_credito_pct ?? 0) > 0 ||
    (resumen?.tasa_combinada_mensual_pct ?? 0) > 0 ||
    result?.es_valido_para_continuar_proceso === true;

  const isValid = doc?.es_credito_valido === true || result?.es_valido_para_continuar_proceso === true;

  const pickFile = useCallback((next: File | null) => {
    if (!next) return;
    if (next.size > MAX_CREDIT_FILE_SIZE) {
      toast.error('El archivo supera el tamaño máximo permitido (15 MB).');
      return;
    }
    setFile(next);
    setResult(null);
    setError(null);
  }, []);

  const reset = () => {
    abortRef.current?.abort();
    setFile(null);
    setResult(null);
    setError(null);
    setLoading(false);
    setProgress(0);
    if (inputRef.current) inputRef.current.value = '';
  };

  const analyze = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setProgress(8);

    const controller = new AbortController();
    abortRef.current = controller;

    // Progreso simulado: el análisis con IA puede tardar ~30-60s.
    const timer = setInterval(() => {
      setProgress((p) => (p < 90 ? p + Math.max(1, Math.round((90 - p) / 18)) : p));
    }, 700);

    try {
      const data = await analyzeCreditDocument(file, controller.signal);
      setProgress(100);
      setResult(data);
      if (data?.documento_analizado?.es_credito_valido === false) {
        toast.warning('El documento no fue reconocido como un crédito válido.');
      } else {
        toast.success('Análisis completado.');
      }
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') {
        setProgress(0);
        return;
      }
      const msg = (e as Error)?.message || 'No fue posible analizar el documento.';
      setError(msg);
      toast.error(msg);
    } finally {
      clearInterval(timer);
      abortRef.current = null;
      setLoading(false);
    }
  };

  const copySummary = async () => {
    if (!result) return;
    const md =
      result.tabla_resumen_markdown ||
      JSON.stringify({ documento_analizado: doc, resumen_tasas: resumen }, null, 2);
    try {
      await navigator.clipboard.writeText(md);
      toast.success('Resumen copiado al portapapeles.');
    } catch {
      toast.error('No fue posible copiar el resumen.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Descripción */}
      <div className="flex items-start gap-3 rounded-lg border border-border/60 bg-muted/20 p-4">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Sube el documento del crédito (con seguro de desgravamen asociado) y la IA extraerá la tasa
          utilizada, la tasa del seguro y las proyecciones de tasa por plazo de cuotas. El análisis es
          referencial y no reemplaza la revisión del ejecutivo.
        </p>
      </div>

      {/* Zona de carga */}
      <Card>
        <CardContent className="p-5">
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED}
            className="hidden"
            onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
          />

          {!file ? (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                pickFile(e.dataTransfer.files?.[0] ?? null);
              }}
              className={cn(
                'flex w-full flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-12 text-center transition-colors',
                isDragging
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/50 hover:bg-muted/40',
              )}
            >
              <div className="rounded-full bg-primary/10 p-3">
                <UploadCloud className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold">Arrastra el documento del crédito aquí</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  o haz clic para seleccionar · PDF o imagen · máx. 15 MB
                </p>
              </div>
            </button>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-3 rounded-lg border border-border/60 bg-muted/20 p-3">
                <div className="rounded-lg bg-primary/10 p-2">
                  <FileText className="h-4 w-4 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{file.name}</p>
                  <p className="text-xs text-muted-foreground">{formatBytes(file.size)}</p>
                </div>
                {!loading && (
                  <Button variant="ghost" size="icon" onClick={reset} aria-label="Quitar archivo">
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>

              {loading && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Analizando documento con IA… esto puede tomar hasta un minuto
                    </span>
                    <span className="tabular-nums">{progress}%</span>
                  </div>
                  <Progress value={progress} className="h-1.5" />
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2">
                <Button onClick={analyze} disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Analizando…
                    </>
                  ) : (
                    <>
                      <Percent className="mr-2 h-4 w-4" />
                      Analizar tasas
                    </>
                  )}
                </Button>
                {loading ? (
                  <Button variant="outline" onClick={() => abortRef.current?.abort()}>
                    Cancelar
                  </Button>
                ) : (
                  <>
                    <Button variant="outline" onClick={() => inputRef.current?.click()}>
                      Cambiar archivo
                    </Button>
                    {result && (
                      <Button variant="ghost" onClick={reset}>
                        <RotateCcw className="mr-2 h-4 w-4" />
                        Nuevo análisis
                      </Button>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-4">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <div>
            <p className="text-sm font-semibold text-destructive">No pudimos analizar el documento</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{error}</p>
          </div>
        </div>
      )}

      {/* Resultado */}
      {result && (
        <div className="space-y-5">
          {/* Estado */}
          <div
            className={cn(
              'flex items-start gap-3 rounded-lg border p-4',
              isValid ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-amber-500/40 bg-amber-500/5',
            )}
          >
            {isValid ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
            ) : (
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            )}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold">
                  {isValid ? 'Documento de crédito reconocido' : 'Documento no concluyente'}
                </p>
                {doc?.institucion_financiera && (
                  <Badge variant="secondary" className="gap-1">
                    <Building2 className="h-3 w-3" />
                    {doc.institucion_financiera}
                  </Badge>
                )}
              </div>
              {result.observaciones && !hasRates && (
                <p className="mt-1 text-xs text-muted-foreground">{result.observaciones}</p>
              )}
            </div>
            <Button variant="ghost" size="sm" onClick={copySummary}>
              <Copy className="mr-2 h-3.5 w-3.5" />
              Copiar
            </Button>
          </div>

          {/* Tasas detectadas */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground/70">
              Tasas detectadas
            </p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <MetricCard
                icon={Percent}
                label="Tasa con seguro"
                value={formatPct(resumen?.tasa_combinada_mensual_pct, 3)}
                hint="Dato principal del análisis"
                highlight
              />
              <MetricCard
                icon={Percent}
                label="Interés mensual crédito"
                value={formatPct(resumen?.tasa_interes_mensual_credito_pct)}
              />
              <MetricCard
                icon={Percent}
                label="Desgravamen mensual"
                value={formatPct(
                  resumen?.tasa_desgravamen_mensual_pct ?? doc?.tasa_desgravamen_mensual_pct,
                )}
              />
              <MetricCard
                icon={Percent}
                label="Tasa efectiva anual (TEA)"
                value={formatPct(resumen?.tasa_efectiva_anual_tea_pct, 2)}
              />
            </div>
          </div>

          {/* Destacado tasa con seguro */}
          {resumen?.tasa_combinada_mensual_pct !== undefined && (
            <div className="relative overflow-hidden rounded-xl border border-primary/30 bg-gradient-to-br from-primary/10 via-primary/5 to-background p-5">
              <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-primary/10 blur-2xl" />
              <div className="relative flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-primary/80">
                    Tasa con seguro detectada
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Este es el indicador clave que incluye la tasa de interés del crédito más la
                    protección de desgravamen.
                  </p>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-extrabold tracking-tight text-primary tabular-nums">
                    {formatPct(resumen.tasa_combinada_mensual_pct, 3)}
                  </span>
                  <span className="text-sm font-medium text-muted-foreground">mensual</span>
                </div>
              </div>
            </div>
          )}

          {/* Datos del crédito */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground/70">
              Datos del crédito
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              <MetricCard icon={Coins} label="Monto del crédito" value={formatMoney(doc?.monto_credito_detectado)} />
              <MetricCard icon={Coins} label="Cuota mensual" value={formatMoney(doc?.cuota_mensual_detectada)} />
              <MetricCard
                icon={CalendarClock}
                label="Plazo detectado"
                value={doc?.plazo_meses_detectado ? `${doc.plazo_meses_detectado} meses` : '—'}
              />
            </div>
          </div>

          {/* Proyecciones */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground/70">
              Proyecciones por plazo
            </p>
            {proyecciones.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border/70 p-6 text-center">
                <p className="text-sm font-medium text-muted-foreground">
                  El análisis no devolvió proyecciones por plazo
                </p>
                <p className="mt-1 text-xs text-muted-foreground/80">
                  Esto ocurre cuando el documento no contiene datos suficientes del crédito
                  (monto, cuota o plazo). Intenta con un archivo más legible.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-border/60">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[160px] bg-primary/5 text-primary">Tasa con seguro</TableHead>
                      <TableHead>Plazo</TableHead>
                      <TableHead className="text-right">Cuota estimada</TableHead>
                      <TableHead className="text-right">Tasa interés acum.</TableHead>
                      <TableHead className="text-right">Total a pagar</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {proyecciones.map((p, i) => (
                      <TableRow key={`${p.plazo_meses}-${i}`}>
                        <TableCell className="bg-primary/5 font-bold tabular-nums text-primary">
                          {formatPct(p.tasa_total_con_seguro_pct, 3)}
                        </TableCell>
                        <TableCell className="font-medium">
                          {p.plazo_meses ? `${p.plazo_meses} cuotas` : '—'}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatMoney(p.cuota_mensual_estimada)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatPct(p.tasa_interes_pura_acumulada_pct, 2)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatMoney(p.monto_total_a_pagar)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  );
}
