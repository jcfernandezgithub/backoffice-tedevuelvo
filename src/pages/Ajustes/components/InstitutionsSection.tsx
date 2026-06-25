import { useMemo, useState } from 'react';
import { useAdminInstitutions } from '@/hooks/useInstitutions';
import type { Institution, InstitutionPayload } from '@/services/institutionsService';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { toast } from 'sonner';
import {
  Search,
  Plus,
  MoreVertical,
  Pencil,
  Trash2,
  ShieldAlert,
  ShieldCheck,
  Eye,
  EyeOff,
  Building2,
  Loader2,
  AlertTriangle,
  Save,
  Undo2,
} from 'lucide-react';
import { InstitutionFormDialog } from './InstitutionFormDialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const HIGH_RISK_THRESHOLD = 15;
const CONFIRM_PHRASE = 'actualizar';

type Filter = 'all' | 'active' | 'inactive';

type RowDraft = { margen_seguridad?: number; active?: boolean };

type PendingUpdate = {
  kind: 'edit';
  inst: Institution;
  payload: InstitutionPayload;
  clearDraftId?: string;
};

export function InstitutionsSection() {
  const {
    data,
    isLoading,
    isError,
    refetch,
    createInstitution,
    updateInstitutionAsync,
    deleteInstitution,
    isCreating,
    isDeleting,
  } = useAdminInstitutions();

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Institution | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Institution | null>(null);
  const [pending, setPending] = useState<PendingUpdate | null>(null);
  const [confirmText, setConfirmText] = useState('');
  const [isApplying, setIsApplying] = useState(false);
  // Borradores locales por fila (id → cambios sin guardar)
  const [drafts, setDrafts] = useState<Record<string, RowDraft>>({});

  const setDraftMargin = (id: string, raw: string, original: number) => {
    const num = parseFloat(raw);
    setDrafts((prev) => {
      const next = { ...prev };
      const row = { ...(next[id] ?? {}) };
      if (isNaN(num)) {
        delete row.margen_seguridad;
      } else if (num === original) {
        delete row.margen_seguridad;
      } else {
        row.margen_seguridad = num;
      }
      if (row.margen_seguridad === undefined && row.active === undefined) {
        delete next[id];
      } else {
        next[id] = row;
      }
      return next;
    });
  };

  const setDraftActive = (id: string, value: boolean, original: boolean) => {
    setDrafts((prev) => {
      const next = { ...prev };
      const row = { ...(next[id] ?? {}) };
      if (value === original) {
        delete row.active;
      } else {
        row.active = value;
      }
      if (row.margen_seguridad === undefined && row.active === undefined) {
        delete next[id];
      } else {
        next[id] = row;
      }
      return next;
    });
  };

  const discardRowDraft = (id: string) => {
    setDrafts((prev) => {
      const { [id]: _drop, ...rest } = prev;
      return rest;
    });
  };

  const requestSaveRow = (inst: Institution) => {
    const draft = drafts[inst.id];
    if (!draft) return;
    const newMargin =
      draft.margen_seguridad !== undefined &&
      !isNaN(draft.margen_seguridad) &&
      draft.margen_seguridad >= 0 &&
      draft.margen_seguridad <= 100
        ? draft.margen_seguridad
        : inst.margen_seguridad;
    const newActive = draft.active ?? inst.active;
    const payload: InstitutionPayload = {
      label: inst.label,
      value: inst.value,
      grupo: inst.grupo,
      margen_seguridad: newMargin,
      active: newActive,
    };
    setPending({ kind: 'edit', inst, payload, clearDraftId: inst.id });
  };

  const handleCreate = async (payload: InstitutionPayload) => {
    try {
      await createInstitution(payload);
      toast.success('Institución creada');
      setFormOpen(false);
    } catch (e) {
      toast.error('No se pudo crear la institución', { description: String(e) });
    }
  };

  const handleEdit = async (payload: InstitutionPayload) => {
    if (!editTarget) return;
    setPending({ kind: 'edit', inst: editTarget, payload });
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteInstitution(deleteTarget.id);
      toast.success(`${deleteTarget.label} eliminada`);
      setDeleteTarget(null);
    } catch (e) {
      toast.error('No se pudo eliminar', { description: String(e) });
    }
  };

  const cancelPending = () => {
    setPending(null);
    setConfirmText('');
  };

  const applyPending = async () => {
    if (!pending) return;
    const phraseOk = confirmText.trim().toLowerCase() === CONFIRM_PHRASE;
    if (!phraseOk) return;
    setIsApplying(true);
    try {
      await updateInstitutionAsync({
        id: pending.inst.id,
        payload: pending.payload,
      });
      toast.success(`${pending.inst.label} actualizada`);
      if (pending.clearDraftId) discardRowDraft(pending.clearDraftId);
      if (editTarget && editTarget.id === pending.inst.id) {
        setEditTarget(null);
      }
      setPending(null);
      setConfirmText('');
    } catch (e) {
      toast.error('No se pudo actualizar', { description: String(e) });
    } finally {
      setIsApplying(false);
    }
  };

  const pendingSummary = () => {
    if (!pending) return null;
    const diffs: [string, string][] = [];
    const fields: (keyof InstitutionPayload)[] = [
      'label',
      'value',
      'grupo',
      'margen_seguridad',
      'active',
    ];
    const labels: Record<string, string> = {
      label: 'Nombre',
      value: 'Slug',
      grupo: 'Grupo',
      margen_seguridad: 'Margen',
      active: 'Visible',
    };
    fields.forEach((f) => {
      const prev = (pending.inst as any)[f];
      const next = (pending.payload as any)[f];
      if (prev !== next) {
        const fmt = (v: any) =>
          typeof v === 'boolean'
            ? v
              ? 'Sí'
              : 'No'
            : f === 'margen_seguridad'
              ? `${v}%`
              : String(v);
        diffs.push([labels[f], `${fmt(prev)} → ${fmt(next)}`]);
      }
    });
    return {
      title: `Confirmar cambios en ${pending.inst.label}`,
      rows: diffs.length
        ? ([['Institución', pending.inst.label], ...diffs] as [string, string][])
        : ([['Sin cambios', '—']] as [string, string][]),
    };
  };
  const summary = pendingSummary();
  const phraseOk = confirmText.trim().toLowerCase() === CONFIRM_PHRASE;

  const filtered = useMemo(() => {
    const list = data ?? [];
    const q = search.toLowerCase().trim();
    return list
      .filter((i) => {
        if (filter === 'active' && !i.active) return false;
        if (filter === 'inactive' && i.active) return false;
        if (!q) return true;
        return (
          i.label.toLowerCase().includes(q) ||
          i.value.toLowerCase().includes(q) ||
          i.grupo.toLowerCase().includes(q)
        );
      })
      .sort(
        (a, b) =>
          b.margen_seguridad - a.margen_seguridad ||
          a.label.localeCompare(b.label),
      );
  }, [data, search, filter]);

  const total = data?.length ?? 0;
  const activos = data?.filter((i) => i.active).length ?? 0;
  const promedio =
    data && data.length > 0
      ? Math.round(
          (data.reduce((s, m) => s + m.margen_seguridad, 0) / data.length) * 10,
        ) / 10
      : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">
            Instituciones financieras
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Administra las instituciones disponibles en la calculadora, su margen de
            seguridad y visibilidad. Los cambios se sincronizan con el backend.
          </p>
        </div>
        <Button onClick={() => setFormOpen(true)} className="gap-2" disabled={isCreating}>
          <Plus className="h-4 w-4" />
          Nueva institución
        </Button>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre, slug o grupo..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
          <TabsList>
            <TabsTrigger value="all">Todas ({total})</TabsTrigger>
            <TabsTrigger value="active">Activas ({activos})</TabsTrigger>
            <TabsTrigger value="inactive">Inactivas ({total - activos})</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {isError && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm">
          <div className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-4 w-4" />
            No se pudo cargar la lista de instituciones.
          </div>
          <Button size="sm" variant="outline" onClick={() => refetch()}>
            Reintentar
          </Button>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" />
          Cargando instituciones...
        </div>
      ) : (
        <div className="grid gap-2">
          {filtered.map((row) => {
            const isHighRisk = row.margen_seguridad >= HIGH_RISK_THRESHOLD;
            const Icon = isHighRisk ? ShieldAlert : ShieldCheck;
            const accent = isHighRisk
              ? 'from-amber-500 to-orange-600'
              : 'from-emerald-500 to-teal-600';
            return (
              <div
                key={row.id}
                className="flex items-center gap-4 rounded-xl border border-border/60 overflow-hidden"
              >
                <div className={`w-1.5 self-stretch bg-gradient-to-b ${accent} shrink-0`} />
                <div className="flex flex-wrap md:flex-nowrap items-center gap-3 flex-1 py-2.5 pr-3">
                  <div className={`p-2 rounded-lg bg-gradient-to-br ${accent} shrink-0`}>
                    <Icon className="h-4 w-4 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Label
                        htmlFor={`margin-${row.id}`}
                        className="font-medium text-sm cursor-pointer"
                      >
                        {row.label}
                      </Label>
                      {!row.active && (
                        <Badge variant="outline" className="text-[10px] gap-1">
                          <EyeOff className="h-3 w-3" />
                          Inactiva
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5">
                      <Building2 className="h-3 w-3" />
                      <span>{row.grupo || 'Sin grupo'}</span>
                      <span className="text-muted-foreground/50">·</span>
                      <code className="text-[10px] bg-muted px-1 py-0.5 rounded">
                        {row.value}
                      </code>
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <Input
                      id={`margin-${row.id}`}
                      key={`margin-${row.id}-${row.margen_seguridad}-${resetToken}`}
                      type="number"
                      min={0}
                      max={100}
                      step={0.5}
                      defaultValue={row.margen_seguridad}
                      onBlur={(e) => requestMarginChange(row, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                      }}
                      className="w-20 text-center font-semibold"
                    />
                    <span className="text-sm text-muted-foreground w-3">%</span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 md:w-[120px] md:justify-center">
                    <Switch
                      id={`visible-${row.id}`}
                      key={`visible-${row.id}-${row.active}-${resetToken}`}
                      checked={row.active}
                      onCheckedChange={(v) => requestToggleActive(row, v)}
                      aria-label={`Visible en calculadora: ${row.label}`}
                    />
                    <Label
                      htmlFor={`visible-${row.id}`}
                      className="text-xs text-muted-foreground cursor-pointer select-none w-6"
                    >
                      {row.active ? 'Sí' : 'No'}
                    </Label>
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setEditTarget(row)}>
                        <Pencil className="h-3.5 w-3.5 mr-2" />
                        Editar
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => setDeleteTarget(row)}
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-2" />
                        Eliminar definitivamente
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            );
          })}

          {!isLoading && filtered.length === 0 && (
            <div className="text-center text-sm text-muted-foreground py-8 border border-dashed rounded-xl">
              {data && data.length === 0
                ? 'Aún no hay instituciones. Crea la primera.'
                : `Sin resultados para "${search}"`}
            </div>
          )}
        </div>
      )}

      <Separator />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Kpi label="Total" value={total} icon={Building2} />
        <Kpi
          label="Visibles en calculadora"
          value={`${activos} / ${total}`}
          icon={Eye}
        />
        <Kpi label="Margen promedio" value={`${promedio}%`} icon={ShieldCheck} />
      </div>

      <InstitutionFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        onSubmit={handleCreate}
        isSaving={isCreating}
      />

      <InstitutionFormDialog
        open={!!editTarget}
        onOpenChange={(o) => !o && setEditTarget(null)}
        initial={editTarget}
        onSubmit={handleEdit}
      />

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar institución</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget
                ? `Vas a eliminar definitivamente "${deleteTarget.label}". Esta acción no se puede deshacer. Si solo quieres ocultarla en la calculadora, usa el switch "Visible".`
                : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? 'Eliminando...' : 'Eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={!!pending}
        onOpenChange={(o) => {
          if (!o && !isApplying) cancelPending();
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
              </div>
              <DialogTitle>{summary?.title ?? 'Confirmar cambio'}</DialogTitle>
            </div>
            <DialogDescription>
              Este cambio impacta directamente a la calculadora y a los cálculos
              de devolución. Revisa el detalle y escribe{' '}
              <span className="font-semibold text-foreground">
                "{CONFIRM_PHRASE}"
              </span>{' '}
              para confirmar.
            </DialogDescription>
          </DialogHeader>

          {summary && (
            <div className="rounded-lg border bg-muted/40 divide-y text-sm">
              {summary.rows.map(([k, v]) => (
                <div
                  key={k}
                  className="flex items-center justify-between px-3 py-2"
                >
                  <span className="text-muted-foreground">{k}</span>
                  <span className="font-medium text-foreground text-right">
                    {v}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="confirm-phrase" className="text-xs">
              Escribe{' '}
              <code className="bg-muted px-1 py-0.5 rounded text-[11px]">
                {CONFIRM_PHRASE}
              </code>{' '}
              para confirmar
            </Label>
            <Input
              id="confirm-phrase"
              autoFocus
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && phraseOk && !isApplying) {
                  e.preventDefault();
                  applyPending();
                }
              }}
              placeholder={CONFIRM_PHRASE}
              className={
                phraseOk
                  ? 'border-emerald-500 focus-visible:ring-emerald-500'
                  : ''
              }
              disabled={isApplying}
            />
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={cancelPending}
              disabled={isApplying}
            >
              Cancelar
            </Button>
            <Button
              onClick={applyPending}
              disabled={!phraseOk || isApplying}
              className="gap-2"
            >
              {isApplying && <Loader2 className="h-4 w-4 animate-spin" />}
              Confirmar actualización
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Kpi({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-muted/50 px-4 py-3">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon className="h-4 w-4" />
        <span>{label}</span>
      </div>
      <span className="font-bold text-foreground text-lg">{value}</span>
    </div>
  );
}