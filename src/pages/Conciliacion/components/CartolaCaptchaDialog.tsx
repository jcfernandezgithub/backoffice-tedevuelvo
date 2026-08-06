import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { AlertTriangle, Loader2, ShieldCheck, Sparkles } from 'lucide-react'

interface CartolaCaptchaDialogProps {
  open: boolean
  image: string | null
  message: string | null
  submitting: boolean
  /** Texto detectado automáticamente por OCR para pre-cargar el input. */
  suggestedCode?: string | null
  /** true mientras el servicio OCR está procesando la imagen. */
  solving?: boolean
  onSubmit: (code: string) => void
  onCancel: () => void
}

/**
 * Modal de validación CAPTCHA de Scotiabank.
 * No se puede cerrar accidentalmente: cancelar requiere confirmación,
 * ya que el trabajo de descarga queda invalidado y debe comenzar de nuevo.
 */
export function CartolaCaptchaDialog({
  open,
  image,
  message,
  submitting,
  suggestedCode,
  solving,
  onSubmit,
  onCancel,
}: CartolaCaptchaDialogProps) {
  const [code, setCode] = useState('')
  const [confirmingCancel, setConfirmingCancel] = useState(false)

  // Limpiar el input al abrir y cada vez que llega una nueva imagen
  // (captcha rechazado o renovado por el banco).
  useEffect(() => {
    if (open) {
      setCode('')
      setConfirmingCancel(false)
    }
  }, [open, image])

  // Pre-cargar el código detectado por OCR sin pisar lo que el usuario
  // ya haya escrito manualmente.
  useEffect(() => {
    if (suggestedCode) {
      setCode((prev) => (prev.trim() ? prev : suggestedCode))
    }
  }, [suggestedCode])

  const handleSubmit = () => {
    if (!code.trim() || submitting || !image) return
    onSubmit(code)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        // Sin cierre accidental: cualquier intento de cerrar pide confirmación.
        if (!o && !submitting) setConfirmingCancel(true)
      }}
    >
      <DialogContent
        className="sm:max-w-md [&>button]:hidden"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => {
          e.preventDefault()
          if (!submitting) setConfirmingCancel(true)
        }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Validación requerida por Scotiabank
          </DialogTitle>
          <DialogDescription>
            El banco solicita un código de verificación para continuar con la descarga de la
            cartola.
          </DialogDescription>
        </DialogHeader>

        {confirmingCancel ? (
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-md border border-amber-300 bg-amber-50 p-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-sm">
                <div className="font-medium text-amber-800">¿Cancelar la descarga?</div>
                <p className="text-amber-700 mt-0.5">
                  Se perderá el progreso actual y deberás comenzar nuevamente: el banco volverá a
                  solicitar un código de verificación.
                </p>
              </div>
            </div>
            <DialogFooter className="gap-2 sm:gap-2">
              <Button variant="outline" onClick={() => setConfirmingCancel(false)}>
                Volver
              </Button>
              <Button variant="destructive" onClick={onCancel}>
                Sí, cancelar
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            {image ? (
              <img
                src={image}
                alt="CAPTCHA de Scotiabank"
                className="w-full rounded-md border bg-white p-2"
              />
            ) : (
              <div className="flex h-20 items-center justify-center gap-2 rounded-md border bg-muted/30 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Cargando imagen…
              </div>
            )}

            {message && (
              <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{message}</span>
              </div>
            )}

            <div className="space-y-2">
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleSubmit()
                  }
                }}
                placeholder="Ingresa el código de la imagen"
                autoComplete="off"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                autoFocus
                disabled={submitting}
                className="text-center text-lg tracking-[0.3em] font-mono"
              />
              {solving && !suggestedCode ? (
                <p className="text-xs text-muted-foreground text-center flex items-center justify-center gap-1.5">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Detectando código automáticamente…
                </p>
              ) : suggestedCode && code === suggestedCode ? (
                <p className="text-xs text-primary text-center flex items-center justify-center gap-1.5">
                  <Sparkles className="h-3 w-3" />
                  Código detectado automáticamente — verifícalo antes de continuar.
                </p>
              ) : (
                <p className="text-xs text-muted-foreground text-center">
                  Escribe exactamente los caracteres que ves en la imagen.
                </p>
              )}
            </div>

            <DialogFooter className="gap-2 sm:gap-2">
              <Button
                variant="ghost"
                onClick={() => setConfirmingCancel(true)}
                disabled={submitting}
              >
                Cancelar
              </Button>
              <Button onClick={handleSubmit} disabled={!code.trim() || submitting || !image}>
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Validando…
                  </>
                ) : (
                  'Continuar descarga'
                )}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}