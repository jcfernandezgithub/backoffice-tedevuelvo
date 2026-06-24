import { useState, useMemo } from 'react';
import {
  useSafetyMargins,
  DEFAULT_SAFETY_MARGINS,
  type SafetyMargin,
} from '@/hooks/useSafetyMargins';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { RotateCcw, Save, ShieldAlert, ShieldCheck, Search } from 'lucide-react';

const HIGH_RISK_THRESHOLD = 15; // > 15% se muestra como "alto riesgo"

export function SafetyMarginsSection() {
  const { margins, save, reset } = useSafetyMargins();
  const [draft, setDraft] = useState<SafetyMargin[]>(margins.map((m) => ({ ...m })));
  const [isDirty, setIsDirty] = useState(false);
  const [search, setSearch] = useState('');

  const handleChange = (institution: string, value: string) => {
    const num = parseFloat(value);
    if (isNaN(num) || num < 0 || num > 100) return;
    setDraft((prev) =>
      prev.map((m) => (m.institution === institution ? { ...m, margin: num } : m))
    );
    setIsDirty(true);
  };

  const handleSave = () => {
    save(draft);
    setIsDirty(false);
    toast.success('Márgenes actualizados', {
      description: 'Los nuevos márgenes se aplicarán en las próximas simulaciones.',
    });
  };

  const handleReset = () => {
    const fresh = DEFAULT_SAFETY_MARGINS.map((o) => ({ ...o }));
    setDraft(fresh);
    reset();
    setIsDirty(false);
    toast.info('Márgenes restaurados a los valores por defecto.');
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    const base = q
      ? draft.filter((m) => m.institution.toLowerCase().includes(q))
      : draft;
    // Ordenar por margen descendente, y alfabéticamente como desempate
    return [...base].sort(
      (a, b) => b.margin - a.margin || a.institution.localeCompare(b.institution)
    );
  }, [draft, search]);

  const promedio =
    draft.length > 0
      ? Math.round((draft.reduce((s, m) => s + m.margin, 0) / draft.length) * 10) / 10
      : 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">
          Márgenes de seguridad por institución
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Porcentaje de resguardo aplicado sobre la devolución bruta para cada
          institución financiera. Instituciones con mayor riesgo usan márgenes más
          altos.
        </p>
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar institución..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        {isDirty && (
          <Badge
            variant="outline"
            className="bg-amber-50 border-amber-300 text-amber-700"
          >
            Cambios sin guardar
          </Badge>
        )}
      </div>

      <div className="grid gap-2">
        {filtered.map((row) => {
          const def =
            DEFAULT_SAFETY_MARGINS.find((d) => d.institution === row.institution)
              ?.margin ?? row.margin;
          const changed = row.margin !== def;
          const isHighRisk = row.margin >= HIGH_RISK_THRESHOLD;
          const Icon = isHighRisk ? ShieldAlert : ShieldCheck;
          const accent = isHighRisk
            ? 'from-amber-500 to-orange-600'
            : 'from-emerald-500 to-teal-600';

          return (
            <div
              key={row.institution}
              className="flex items-center gap-4 rounded-xl border border-border/60 overflow-hidden"
            >
              <div
                className={`w-1.5 self-stretch bg-gradient-to-b ${accent} shrink-0`}
              />
              <div className="flex items-center gap-3 flex-1 py-2.5 pr-4">
                <div
                  className={`p-2 rounded-lg bg-gradient-to-br ${accent} shrink-0`}
                >
                  <Icon className="h-4 w-4 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <Label
                    htmlFor={`margin-${row.institution}`}
                    className="font-medium text-sm cursor-pointer"
                  >
                    {row.institution}
                  </Label>
                  {changed && (
                    <p className="text-xs text-muted-foreground">
                      Valor por defecto: {def}%
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Input
                    id={`margin-${row.institution}`}
                    type="number"
                    min={0}
                    max={100}
                    step={0.5}
                    value={row.margin}
                    onChange={(e) => handleChange(row.institution, e.target.value)}
                    className="w-24 text-center font-semibold"
                  />
                  <span className="text-sm text-muted-foreground w-4">%</span>
                  {changed && (
                    <button
                      type="button"
                      onClick={() =>
                        handleChange(row.institution, String(def))
                      }
                      className="text-muted-foreground hover:text-foreground transition-colors"
                      title="Restaurar valor por defecto"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="text-center text-sm text-muted-foreground py-8 border border-dashed rounded-xl">
            Sin resultados para "{search}"
          </div>
        )}
      </div>

      <Separator />

      <div className="flex items-center justify-between rounded-lg bg-muted/50 px-4 py-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <ShieldCheck className="h-4 w-4" />
          <span>Margen promedio configurado</span>
        </div>
        <span className="font-bold text-foreground text-lg">{promedio}%</span>
      </div>

      <div className="flex items-center justify-between gap-3">
        <Button variant="outline" size="sm" onClick={handleReset} className="gap-2">
          <RotateCcw className="h-3.5 w-3.5" />
          Restaurar defaults
        </Button>
        <Button size="sm" onClick={handleSave} disabled={!isDirty} className="gap-2">
          <Save className="h-3.5 w-3.5" />
          Guardar cambios
        </Button>
      </div>
    </div>
  );
}