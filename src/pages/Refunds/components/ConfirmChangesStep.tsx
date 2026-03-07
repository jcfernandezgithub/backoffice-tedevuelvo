import { AlertTriangle, ArrowRight, Calculator } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'

export interface FieldChange {
  label: string
  from: string
  to: string
  isAutoCalculated?: boolean
}

interface ConfirmChangesStepProps {
  changes: FieldChange[]
  onConfirm: () => void
  onBack: () => void
  isPending: boolean
}

export function ConfirmChangesStep({
  changes,
  onConfirm,
  onBack,
  isPending,
}: ConfirmChangesStepProps) {
  return (
    <div className="space-y-4 py-2">
      <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950/30">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
        <div className="space-y-1">
          <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
            Estás a punto de modificar datos sensibles
          </p>
          <p className="text-xs text-amber-700 dark:text-amber-400">
            Revisa los cambios a continuación antes de confirmar. Esta acción no se puede deshacer.
          </p>
        </div>
      </div>

      {(() => {
        const manualChanges = changes.filter(c => !c.isAutoCalculated)
        const autoChanges = changes.filter(c => c.isAutoCalculated)
        return (
          <>
            <div className="space-y-0 rounded-lg border bg-muted/30">
              {manualChanges.map((change, i) => (
                <div key={change.label}>
                  {i > 0 && <Separator />}
                  <div className="px-4 py-3 space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">{change.label}</p>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-muted-foreground line-through max-w-[40%] truncate">
                        {change.from || '(vacío)'}
                      </span>
                      <ArrowRight className="h-3.5 w-3.5 shrink-0 text-primary" />
                      <span className="font-medium text-foreground max-w-[40%] truncate">
                        {change.to || '(vacío)'}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {autoChanges.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Calculator className="h-3.5 w-3.5" />
                  <span className="font-medium">Campos recalculados automáticamente</span>
                </div>
                <div className="space-y-0 rounded-lg border border-dashed bg-muted/20">
                  {autoChanges.map((change, i) => (
                    <div key={change.label}>
                      {i > 0 && <Separator />}
                      <div className="px-4 py-2.5 space-y-1">
                        <p className="text-xs font-medium text-muted-foreground">{change.label}</p>
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-muted-foreground line-through max-w-[40%] truncate">
                            {change.from || '(vacío)'}
                          </span>
                          <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          <span className="font-medium text-foreground max-w-[40%] truncate">
                            {change.to || '(vacío)'}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <p className="text-xs text-center text-muted-foreground">
              {manualChanges.length} campo{manualChanges.length > 1 ? 's' : ''} editado{manualChanges.length > 1 ? 's' : ''}
              {autoChanges.length > 0 && ` · ${autoChanges.length} recalculado${autoChanges.length > 1 ? 's' : ''}`}
            </p>
          </>
        )
      })()}

      <div className="flex justify-end gap-2 pt-2 border-t">
        <Button type="button" variant="outline" onClick={onBack} disabled={isPending}>
          Volver a editar
        </Button>
        <Button type="button" onClick={onConfirm} disabled={isPending} variant="destructive">
          {isPending ? 'Guardando...' : 'Confirmar cambios'}
        </Button>
      </div>
    </div>
  )
}
