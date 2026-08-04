import { ScanSearch, ShieldAlert, Info, Loader2, RefreshCw, CloudOff, Globe } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useAiImageValidation } from '@/hooks/useAiImageValidation'
import { cn } from '@/lib/utils'

export function AiImageValidationSection() {
  const {
    data: enabled,
    isLoading,
    isError,
    error,
    refetch,
    toggle,
    isSaving,
    dataUpdatedAt,
  } = useAiImageValidation()

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
        <Card className="overflow-hidden border-border/60">
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
                  'El servicio de validación de imágenes no respondió. Por seguridad, la funcionalidad se asume deshabilitada hasta confirmar su estado.'}
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

  const isOn = enabled === true

  return (
    <div className="space-y-6 max-w-3xl">
      <Card className="overflow-hidden border-border/60">
        <div
          className={cn(
            'px-5 py-4 border-b flex items-center gap-3 transition-colors',
            isOn ? 'bg-primary/5 border-primary/20' : 'bg-muted/40 border-border/60',
          )}
        >
          <div
            className={cn(
              'h-10 w-10 rounded-lg grid place-items-center shrink-0',
              isOn ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground',
            )}
          >
            <ScanSearch className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold leading-tight">
              Validación de imágenes con IA
            </p>
            <p className="text-xs text-muted-foreground leading-tight mt-1 flex items-center gap-1">
              <Globe className="h-3 w-3" />
              Interruptor global · persistido en el servidor
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {isSaving && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
            <Label htmlFor="ai-image-validation" className="text-xs text-muted-foreground">
              {isSaving ? 'Guardando…' : isOn ? 'Habilitada' : 'Deshabilitada'}
            </Label>
            <Switch
              id="ai-image-validation"
              checked={isOn}
              disabled={isSaving}
              onCheckedChange={(v) => toggle(v)}
            />
          </div>
        </div>

        <CardContent className="pt-5 space-y-4">
          <p className="text-sm text-foreground/80 leading-relaxed">
            Interruptor global de la funcionalidad de{' '}
            <span className="font-medium">validación de imágenes mediante inteligencia
            artificial</span>. Cuando está habilitado, los flujos que analizan imágenes con
            IA quedan disponibles; al deshabilitarlo, esos flujos se ocultan o se omiten en
            toda la plataforma.
          </p>

          <div className="rounded-lg border bg-muted/30 px-4 py-3 flex items-start gap-2.5">
            <Info className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
            <p className="text-xs text-muted-foreground leading-relaxed">
              El estado se guarda en el servidor y aplica a todos los usuarios de forma
              inmediata. El cambio requiere rol <span className="font-medium">ADMIN</span> y
              se revierte automáticamente si el guardado falla.
              {lastSync && (
                <span className="block mt-1.5 text-muted-foreground/80">
                  Última sincronización con el servidor: {lastSync}
                </span>
              )}
            </p>
          </div>

          {!isOn && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900 px-4 py-3 flex items-start gap-2.5">
              <ShieldAlert className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
              <p className="text-xs text-amber-900 dark:text-amber-200 leading-relaxed">
                La validación de imágenes con IA está{' '}
                <span className="font-medium">deshabilitada globalmente</span>. Los análisis
                automáticos de imágenes no se ejecutarán hasta que se reactive este
                interruptor.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}