import { useMemo, useState, useRef } from 'react';
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

const HIGH_RISK_THRESHOLD = 15;

type Filter = 'all' | 'active' | 'inactive';

export function InstitutionsSection() {
  const {
    data,
    isLoading,
    isError,
    refetch,
    createInstitution,
    updateInstitution,
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

  // Debounce de cambios al margen por fila
  const debounceTimers = useRef<Record<string, number>>({});
  const handleMarginChange = (inst: Institution, raw: string) => {
    const num = parseFloat(raw);
    if (isNaN(num) || num < 0 || num > 100) return;
    if (num === inst.margen_seguridad) return;
    if (debounceTimers.current[inst.id]) {
      window.clearTimeout(debounceTimers.current[inst.id]);
    }
    debounceTimers.current[inst.id] = window.setTimeout(() => {
      updateInstitution(
        { id: inst.id, payload: { margen_seguridad: num } },
        {
          onSuccess: () => toast.success(`${inst.label}: margen ${num}%`),
          onError: (e) => toast.error('No se pudo actualizar el margen', { description: String(e) }),
        },
      );
    }, 600);
  };

  const handleToggleActive = (inst: Institution, active: boolean) => {
    updateInstitution(
      { id: inst.id, payload: { active } },
      {
        onSuccess: () =>
          toast.success(`${inst.label}: ${active ? 'visible' : 'oculta'}`),
        onError: (e) =>
          toast.error('No se pudo cambiar la visibilidad', { description: String(e) }),
      },
    );
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
    try {
      await updateInstitutionAsync({ id: editTarget.id, payload });
      toast.success('Institución actualizada');
      setEditTarget(null);
    } catch (e) {
      toast.error('No se pudo actualizar', { description: String(e) });
    }
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
                      type="number"
                      min={0}
                      max={100}
                      step={0.5}
                      defaultValue={row.margen_seguridad}
                      onBlur={(e) => handleMarginChange(row, e.target.value)}
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
                      checked={row.active}
                      onCheckedChange={(v) => handleToggleActive(row, v)}
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