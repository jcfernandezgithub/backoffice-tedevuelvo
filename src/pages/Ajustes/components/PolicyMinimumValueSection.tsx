import { useState } from 'react';
import {
  BadgeDollarSign,
  Plus,
  Pencil,
  Loader2,
  RefreshCw,
  CloudOff,
  Info,
  FlaskConical,
  CheckCircle2,
  Ban,
  Inbox,
  MessageSquareText,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  usePolicyMinimumValueConfigs,
  usePolicyMinimumValueMutations,
} from '@/hooks/usePolicyMinimumValue';
import {
  policyMinimumValueService,
  type PolicyMinimumValueConfig,
  type PolicyMinimumValueResult,
} from '@/services/policyMinimumValueService';
import { formatCurrency, formatCLPNumber } from '@/lib/formatters';
import { cn } from '@/lib/utils';

// ─── Formulario (crear / editar) ─────────────────────────────────────────────

interface FormState {
  minimumDigits: string;
  code: string;
  message: string;
  isActive: boolean;
}

const EMPTY_FORM: FormState = { minimumDigits: '', code: '', message: '', isActive: true };

function PolicyConfigFormDialog({
  open,
  onOpenChange,
  editTarget,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editTarget: PolicyMinimumValueConfig | null;
}) {
  const { create, update } = usePolicyMinimumValueMutations();
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [touched, setTouched] = useState(false);

  // Prefill al abrir
  const [prevOpen, setPrevOpen] = useState(false);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setTouched(false);
      setForm(
        editTarget
          ? {
              minimumDigits: String(editTarget.minimumValue ?? ''),
              code: editTarget.belowMinimumCode,
              message: editTarget.belowMinimumMessage,
              isActive: editTarget.isActive,
            }
          : EMPTY_FORM,
      );
    }
  }

  const isSaving = create.isPending || update.isPending;
  const minimumValue = form.minimumDigits ? Number(form.minimumDigits) : NaN;
  const errors = {
    minimumValue:
      form.minimumDigits === '' || Number.isNaN(minimumValue) || minimumValue < 0
        ? 'Ingresa un monto mayor o igual a 0.'
        : null,
    code: form.code.trim() === '' ? 'El código es obligatorio.' : null,
    message: form.message.trim() === '' ? 'El mensaje es obligatorio.' : null,
  };
  const isValid = !errors.minimumValue && !errors.code && !errors.message;

  const submit = () => {
    setTouched(true);
    if (!isValid) return;
    const payload = {
      minimumValue,
      belowMinimumCode: form.code.trim(),
      belowMinimumMessage: form.message.trim(),
      isActive: form.isActive,
    };
    const onSuccess = () => {
      toast.success(editTarget ? 'Configuración actualizada' : 'Configuración creada');
      onOpenChange(false);
    };
    const onError = (e: Error) =>
      toast.error('No se pudo guardar', { description: e.message });

    if (editTarget) update.mutate({ id: editTarget.id, patch: payload }, { onSuccess, onError });
    else create.mutate(payload, { onSuccess, onError });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {editTarget ? 'Editar configuración' : 'Nueva configuración'}
          </DialogTitle>
          <DialogDescription>
            Regla aplicada por el backend: si el valor de la devolución es{' '}
            <span className="font-medium">menor o igual</span> al mínimo, se filtra.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="pmv-min">Valor mínimo (CLP)</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                $
              </span>
              <Input
                id="pmv-min"
                inputMode="numeric"
                className="pl-7"
                placeholder="20.000"
                value={form.minimumDigits ? formatCLPNumber(form.minimumDigits) : ''}
                onChange={(e) =>
                  setForm((f) => ({ ...f, minimumDigits: e.target.value.replace(/\D/g, '') }))
                }
              />
            </div>
            {touched && errors.minimumValue && (
              <p className="text-xs text-destructive">{errors.minimumValue}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pmv-code">Código de rechazo</Label>
            <Input
              id="pmv-code"
              className="font-mono text-xs"
              placeholder="POLICY_VALUE_BELOW_MINIMUM"
              value={form.code}
              onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
            />
            {touched && errors.code && (
              <p className="text-xs text-destructive">{errors.code}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pmv-msg">Mensaje al filtrar</Label>
            <Textarea
              id="pmv-msg"
              rows={3}
              placeholder="El valor de la devolución es igual o menor al mínimo establecido."
              value={form.message}
              onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
            />
            {touched && errors.message && (
              <p className="text-xs text-destructive">{errors.message}</p>
            )}
          </div>

          <div className="flex items-center justify-between rounded-lg border px-4 py-3">
            <div>
              <p className="text-sm font-medium">Configuración activa</p>
              <p className="text-xs text-muted-foreground">
                El endpoint de validación usa la configuración activa.
              </p>
            </div>
            <Switch
              checked={form.isActive}
              onCheckedChange={(v) => setForm((f) => ({ ...f, isActive: v }))}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={isSaving} className="gap-2">
            {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
            {editTarget ? 'Guardar cambios' : 'Crear configuración'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Sección principal ───────────────────────────────────────────────────────

export function PolicyMinimumValueSection() {
  const { data: configs, isLoading, isError, error, refetch } = usePolicyMinimumValueConfigs();
  const { update, remove } = usePolicyMinimumValueMutations();

  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<PolicyMinimumValueConfig | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PolicyMinimumValueConfig | null>(null);

  // Playground de validación
  const [testDigits, setTestDigits] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<PolicyMinimumValueResult | null>(null);
  const [testError, setTestError] = useState<string | null>(null);

  const runTest = async () => {
    const value = Number(testDigits || '0');
    setTesting(true);
    setTestError(null);
    setTestResult(null);
    try {
      const result = await policyMinimumValueService.validate(value);
      setTestResult(result);
    } catch (e) {
      setTestError((e as Error).message || 'No se pudo validar el valor.');
    } finally {
      setTesting(false);
    }
  };

  const toggleActive = (c: PolicyMinimumValueConfig, v: boolean) => {
    update.mutate(
      { id: c.id, patch: { isActive: v } },
      {
        onSuccess: () =>
          toast.success(v ? 'Configuración activada' : 'Configuración desactivada'),
        onError: (e: Error) =>
          toast.error('No se pudo actualizar', { description: e.message }),
      },
    );
  };

  return (
    <div className="space-y-6 max-w-3xl">
      {/* ── Playground de validación ── */}
      <Card className="overflow-hidden border-border/60">
        <div className="px-5 py-4 border-b border-border/60 bg-muted/40 flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/15 text-primary grid place-items-center shrink-0">
            <FlaskConical className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold leading-tight">Probar validación</p>
            <p className="text-xs text-muted-foreground leading-tight mt-1">
              Consulta en vivo contra la configuración activa del backend
            </p>
          </div>
        </div>
        <CardContent className="pt-5 space-y-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                $
              </span>
              <Input
                inputMode="numeric"
                className="pl-7"
                placeholder="Ingresa un monto de devolución, ej: 18.000"
                value={testDigits ? formatCLPNumber(testDigits) : ''}
                onChange={(e) => {
                  setTestDigits(e.target.value.replace(/\D/g, ''));
                  setTestResult(null);
                  setTestError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && testDigits && !testing) runTest();
                }}
              />
            </div>
            <Button
              onClick={runTest}
              disabled={!testDigits || testing}
              className="gap-2 shrink-0"
            >
              {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Validar
            </Button>
          </div>

          {testError && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 flex items-start justify-between gap-3">
              <p className="text-xs text-destructive leading-relaxed">{testError}</p>
              <Button variant="ghost" size="sm" onClick={runTest} className="h-7 px-2 text-xs">
                Reintentar
              </Button>
            </div>
          )}

          {testResult && (
            <div
              className={cn(
                'rounded-lg border px-4 py-3.5 space-y-3',
                testResult.shouldFilter
                  ? 'border-red-300 bg-red-50 dark:bg-red-950/30 dark:border-red-900'
                  : 'border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30 dark:border-emerald-900',
              )}
            >
              <div className="flex items-center gap-2.5">
                {testResult.shouldFilter ? (
                  <Ban className="h-4 w-4 text-red-600 shrink-0" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                )}
                <p
                  className={cn(
                    'text-sm font-semibold',
                    testResult.shouldFilter
                      ? 'text-red-900 dark:text-red-200'
                      : 'text-emerald-900 dark:text-emerald-200',
                  )}
                >
                  {testResult.shouldFilter
                    ? 'La devolución sería filtrada'
                    : 'La devolución sería aceptada'}
                </p>
              </div>
              {testResult.message && (
                <div className="rounded-lg border bg-background px-4 py-3 shadow-sm space-y-1.5">
                  <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    <MessageSquareText className="h-3.5 w-3.5 shrink-0" />
                    Mensaje que se mostrará en TeDevuelvo
                  </p>
                  <p className="text-sm font-medium leading-relaxed text-foreground">
                    “{testResult.message}”
                  </p>
                </div>
              )}
              <div className="grid grid-cols-3 gap-3 pt-1">
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    Valor evaluado
                  </p>
                  <p className="text-sm font-medium">{formatCurrency(testResult.value)}</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    Mínimo vigente
                  </p>
                  <p className="text-sm font-medium">{formatCurrency(testResult.minimumValue)}</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    Código
                  </p>
                  <p className="text-xs font-mono font-medium break-all">{testResult.code}</p>
                </div>
              </div>
            </div>
          )}

          <div className="rounded-lg border bg-muted/30 px-4 py-3 flex items-start gap-2.5">
            <Info className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
            <p className="text-xs text-muted-foreground leading-relaxed">
              Regla vigente: valor <span className="font-medium">menor o igual</span> al mínimo
              → la devolución se filtra. El límite lo define siempre el backend; este panel solo lo
              administra.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* ── Configuraciones ── */}
      <Card className="overflow-hidden border-border/60">
        <div className="px-5 py-4 border-b border-border/60 flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/15 text-primary grid place-items-center shrink-0">
            <BadgeDollarSign className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold leading-tight">Configuraciones</p>
            <p className="text-xs text-muted-foreground leading-tight mt-1">
              {configs?.length
                ? `${configs.length} registro${configs.length === 1 ? '' : 's'}`
                : 'Valores mínimos de devolución'}
            </p>
          </div>
          <Button
            size="sm"
            className="gap-2 shrink-0"
            onClick={() => {
              setEditTarget(null);
              setFormOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
            Nueva configuración
          </Button>
        </div>

        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-5 space-y-3">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : isError ? (
            <div className="p-8 flex flex-col items-center text-center gap-3">
              <div className="h-11 w-11 rounded-full bg-destructive/10 grid place-items-center">
                <CloudOff className="h-5 w-5 text-destructive" />
              </div>
              <p className="text-sm font-semibold">No se pudieron cargar las configuraciones</p>
              <p className="text-xs text-muted-foreground max-w-md">
                {(error as Error)?.message}
              </p>
              <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2">
                <RefreshCw className="h-3.5 w-3.5" />
                Reintentar
              </Button>
            </div>
          ) : !configs?.length ? (
            <div className="p-10 flex flex-col items-center text-center gap-3">
              <div className="h-11 w-11 rounded-full bg-muted grid place-items-center">
                <Inbox className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="text-sm font-semibold">Sin configuraciones</p>
              <p className="text-xs text-muted-foreground max-w-sm">
                Aún no hay valores mínimos registrados. Crea la primera configuración para
                activar el filtro.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-border/60">
              {configs.map((c) => (
                <li key={c.id} className="px-5 py-4 flex items-center gap-4">
                  <div className="min-w-[7.5rem]">
                    <p className="text-base font-semibold leading-tight">
                      {formatCurrency(c.minimumValue)}
                    </p>
                    <p className="text-[11px] text-muted-foreground">Monto mínimo</p>
                  </div>
                  <div className="flex-1 min-w-0 space-y-1">
                    <Badge variant="secondary" className="font-mono text-[10px] font-medium">
                      {c.belowMinimumCode}
                    </Badge>
                    <p className="text-xs text-muted-foreground leading-snug line-clamp-2">
                      {c.belowMinimumMessage}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Label className="text-xs text-muted-foreground hidden sm:block">
                      {c.isActive ? 'Activa' : 'Inactiva'}
                    </Label>
                    <Switch
                      checked={c.isActive}
                      disabled={update.isPending}
                      onCheckedChange={(v) => toggleActive(c, v)}
                    />
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => {
                        setEditTarget(c);
                        setFormOpen(true);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => setDeleteTarget(c)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* ── Diálogos ── */}
      <PolicyConfigFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        editTarget={editTarget}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar esta configuración?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará el valor mínimo de{' '}
              <span className="font-medium">
                {deleteTarget ? formatCurrency(deleteTarget.minimumValue) : ''}
              </span>
              . Si es la configuración activa, el filtro de devoluciones dejará de aplicarse hasta
              que exista otra. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={remove.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={remove.isPending}
              onClick={(e) => {
                e.preventDefault();
                if (!deleteTarget) return;
                remove.mutate(deleteTarget.id, {
                  onSuccess: () => {
                    toast.success('Configuración eliminada');
                    setDeleteTarget(null);
                  },
                  onError: (err: Error) =>
                    toast.error('No se pudo eliminar', { description: err.message }),
                });
              }}
            >
              {remove.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Eliminar'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}