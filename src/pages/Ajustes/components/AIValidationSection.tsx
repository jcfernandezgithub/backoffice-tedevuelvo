import { Sparkles, ShieldAlert, Info } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { useAIValidationSettings } from '@/hooks/useAIValidationSettings'
import { cn } from '@/lib/utils'

export function AIValidationSection() {
  const { enabled, setEnabled } = useAIValidationSettings()

  return (
    <div className="space-y-6 max-w-3xl">
      <Card className="overflow-hidden border-border/60">
        <div
          className={cn(
            'px-5 py-4 border-b flex items-center gap-3 transition-colors',
            enabled
              ? 'bg-primary/5 border-primary/20'
              : 'bg-muted/40 border-border/60',
          )}
        >
          <div
            className={cn(
              'h-10 w-10 rounded-lg grid place-items-center shrink-0',
              enabled ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground',
            )}
          >
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold leading-tight">
              Validación de cédula con IA
            </p>
            <p className="text-xs text-muted-foreground leading-tight mt-1">
              Etapa: cambio a estado <span className="font-medium">Documentos recibidos</span>
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Label htmlFor="ai-cedula" className="text-xs text-muted-foreground">
              {enabled ? 'Activada' : 'Desactivada'}
            </Label>
            <Switch
              id="ai-cedula"
              checked={enabled}
              onCheckedChange={setEnabled}
            />
          </div>
        </div>

        <CardContent className="pt-5 space-y-4">
          <p className="text-sm text-foreground/80 leading-relaxed">
            Cuando está activada, antes de marcar una solicitud como{' '}
            <span className="font-medium">Documentos recibidos</span> se ejecuta una
            validación visual del frente y reverso de la cédula de identidad chilena
            mediante un servicio de IA. El operador puede continuar con el cambio de
            estado de todas formas si el resultado no es concluyente.
          </p>

          <div className="rounded-lg border bg-muted/30 px-4 py-3 flex items-start gap-2.5">
            <Info className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
            <p className="text-xs text-muted-foreground leading-relaxed">
              Al desactivar este flag, el botón <span className="font-medium">“Validar
              documentos con IA”</span> deja de aparecer y el operador puede
              actualizar el estado directamente, sin paso de validación visual.
            </p>
          </div>

          {!enabled && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900 px-4 py-3 flex items-start gap-2.5">
              <ShieldAlert className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
              <p className="text-xs text-amber-900 dark:text-amber-200 leading-relaxed">
                La validación con IA está <span className="font-medium">desactivada</span>.
                Asegúrate de revisar manualmente las cédulas antes de avanzar las solicitudes.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}