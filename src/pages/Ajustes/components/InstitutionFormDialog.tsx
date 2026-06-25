import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import type { Institution, InstitutionPayload } from '@/services/institutionsService';

const schema = z.object({
  label: z.string().min(2, 'Mínimo 2 caracteres').max(80),
  value: z
    .string()
    .min(2, 'Mínimo 2 caracteres')
    .max(60),
  grupo: z.string().min(1, 'Requerido').max(80),
  margen_seguridad: z
    .number({ invalid_type_error: 'Debe ser numérico' })
    .min(0)
    .max(100),
  active: z.boolean(),
});

type FormValues = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: Institution | null;
  onSubmit: (payload: InstitutionPayload) => Promise<void> | void;
  isSaving?: boolean;
}

export function InstitutionFormDialog({
  open,
  onOpenChange,
  initial,
  onSubmit,
  isSaving,
}: Props) {
  const isEdit = !!initial;
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      label: '',
      value: '',
      grupo: '',
      margen_seguridad: 10,
      active: true,
    },
  });

  useEffect(() => {
    if (open) {
      form.reset(
        initial
          ? {
              label: initial.label,
              value: initial.value,
              grupo: initial.grupo,
              margen_seguridad: initial.margen_seguridad,
              active: initial.active,
            }
          : {
              label: '',
              value: '',
              grupo: '',
              margen_seguridad: 10,
              active: true,
            },
      );
    }
  }, [open, initial, form]);

  const handleSubmit = form.handleSubmit(async (values) => {
    await onSubmit(values as InstitutionPayload);
  });

  const errors = form.formState.errors;
  const active = form.watch('active');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? 'Editar institución' : 'Nueva institución'}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Modifica los datos de la institución financiera.'
              : 'Define una nueva institución financiera disponible para la calculadora.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="inst-label">Nombre visible</Label>
            <Input
              id="inst-label"
              placeholder="Banco Santander"
              {...form.register('label')}
            />
            {errors.label && (
              <p className="text-xs text-destructive">{errors.label.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="inst-value">
                Identificador (slug)
                {isEdit && (
                  <span className="ml-1 text-[10px] text-amber-600">
                    cambiar puede romper solicitudes existentes
                  </span>
                )}
              </Label>
              <Input
                id="inst-value"
                placeholder="santander"
                {...form.register('value')}
              />
              {errors.value && (
                <p className="text-xs text-destructive">{errors.value.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="inst-grupo">Grupo</Label>
              <Input
                id="inst-grupo"
                placeholder="Bancos / Consumo / ..."
                {...form.register('grupo')}
              />
              {errors.grupo && (
                <p className="text-xs text-destructive">{errors.grupo.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="inst-margen">Margen de seguridad (%)</Label>
            <Input
              id="inst-margen"
              type="number"
              min={0}
              max={100}
              step={0.5}
              {...form.register('margen_seguridad', { valueAsNumber: true })}
            />
            {errors.margen_seguridad && (
              <p className="text-xs text-destructive">
                {errors.margen_seguridad.message}
              </p>
            )}
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2.5">
            <div>
              <Label htmlFor="inst-active" className="text-sm">
                Visible en calculadora
              </Label>
              <p className="text-xs text-muted-foreground">
                Las instituciones inactivas no se ofrecen al cliente final.
              </p>
            </div>
            <Switch
              id="inst-active"
              checked={active}
              onCheckedChange={(v) => form.setValue('active', v, { shouldDirty: true })}
            />
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Crear institución'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}