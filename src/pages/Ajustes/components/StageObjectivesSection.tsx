import { useState } from 'react';
import { useStageObjectives, DEFAULT_STAGE_OBJECTIVES } from '@/hooks/useStageObjectives';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  FileCheck2,
  FileInput,
  CheckCircle,
  CalendarClock,
  Banknote,
  RotateCcw,
  Save,
  Target,
  Clock,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

const STAGE_ICONS: Record<string, LucideIcon> = {
  docs_received:     FileCheck2,
  submitted:         FileInput,
  approved:          CheckCircle,
  payment_scheduled: CalendarClock,
  paid:              Banknote,
};

const STAGE_GRADIENTS: Record<string, string> = {
  docs_received:     'from-purple-500 to-purple-600',
  submitted:         'from-indigo-500 to-indigo-600',
  approved:          'from-emerald-500 to-emerald-600',
  payment_scheduled: 'from-cyan-500 to-cyan-600',
  paid:              'from-teal-500 to-teal-600',
};

export function StageObjectivesSection() {
  const { objectives, save, reset } = useStageObjectives();
  const [draft, setDraft] = useState(objectives.map(o => ({ ...o })));
  const [isDirty, setIsDirty] = useState(false);

  const handleChange = (key: string, value: string) => {
    const num = parseInt(value, 10);
    if (isNaN(num) || num < 1 || num > 365) return;
    setDraft(prev => prev.map(o => o.key === key ? { ...o, objetivo: num } : o));
    setIsDirty(true);
  };

  const handleSave = () => {
    save(draft);
    setIsDirty(false);
    toast.success('Objetivos actualizados', {
      description: 'Los cambios se aplicarán al tab Cuellos de Botella.',
    });
  };

  const handleReset = () => {
    const fresh = DEFAULT_STAGE_OBJECTIVES.map(o => ({ ...o }));
    setDraft(fresh);
    reset();
    setIsDirty(false);
    toast.info('Objetivos restaurados a los valores por defecto.');
  };

  const draftTotal = draft.reduce((sum, o) => sum + o.objetivo, 0);
  const defaultTotal = DEFAULT_STAGE_OBJECTIVES.reduce((sum, o) => sum + o.objetivo, 0);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Objetivos de tiempo por etapa</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Días máximos esperados para cada transición del proceso de devolución.
          Estos valores se usan en el tab <strong>Cuellos de Botella</strong> para
          identificar etapas fuera de plazo.
        </p>
      </div>

      <div className="flex items-center gap-2">
        {isDirty && (
          <Badge variant="outline" className="bg-amber-50 border-amber-300 text-amber-700">
            Cambios sin guardar
          </Badge>
        )}
      </div>

      <div className="grid gap-3">
        {draft.map((stage) => {
          const Icon = STAGE_ICONS[stage.key];
          const gradient = STAGE_GRADIENTS[stage.key];
          const defaultDays = DEFAULT_STAGE_OBJECTIVES.find(d => d.key === stage.key)?.objetivo ?? stage.objetivo;
          const changed = stage.objetivo !== defaultDays;

          return (
            <div
              key={stage.key}
              className="flex items-center gap-4 rounded-xl border border-border/60 overflow-hidden"
            >
              <div className={`w-1.5 self-stretch bg-gradient-to-b ${gradient} shrink-0`} />
              <div className="flex items-center gap-3 flex-1 py-3 pr-4">
                <div className={`p-2 rounded-lg bg-gradient-to-br ${gradient} shrink-0`}>
                  <Icon className="h-4 w-4 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <Label htmlFor={`obj-${stage.key}`} className="font-medium text-sm cursor-pointer">
                    {stage.label}
                  </Label>
                  {changed && (
                    <p className="text-xs text-muted-foreground">Valor por defecto: {defaultDays}d</p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Input
                    id={`obj-${stage.key}`}
                    type="number"
                    min={1}
                    max={365}
                    value={stage.objetivo}
                    onChange={e => handleChange(stage.key, e.target.value)}
                    className="w-20 text-center font-semibold"
                  />
                  <span className="text-sm text-muted-foreground w-6">días</span>
                  {changed && (
                    <button
                      type="button"
                      onClick={() => handleChange(stage.key, String(defaultDays))}
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
      </div>

      <Separator />

      <div className="flex items-center justify-between rounded-lg bg-muted/50 px-4 py-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="h-4 w-4" />
          <span>Proceso completo (suma de objetivos)</span>
        </div>
        <div className="flex items-center gap-2">
          {draftTotal !== defaultTotal && (
            <span className="text-xs text-muted-foreground line-through">{defaultTotal}d</span>
          )}
          <span className="font-bold text-foreground text-lg">{draftTotal}d</span>
        </div>
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
