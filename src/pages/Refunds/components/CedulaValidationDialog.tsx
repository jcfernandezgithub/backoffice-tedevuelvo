import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Loader2, ShieldCheck, ShieldAlert, ShieldX, Sparkles, RefreshCw } from 'lucide-react'
import { authService } from '@/services/authService'
import {
  validateCedulaChilenaDocuments,
  buildDocumentValidationMessage,
  type CedulaValidationResponse,
  type ValidationMessage,
} from '@/lib/cedulaValidation'
import type { RefundDocument } from '@/types/refund'

const API_BASE_URL = 'https://tedevuelvo-app-be.onrender.com/api/v1'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  publicId: string
  documents: RefundDocument[]
  onValidated: () => void
}

const CEDULA_FRENTE_KIND = 'cedula-frente'
const CEDULA_TRASERA_KIND = 'cedula-trasera'

async function downloadDocAsFile(
  publicId: string,
  doc: RefundDocument,
  fallbackName: string,
): Promise<File> {
  const token = authService.getAccessToken()
  const url = `${API_BASE_URL}/refund-requests/admin/${publicId}/refund-documents/${doc.id}`
  const response = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  if (!response.ok) {
    throw new Error('No se pudo descargar el documento desde el servidor.')
  }
  const blob = await response.blob()
  const contentType = doc.contentType || blob.type || 'image/jpeg'
  const ext = contentType.split('/')[1] || 'jpg'
  return new File([blob], `${fallbackName}.${ext}`, { type: contentType })
}

export function CedulaValidationDialog({
  open,
  onOpenChange,
  publicId,
  documents,
  onValidated,
}: Props) {
  const [phase, setPhase] = useState<'idle' | 'loading' | 'result' | 'error'>('idle')
  const [message, setMessage] = useState<ValidationMessage | null>(null)
  const [canContinue, setCanContinue] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const reset = () => {
    setPhase('idle')
    setMessage(null)
    setCanContinue(false)
    setErrorMsg(null)
  }

  const handleClose = (next: boolean) => {
    if (!next) reset()
    onOpenChange(next)
  }

  const runValidation = async () => {
    setPhase('loading')
    setErrorMsg(null)
    setMessage(null)
    setCanContinue(false)

    const frente = documents.find((d) => d.kind === CEDULA_FRENTE_KIND)
    const trasera = documents.find((d) => d.kind === CEDULA_TRASERA_KIND)

    if (!frente || !trasera) {
      setPhase('error')
      setErrorMsg(
        'Faltan documentos cargados. Asegúrate de que estén el frente y reverso de la cédula.',
      )
      return
    }

    try {
      const [anversoFile, reversoFile] = await Promise.all([
        downloadDocAsFile(publicId, frente, 'anverso'),
        downloadDocAsFile(publicId, trasera, 'reverso'),
      ])

      let validation: CedulaValidationResponse
      try {
        validation = await validateCedulaChilenaDocuments({ anversoFile, reversoFile })
      } catch {
        setPhase('error')
        setErrorMsg(
          'No pudimos validar los documentos en este momento. Intenta nuevamente.',
        )
        return
      }

      const msg = buildDocumentValidationMessage(validation)
      setMessage(msg)
      setCanContinue(validation.es_valida_para_continuar_proceso === true)
      setPhase('result')
    } catch (e: any) {
      setPhase('error')
      setErrorMsg(e?.message || 'Error al preparar los documentos para validación.')
    }
  }

  const handleContinue = () => {
    onValidated()
    handleClose(false)
  }

  const statusVisual = (() => {
    if (!message) return null
    if (message.estado_validacion === 'ok')
      return { Icon: ShieldCheck, color: 'text-green-600', bg: 'bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-900' }
    if (message.estado_validacion === 'advertencia')
      return { Icon: ShieldAlert, color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-900' }
    return { Icon: ShieldX, color: 'text-destructive', bg: 'bg-destructive/10 border-destructive/30' }
  })()

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Validación de documentos con IA
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Validaremos visualmente que el frente y reverso correspondan a una cédula
            de identidad chilena antes de cambiar el estado.
          </p>
        </DialogHeader>

        {phase === 'idle' && (
          <div className="space-y-4 py-2">
            <Alert>
              <AlertTitle>¿Cómo funciona?</AlertTitle>
              <AlertDescription>
                Se enviarán las imágenes ya cargadas de la cédula (frente y reverso) a
                un servicio de validación visual. La revisión es solo visual y no constituye
                una certificación oficial.
              </AlertDescription>
            </Alert>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => handleClose(false)}>
                Cancelar
              </Button>
              <Button onClick={runValidation}>
                <Sparkles className="h-4 w-4 mr-2" />
                Iniciar validación
              </Button>
            </div>
          </div>
        )}

        {phase === 'loading' && (
          <div className="flex flex-col items-center justify-center py-10 gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm font-medium">Estamos validando los documentos…</p>
            <p className="text-xs text-muted-foreground">Esto puede tomar unos segundos.</p>
          </div>
        )}

        {phase === 'result' && message && statusVisual && (
          <div className="space-y-4 py-2">
            <div className={`rounded-lg border p-4 ${statusVisual.bg}`}>
              <div className="flex items-start gap-3">
                <statusVisual.Icon className={`h-6 w-6 mt-0.5 ${statusVisual.color}`} />
                <div className="space-y-1">
                  <h3 className="font-semibold">{message.titulo}</h3>
                  <p className="text-sm">{message.mensaje}</p>
                  <p className="text-sm text-muted-foreground">{message.accion_recomendada}</p>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              {message.puede_reintentar && (
                <Button variant="outline" onClick={runValidation}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Reintentar validación
                </Button>
              )}
              <Button variant="outline" onClick={() => handleClose(false)}>
                Volver a cargar documentos
              </Button>
              {canContinue ? (
                <Button onClick={handleContinue}>
                  Continuar y actualizar estado
                </Button>
              ) : (
                <Button disabled title="La validación no permite continuar">
                  Continuar y actualizar estado
                </Button>
              )}
            </div>
          </div>
        )}

        {phase === 'error' && (
          <div className="space-y-4 py-2">
            <Alert variant="destructive">
              <AlertTitle>No pudimos validar los documentos</AlertTitle>
              <AlertDescription>
                {errorMsg ||
                  'No pudimos validar los documentos en este momento. Intenta nuevamente.'}
              </AlertDescription>
            </Alert>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => handleClose(false)}>
                Cerrar
              </Button>
              <Button onClick={runValidation}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Reintentar
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}