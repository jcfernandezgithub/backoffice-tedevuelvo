import {
  Sparkles,
  ShieldAlert,
  Info,
  FileCheck2,
  Loader2,
  RefreshCw,
  CloudOff,
  Globe,
} from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useAiValidationConfig } from '@/hooks/useAiValidationConfig'
import { cn } from '@/lib/utils'

// ─── Tarjeta de interruptor individual ──────────────────────────────────────

interface FlagCardProps {
  id: string
  icon: React.ElementType
  title: string
  stage: React.ReactNode
  description: React.ReactNode
  info: React.ReactNode
  warning: React.ReactNode
  enabled: boolean
  saving: boolean
  onChange: (value: boolean) => void
}

function FlagCard({
  id,
  icon: Icon,
  title,
  stage,
  description,
  info,
  warning,
  enabled,
  saving,
  onChange,
}: FlagCardProps) {
  return (
    <Card className="overflow-hidden border-border/60">
      <div
        className={cn(
          'px-5 py-4 border-b flex items-center gap-3 transition-colors',
          enabled ? 'bg-primary/5 border-primary/20' : 'bg-muted/40 border-border/60',
        )}
      >
        <div
          className={cn(
            'h-10 w-10 rounded-lg grid place-items-center shrink-0',
            enabled ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground',
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold leading-tight">{title}</p>
          <p className="text-xs text-muted-foreground leading-tight mt-1">{stage}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {saving && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
          <Label htmlFor={id} className="text-xs text-muted-foreground">
            {saving ? 'Guardando…' : enabled ? 'Activada' : 'Desactivada'}
          </Label>
          <Switch id={id} checked={enabled} disabled={saving} onCheckedChange={onChange} />
        </div>
      </div>

      <CardContent className="pt-5 space-y-4">
        <p className="text-sm text-foreground/80 leading-relaxed">{description}</p>

        <div className="rounded-lg border bg-muted/30 px-4 py-3 flex items-start gap-2.5">
          <Info className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
          <p className="text-xs text-muted-foreground leading-relaxed">{info}</p>
        </div>

        {!enabled && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900 px-4 py-3 flex items-start gap-2.5">
            <ShieldAlert className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-900 dark:text-amber-200 leading-relaxed">
              {warning}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ─── Sección principal ──────────────────────────────────────────────────────

export function AIValidationSection() {
  const {
    config,
    isLoading,
    isError,
    error,
    refetch,
    update,
    savingField,
    dataUpdatedAt,
  } = useAiValidationConfig()

  const lastSync = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString('es-CL', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    : null

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-3xl">
        {[0, 1].map((i) => (
          <Card key={i} className="overflow-hidden border-border/60">
            <div className="px-5 py-4 border-b border-border/60 flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-lg" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-56" />
                <Skeleton className="h-3 w-40" />
              </div>
              <Skeleton className="h-6 w-11 rounded-full" />
            </div>
            <CardContent className="pt-5 space-y-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (isError) {
    return (
      <div className="space-y-6 max-w-3xl">
        <Card className="overflow-hidden border-destructive/40">
          <CardContent className="pt-6 pb-6 flex flex-col items-center text-center gap-3">
            <div className="h-11 w-11 rounded-full bg-destructive/10 grid place-items-center">
              <CloudOff className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <p className="text-sm font-semibold">No se pudo obtener la configuración</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-md">
                {(error as Error)?.message ||
                  'El servicio de validación con IA no respondió. Por seguridad, ambas validaciones se asumen deshabilitadas hasta confirmar su estado.'}
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2">
              <RefreshCw className="h-3.5 w-3.5" />
              Reintentar
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="rounded-lg border bg-muted/30 px-4 py-3 flex items-start gap-2.5">
        <Globe className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          Configuración <span className="font-medium">global persistida en el servidor</span>:
          aplica a todos los usuarios de forma inmediata y solo puede modificarla un
          usuario con rol <span className="font-medium">ADMIN</span>. Cada interruptor se
          guarda de forma independiente y se revierte automáticamente si el guardado falla.
          {lastSync && (
            <span className="block mt-1.5 text-muted-foreground/80">
              Última sincronización con el servidor: {lastSync}
            </span>
          )}
        </p>
      </div>

      <FlagCard
        id="ai-cedula"
        icon={Sparkles}
        title="Validación de cédula con IA"
        stage={
          <>
            Etapa: cambio a estado <span className="font-medium">Documentos recibidos</span>
          </>
        }
        description={
          <>
            Cuando está activada, antes de marcar una solicitud como{' '}
            <span className="font-medium">Documentos recibidos</span> se ejecuta una
            validación visual del frente y reverso de la cédula de identidad chilena
            mediante un servicio de IA. El operador puede continuar con el cambio de
            estado de todas formas si el resultado no es concluyente.
          </>
        }
        info={
          <>
            Al desactivar este flag, el botón <span className="font-medium">“Validar
            documentos con IA”</span> deja de aparecer y el operador puede actualizar el
            estado directamente, sin paso de validación visual.
          </>
        }
        warning={
          <>
            La validación con IA está <span className="font-medium">desactivada</span>.
            Asegúrate de revisar manualmente las cédulas antes de avanzar las solicitudes.
          </>
        }
        enabled={config.imageValidationEnabled}
        saving={savingField === 'imageValidationEnabled'}
        onChange={(v) => update({ imageValidationEnabled: v })}
      />

      <FlagCard
        id="ai-credito"
        icon={FileCheck2}
        title="Validación de documentos de crédito con IA"
        stage={
          <>
            Etapa: cambio a estado <span className="font-medium">Documentos recibidos</span> · Tipo{' '}
            <span className="font-medium">Otros</span>
          </>
        }
        description={
          <>
            Cuando está activada, después de validar la cédula se ejecuta una validación
            visual sobre los documentos cargados con tipo{' '}
            <span className="font-medium">Otros</span> para verificar que correspondan a
            un documento asociado a un crédito de consumo (contrato, pagaré u
            equivalente).
          </>
        }
        info={
          <>
            Si no hay documentos cargados con tipo <span className="font-medium">Otros</span>,
            este paso se omite automáticamente. El operador siempre puede continuar
            con el cambio de estado bajo su responsabilidad.
          </>
        }
        warning={
          <>
            La validación de documentos de crédito está{' '}
            <span className="font-medium">desactivada</span>. Asegúrate de revisar
            manualmente los archivos cargados.
          </>
        }
        enabled={config.docsValidationEnabled}
        saving={savingField === 'docsValidationEnabled'}
        onChange={(v) => update({ docsValidationEnabled: v })}
      />
    </div>
  )
}