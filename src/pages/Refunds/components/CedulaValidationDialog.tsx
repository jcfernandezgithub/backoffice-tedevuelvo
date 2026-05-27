import { useEffect, useMemo, useState } from 'react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import {
  Loader2,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  Sparkles,
  RefreshCw,
  ArrowRight,
  Lock,
  ScanLine,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  X,
  FileText,
  Info,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { authService } from '@/services/authService'
import {
  validateCedulaChilenaDocuments,
  buildDocumentValidationMessage,
  type CedulaValidationResponse,
  type ValidationMessage,
} from '@/lib/cedulaValidation'
import {
  validateCreditoDocument,
  buildCreditoValidationMessage,
  type CreditoValidationResponse,
  type CreditoValidationMessage,
} from '@/lib/creditoValidation'
import {
  useAIValidationSettings,
  useCreditoDocsValidationSettings,
} from '@/hooks/useAIValidationSettings'
import type { RefundDocument } from '@/types/refund'
import { cn } from '@/lib/utils'

const API_BASE_URL = 'https://tedevuelvo-app-be.onrender.com/api/v1'
const CEDULA_FRENTE_KIND = 'cedula-frente'
const CEDULA_TRASERA_KIND = 'cedula-trasera'
const OTROS_KIND = 'otros'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  publicId: string
  documents: RefundDocument[]
  onValidated: (forced?: boolean) => void
}

type Phase =
  | 'idle'
  | 'loading'
  | 'result'
  | 'error'
  | 'credito-loading'
  | 'credito-result'
  | 'credito-error'

interface ValidationDetails {
  resumen?: string
  recomendacion?: string
  alertas?: string[]
  motivos?: string[]
}

interface CreditoDocResult {
  doc: RefundDocument
  fileName: string
  message: CreditoValidationMessage
  canContinue: boolean
  details: ValidationDetails
  extra: CreditoExtra
}

interface CreditoExtra {
  corresponde?: boolean
  cumpleMinimo?: boolean
  nivelConfianza?: string
  tipoDetectado?: string
  subtipoDetectado?: string
  campos?: Record<string, string>
  observacionMinimos?: string
  recomendado: boolean
}

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

/** Pasos visibles durante el loading para que se sienta vivo y profesional. */
const LOADING_STEPS = [
  { label: 'Preparando imágenes', icon: ScanLine },
  { label: 'Analizando anverso', icon: Sparkles },
  { label: 'Analizando reverso', icon: Sparkles },
  { label: 'Verificando correspondencia', icon: ShieldCheck },
] as const

export function CedulaValidationDialog({
  open,
  onOpenChange,
  publicId,
  documents,
  onValidated,
}: Props) {
  const [phase, setPhase] = useState<Phase>('idle')
  const [message, setMessage] = useState<ValidationMessage | null>(null)
  const [canContinue, setCanContinue] = useState(false)
  const [details, setDetails] = useState<ValidationDetails | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [loadingStep, setLoadingStep] = useState(0)
  const [confirmForce, setConfirmForce] = useState(false)
  const [forcedCedula, setForcedCedula] = useState(false)
  const [creditoResults, setCreditoResults] = useState<CreditoDocResult[]>([])
  const [creditoProgress, setCreditoProgress] = useState<{ current: number; total: number; fileName?: string }>({ current: 0, total: 0 })
  const [creditoConfirmForce, setCreditoConfirmForce] = useState(false)
  const { enabled: cedulaEnabled } = useAIValidationSettings()
  const { enabled: creditoEnabled } = useCreditoDocsValidationSettings()

  const reset = () => {
    setPhase('idle')
    setMessage(null)
    setCanContinue(false)
    setDetails(null)
    setErrorMsg(null)
    setLoadingStep(0)
    setConfirmForce(false)
    setForcedCedula(false)
    setCreditoResults([])
    setCreditoProgress({ current: 0, total: 0 })
    setCreditoConfirmForce(false)
  }

  const handleClose = (next: boolean) => {
    if (!next) reset()
    onOpenChange(next)
  }

  // Animar pasos de loading (cosmético).
  useEffect(() => {
    if (phase !== 'loading') return
    setLoadingStep(0)
    const interval = setInterval(() => {
      setLoadingStep((s) => (s < LOADING_STEPS.length - 1 ? s + 1 : s))
    }, 1400)
    return () => clearInterval(interval)
  }, [phase])

  const docsAvailable = useMemo(() => {
    const frente = documents.find((d) => d.kind === CEDULA_FRENTE_KIND)
    const trasera = documents.find((d) => d.kind === CEDULA_TRASERA_KIND)
    return { frente, trasera, ok: !!frente && !!trasera }
  }, [documents])

  const otrosDocs = useMemo(
    () => documents.filter((d) => d.kind === OTROS_KIND),
    [documents],
  )
  const shouldRunCredito = creditoEnabled && otrosDocs.length > 0
  const onlyCredito = !cedulaEnabled && creditoEnabled

  const handleStart = () => {
    if (onlyCredito) {
      void runCreditoValidation()
      return
    }
    void runValidation()
  }

  const runValidation = async () => {
    setPhase('loading')
    setErrorMsg(null)
    setMessage(null)
    setCanContinue(false)
    setDetails(null)

    if (!docsAvailable.ok) {
      setPhase('error')
      setErrorMsg(
        'Faltan documentos cargados. Verifica que estén el frente y reverso de la cédula.',
      )
      return
    }

    try {
      const [anversoFile, reversoFile] = await Promise.all([
        downloadDocAsFile(publicId, docsAvailable.frente!, 'anverso'),
        downloadDocAsFile(publicId, docsAvailable.trasera!, 'reverso'),
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
      setDetails({
        resumen:
          typeof validation.resumen === 'string' && validation.resumen.trim()
            ? validation.resumen.trim()
            : undefined,
        recomendacion:
          typeof validation.recomendacion === 'string' && validation.recomendacion.trim()
            ? validation.recomendacion.trim()
            : undefined,
        alertas: Array.isArray(validation.alertas)
          ? validation.alertas.filter((a: any) => typeof a === 'string' && a.trim())
          : undefined,
        motivos: Array.isArray(validation.motivos_no_validez)
          ? validation.motivos_no_validez.filter((m: any) => typeof m === 'string' && m.trim())
          : undefined,
      })
      setPhase('result')
    } catch (e: any) {
      setPhase('error')
      setErrorMsg(e?.message || 'Error al preparar los documentos para validación.')
    }
  }

  const runCreditoValidation = async () => {
    setPhase('credito-loading')
    setErrorMsg(null)
    setCreditoResults([])
    setCreditoConfirmForce(false)
    setCreditoProgress({ current: 0, total: otrosDocs.length })

    const results: CreditoDocResult[] = []
    try {
      for (let i = 0; i < otrosDocs.length; i++) {
        const doc = otrosDocs[i]
        const fileName = (doc as any).fileName || (doc as any).filename || `Documento ${i + 1}`
        setCreditoProgress({ current: i + 1, total: otrosDocs.length, fileName })
        const file = await downloadDocAsFile(publicId, doc, `credito-${i + 1}`)
        let validation: CreditoValidationResponse
        try {
          validation = await validateCreditoDocument({ file })
        } catch {
          validation = {}
        }
        const msg = buildCreditoValidationMessage(validation)
        const v: any = validation || {}
        const camposRaw = v.campos_detectados && typeof v.campos_detectados === 'object'
          ? (v.campos_detectados as Record<string, any>)
          : undefined
        const campos: Record<string, string> | undefined = camposRaw
          ? Object.fromEntries(
              Object.entries(camposRaw).filter(([, val]) => typeof val === 'string'),
            )
          : undefined
        const cumpleMinimo =
          typeof v.campos_minimos_credito?.cumple_minimo === 'boolean'
            ? v.campos_minimos_credito.cumple_minimo
            : undefined
        const apiRecomendacion =
          typeof v.recomendacion === 'string' && v.recomendacion.trim()
            ? v.recomendacion.trim()
            : undefined
        // Recomendamos avanzar si el servicio dice que cumple los mínimos
        // Y su recomendación textual sugiere continuar.
        const recomendado =
          cumpleMinimo === true &&
          !!apiRecomendacion &&
          /continuar|avanzar|proceder|aprobar/i.test(apiRecomendacion)
        results.push({
          doc,
          fileName,
          // Sobreescribimos la acción recomendada con el texto del servicio
          // cuando viene, para reflejar fielmente lo que la IA sugiere.
          message: apiRecomendacion
            ? { ...msg, accion_recomendada: apiRecomendacion }
            : msg,
          // Para alinear el resumen con la recomendación de la IA, usamos
          // `recomendado` (basado en `cumple_minimo` + `recomendacion`) como
          // criterio para "se puede continuar".
          canContinue: recomendado,
          details: {
            resumen:
              typeof validation.resumen === 'string' && validation.resumen.trim()
                ? validation.resumen.trim()
                : undefined,
            recomendacion: apiRecomendacion,
            alertas: Array.isArray(validation.alertas)
              ? validation.alertas.filter((a: any) => typeof a === 'string' && a.trim())
              : undefined,
            motivos: Array.isArray(validation.motivos_no_validez)
              ? validation.motivos_no_validez.filter((m: any) => typeof m === 'string' && m.trim())
              : undefined,
          },
          extra: {
            corresponde:
              typeof v.corresponde_credito_consumo === 'boolean'
                ? v.corresponde_credito_consumo
                : undefined,
            cumpleMinimo,
            nivelConfianza:
              typeof v.nivel_confianza === 'string' ? v.nivel_confianza : undefined,
            tipoDetectado:
              typeof v.tipo_documento_detectado === 'string' ? v.tipo_documento_detectado : undefined,
            subtipoDetectado:
              typeof v.subtipo_documento === 'string' ? v.subtipo_documento : undefined,
            campos,
            observacionMinimos:
              typeof v.campos_minimos_credito?.observacion === 'string'
                ? v.campos_minimos_credito.observacion
                : undefined,
            recomendado,
          },
        })
      }
      setCreditoResults(results)
      setPhase('credito-result')
    } catch (e: any) {
      setPhase('credito-error')
      setErrorMsg(e?.message || 'Error al preparar los documentos de crédito para validación.')
    }
  }

  const handleContinue = () => {
    if (shouldRunCredito) {
      setForcedCedula(false)
      void runCreditoValidation()
      return
    }
    onValidated(false)
    handleClose(false)
  }

  const handleForceContinue = () => {
    if (shouldRunCredito) {
      setForcedCedula(true)
      void runCreditoValidation()
      return
    }
    onValidated(true)
    handleClose(false)
  }

  const creditoAllOk = creditoResults.length > 0 && creditoResults.every((r) => r.canContinue)

  const handleCreditoContinue = () => {
    onValidated(forcedCedula)
    handleClose(false)
  }

  const handleCreditoForceContinue = () => {
    onValidated(true)
    handleClose(false)
  }

  const headerInfo = (() => {
    if (onlyCredito) {
      return {
        Icon: FileText,
        title: 'Validación de documentos de crédito con IA',
        subtitle: `Análisis visual de ${otrosDocs.length} documento${otrosDocs.length === 1 ? '' : 's'} de crédito de consumo cargado${otrosDocs.length === 1 ? '' : 's'} como "Otros" antes de actualizar el estado.`,
      }
    }
    if (cedulaEnabled && creditoEnabled) {
      return {
        Icon: Sparkles,
        title: 'Validación de documentos con IA',
        subtitle: 'Análisis visual de cédulas y documentos de crédito antes de actualizar el estado.',
      }
    }
    return {
      Icon: Sparkles,
      title: 'Validación de documentos con IA',
      subtitle: 'Análisis visual del frente y reverso de la cédula de identidad chilena antes de actualizar el estado.',
    }
  })()

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className="sm:max-w-xl p-0 overflow-hidden gap-0 border-0 shadow-2xl"
      >
        {/* Header con gradient */}
        <div className="relative bg-gradient-to-br from-primary via-primary to-primary/80 px-6 py-5 text-primary-foreground [&_~_button[aria-label='Close']]:text-primary-foreground">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-white/15 backdrop-blur-sm p-2.5 ring-1 ring-white/20">
              <headerInfo.Icon className="h-6 w-6" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-semibold leading-tight">
                {headerInfo.title}
              </h2>
              <p className="text-sm text-primary-foreground/85 mt-1 leading-snug">
                {headerInfo.subtitle}
              </p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5 bg-background">
          {phase === 'idle' && (
            <IdleView
              docsOk={onlyCredito ? otrosDocs.length > 0 : docsAvailable.ok}
              onStart={handleStart}
              onCancel={() => handleClose(false)}
              mode={onlyCredito ? 'credito' : 'cedula'}
              otrosCount={otrosDocs.length}
            />
          )}

          {phase === 'loading' && <LoadingView step={loadingStep} />}

          {phase === 'result' && message && (
            <ResultView
              message={message}
              canContinue={canContinue}
              details={details}
              confirmForce={confirmForce}
              onToggleConfirmForce={setConfirmForce}
              onForceContinue={handleForceContinue}
              onRetry={runValidation}
              onClose={() => handleClose(false)}
              onContinue={handleContinue}
              continueLabel={shouldRunCredito ? 'Continuar con validación de crédito' : undefined}
              forceContinueLabel={shouldRunCredito ? 'Continuar con validación de crédito' : undefined}
              nextStepHint={
                shouldRunCredito
                  ? `Siguiente paso: validar ${otrosDocs.length} documento${otrosDocs.length === 1 ? '' : 's'} de crédito cargado${otrosDocs.length === 1 ? '' : 's'} (tipo "Otros").`
                  : undefined
              }
            />
          )}

          {phase === 'error' && (
            <ErrorView
              errorMsg={errorMsg}
              onRetry={runValidation}
              onClose={() => handleClose(false)}
            />
          )}

          {phase === 'credito-loading' && (
            <CreditoLoadingView
              current={creditoProgress.current}
              total={creditoProgress.total}
              fileName={creditoProgress.fileName}
            />
          )}

          {phase === 'credito-result' && (
            <CreditoResultView
              results={creditoResults}
              allOk={creditoAllOk}
              confirmForce={creditoConfirmForce}
              onToggleConfirmForce={setCreditoConfirmForce}
              onContinue={handleCreditoContinue}
              onForceContinue={handleCreditoForceContinue}
              onRetry={runCreditoValidation}
              onClose={() => handleClose(false)}
              forcedCedula={forcedCedula}
            />
          )}

          {phase === 'credito-error' && (
            <ErrorView
              errorMsg={errorMsg}
              onRetry={runCreditoValidation}
              onClose={() => handleClose(false)}
            />
          )}
        </div>

        {/* Footer institucional */}
        <div className="px-6 py-3 bg-muted/40 border-t flex items-center gap-2 text-[11px] text-muted-foreground">
          <Lock className="h-3 w-3 shrink-0" />
          <span>
            El análisis con IA es una sugerencia de apoyo. La decisión final
            siempre queda en manos del equipo humano.
          </span>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/* -------------------- Sub-views -------------------- */

function IdleView({
  docsOk,
  onStart,
  onCancel,
  mode = 'cedula',
  otrosCount = 0,
}: {
  docsOk: boolean
  onStart: () => void
  onCancel: () => void
  mode?: 'cedula' | 'credito'
  otrosCount?: number
}) {
  const isCredito = mode === 'credito'
  return (
    <div className="space-y-5">
      {isCredito ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/20 dark:border-emerald-900 p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-md grid place-items-center shrink-0 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300">
            <FileText className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium leading-tight">
              {otrosCount} documento{otrosCount === 1 ? '' : 's'} de crédito
            </p>
            <p className="text-xs text-muted-foreground leading-tight mt-0.5">
              Archivos cargados con tipo "Otros"
            </p>
          </div>
        </div>
      ) : (
      <div className="grid grid-cols-2 gap-3">
        <DocCard
          label="Anverso"
          sublabel="Cédula frontal"
          available={docsOk}
        />
        <DocCard
          label="Reverso"
          sublabel="Cédula trasera"
          available={docsOk}
        />
      </div>
      )}

      <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
        <p className="text-sm font-medium flex items-center gap-2">
          <ScanLine className="h-4 w-4 text-primary" />
          ¿Qué vamos a validar?
        </p>
        {isCredito ? (
          <ul className="text-xs text-muted-foreground space-y-1.5 pl-6 list-disc">
            <li>Que cada archivo corresponda a un documento de crédito de consumo.</li>
            <li>Que el contenido sea legible y consistente con un contrato o pagaré.</li>
            <li>Calidad visual suficiente para reconocer el documento.</li>
          </ul>
        ) : (
          <ul className="text-xs text-muted-foreground space-y-1.5 pl-6 list-disc">
            <li>Que ambas imágenes correspondan a una cédula de identidad chilena.</li>
            <li>Que el anverso y reverso sean del mismo documento.</li>
            <li>Calidad visual suficiente (sin reflejos ni cortes).</li>
          </ul>
        )}
      </div>

      {!docsOk && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900 p-3 text-sm flex gap-2 items-start">
          <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
          <span className="text-amber-900 dark:text-amber-200">
            {isCredito
              ? 'No hay documentos cargados con tipo "Otros" para validar.'
              : 'Faltan documentos cargados. Asegúrate de que estén el frente y reverso de la cédula antes de validar.'}
          </span>
        </div>
      )}

      <div className="flex justify-end gap-2 pt-1">
        <Button variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
        <Button
          onClick={onStart}
          disabled={!docsOk}
          className="gap-2 shadow-md shadow-primary/20"
        >
          <Sparkles className="h-4 w-4" />
          Iniciar validación
        </Button>
      </div>
    </div>
  )
}

function DocCard({
  label,
  sublabel,
  available,
}: {
  label: string
  sublabel: string
  available: boolean
}) {
  return (
    <div
      className={cn(
        'rounded-lg border p-3 flex items-center gap-3 transition-colors',
        available
          ? 'border-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/20 dark:border-emerald-900'
          : 'border-dashed border-muted-foreground/30 bg-muted/20',
      )}
    >
      <div
        className={cn(
          'h-9 w-9 rounded-md grid place-items-center shrink-0',
          available
            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300'
            : 'bg-muted text-muted-foreground',
        )}
      >
        {available ? <CheckCircle2 className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium leading-tight">{label}</p>
        <p className="text-xs text-muted-foreground leading-tight mt-0.5">{sublabel}</p>
      </div>
    </div>
  )
}

function LoadingView({ step }: { step: number }) {
  return (
    <div className="py-6 space-y-6">
      {/* Scanner animado */}
      <div className="relative mx-auto h-32 w-52 rounded-xl border-2 border-dashed border-primary/40 bg-gradient-to-br from-primary/5 to-primary/10 overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-[2px] bg-primary animate-[scan_2s_ease-in-out_infinite]" />
        <div className="absolute inset-0 grid place-items-center">
          <Sparkles className="h-10 w-10 text-primary/60 animate-pulse" />
        </div>
        <style>{`
          @keyframes scan {
            0%   { transform: translateY(0); opacity: 1; }
            50%  { transform: translateY(120px); opacity: 1; }
            51%  { opacity: 0; }
            52%  { transform: translateY(0); opacity: 0; }
            53%  { opacity: 1; }
            100% { transform: translateY(120px); opacity: 1; }
          }
        `}</style>
      </div>

      <div className="text-center space-y-1">
        <p className="text-sm font-semibold">Estamos validando los documentos…</p>
        <p className="text-xs text-muted-foreground">
          Esto puede tomar unos segundos. No cierres esta ventana.
        </p>
      </div>

      <ul className="space-y-2 max-w-sm mx-auto">
        {LOADING_STEPS.map((s, i) => {
          const Icon = s.icon
          const done = i < step
          const active = i === step
          return (
            <li
              key={s.label}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                active && 'bg-primary/10 text-foreground',
                done && 'text-muted-foreground',
                !active && !done && 'text-muted-foreground/60',
              )}
            >
              <div className="h-6 w-6 grid place-items-center shrink-0">
                {done ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                ) : active ? (
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                ) : (
                  <Icon className="h-4 w-4" />
                )}
              </div>
              <span className="text-sm">{s.label}</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function ResultView({
  message,
  canContinue,
  details,
  confirmForce,
  onToggleConfirmForce,
  onForceContinue,
  onRetry,
  onClose,
  onContinue,
  continueLabel,
  forceContinueLabel,
  nextStepHint,
}: {
  message: ValidationMessage
  canContinue: boolean
  details: ValidationDetails | null
  confirmForce: boolean
  onToggleConfirmForce: (v: boolean) => void
  onForceContinue: () => void
  onRetry: () => void
  onClose: () => void
  onContinue: () => void
  continueLabel?: string
  forceContinueLabel?: string
  nextStepHint?: string
}) {
  const [showDetails, setShowDetails] = useState(false)
  const variant = (() => {
    if (message.estado_validacion === 'ok')
      return {
        Icon: ShieldCheck,
        ring: 'ring-emerald-200 dark:ring-emerald-900',
        bg: 'bg-emerald-50 dark:bg-emerald-950/30',
        iconBg: 'bg-emerald-100 dark:bg-emerald-900/60',
        iconText: 'text-emerald-600 dark:text-emerald-400',
        badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300',
        badgeText: 'Validación aprobada',
      }
    if (message.estado_validacion === 'advertencia')
      return {
        Icon: ShieldAlert,
        ring: 'ring-amber-200 dark:ring-amber-900',
        bg: 'bg-amber-50 dark:bg-amber-950/30',
        iconBg: 'bg-amber-100 dark:bg-amber-900/60',
        iconText: 'text-amber-600 dark:text-amber-400',
        badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300',
        badgeText: 'Requiere atención',
      }
    return {
      Icon: ShieldX,
      ring: 'ring-destructive/30',
      bg: 'bg-destructive/5',
      iconBg: 'bg-destructive/15',
      iconText: 'text-destructive',
      badge: 'bg-destructive/15 text-destructive',
      badgeText: 'Validación rechazada',
    }
  })()

  return (
    <div className="space-y-5 animate-in fade-in-50 zoom-in-95 duration-300">
      <div className={cn('rounded-xl p-5 ring-1', variant.bg, variant.ring)}>
        <div className="flex items-start gap-4">
          <div className={cn('h-12 w-12 rounded-xl grid place-items-center shrink-0', variant.iconBg)}>
            <variant.Icon className={cn('h-6 w-6', variant.iconText)} />
          </div>
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className={cn('text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full', variant.badge)}>
                {variant.badgeText}
              </span>
            </div>
            <h3 className="text-base font-semibold leading-tight">{message.titulo}</h3>
            <p className="text-sm text-foreground/80 leading-relaxed">{message.mensaje}</p>
            <p className="text-sm text-muted-foreground leading-relaxed border-t border-current/10 pt-2 mt-2">
              <span className="font-medium text-foreground">Recomendación: </span>
              {message.accion_recomendada}
            </p>
          </div>
        </div>
      </div>

      {details && (details.resumen || details.recomendacion || (details.alertas?.length ?? 0) > 0 || (details.motivos?.length ?? 0) > 0) && (
        <div className="rounded-xl border bg-card overflow-hidden">
          <button
            onClick={() => setShowDetails((s) => !s)}
            className="w-full flex items-center justify-between gap-2 px-4 py-2.5 border-b bg-muted/40 hover:bg-muted/60 transition-colors text-left"
          >
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              <p className="text-sm font-semibold">Detalle del análisis con IA</p>
            </div>
            {showDetails ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </button>
          {showDetails && (
            <div className="p-4 space-y-4 animate-in slide-in-from-top-2 duration-200">
              {details.resumen && (
                <div className="flex gap-3">
                  <div className="h-8 w-8 rounded-md bg-primary/10 text-primary grid place-items-center shrink-0">
                    <Info className="h-4 w-4" />
                  </div>
                  <div className="space-y-1 min-w-0">
                    <p className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
                      Resumen
                    </p>
                    <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-line break-words">
                      {details.resumen}
                    </p>
                  </div>
                </div>
              )}

              {details.recomendacion && details.recomendacion !== message.accion_recomendada && (
                <div className="flex gap-3">
                  <div className="h-8 w-8 rounded-md bg-primary/10 text-primary grid place-items-center shrink-0">
                    <Sparkles className="h-4 w-4" />
                  </div>
                  <div className="space-y-1 min-w-0">
                    <p className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
                      Sugerencia del análisis
                    </p>
                    <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-line break-words">
                      {details.recomendacion}
                    </p>
                  </div>
                </div>
              )}

              {details.alertas && details.alertas.length > 0 && (
                <div className="rounded-md border border-amber-200 dark:border-amber-900 bg-amber-50/70 dark:bg-amber-950/30 p-3">
                  <p className="text-[11px] uppercase tracking-wider font-semibold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Alertas detectadas
                  </p>
                  <ul className="mt-2 space-y-1.5">
                    {details.alertas.map((a, i) => (
                      <li key={i} className="text-xs text-amber-900 dark:text-amber-200 leading-snug flex gap-2">
                        <span className="mt-1 h-1 w-1 rounded-full bg-amber-600 shrink-0" />
                        <span className="break-words">{a}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {details.motivos && details.motivos.length > 0 && (
                <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3">
                  <p className="text-[11px] uppercase tracking-wider font-semibold text-destructive flex items-center gap-1.5">
                    <XCircle className="h-3.5 w-3.5" />
                    Motivos
                  </p>
                  <ul className="mt-2 space-y-1.5">
                    {details.motivos.map((m, i) => (
                      <li key={i} className="text-xs text-destructive leading-snug flex gap-2">
                        <span className="mt-1 h-1 w-1 rounded-full bg-destructive shrink-0" />
                        <span className="break-words">{m}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {nextStepHint && canContinue && (
        <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-2.5 flex items-start gap-2 text-xs text-foreground/80">
          <ArrowRight className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
          <span>{nextStepHint}</span>
        </div>
      )}

      <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          Cancelar
        </Button>
        {canContinue && (
          <Button onClick={onContinue} className="gap-2 shadow-md shadow-primary/20">
            {continueLabel || 'Continuar y actualizar estado'}
            <ArrowRight className="h-4 w-4" />
          </Button>
        )}
      </div>

      {!canContinue && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900 p-4 space-y-3">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
            <div className="space-y-1">
              <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                ¿Avanzar de todas formas?
              </p>
              <p className="text-xs text-amber-900/90 dark:text-amber-200/90 leading-relaxed">
                Puedes continuar con el cambio de estado bajo tu responsabilidad.
                Quedará registrado que la validación con IA no fue concluyente.
              </p>
            </div>
          </div>

          <label className="flex items-start gap-2.5 cursor-pointer select-none rounded-md bg-white/60 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 px-3 py-2">
            <input
              type="checkbox"
              checked={confirmForce}
              onChange={(e) => onToggleConfirmForce(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-amber-400 text-amber-600 focus:ring-amber-500"
            />
            <span className="text-xs text-amber-900 dark:text-amber-200 leading-snug">
              Confirmo que revisé los documentos manualmente y deseo actualizar el
              estado igualmente.
            </span>
          </label>

          <div className="flex justify-end">
            <Button
              onClick={onForceContinue}
              disabled={!confirmForce}
              className="gap-2 bg-amber-600 hover:bg-amber-700 text-white"
            >
              <ArrowRight className="h-4 w-4" />
              {forceContinueLabel || 'Actualizar estado de todas formas'}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

function ErrorView({
  errorMsg,
  onRetry,
  onClose,
}: {
  errorMsg: string | null
  onRetry: () => void
  onClose: () => void
}) {
  return (
    <div className="space-y-5 animate-in fade-in-50 zoom-in-95 duration-300">
      <div className="rounded-xl p-5 ring-1 ring-destructive/30 bg-destructive/5">
        <div className="flex items-start gap-4">
          <div className="h-12 w-12 rounded-xl bg-destructive/15 text-destructive grid place-items-center shrink-0">
            <ShieldX className="h-6 w-6" />
          </div>
          <div className="space-y-1.5">
            <h3 className="text-base font-semibold leading-tight">
              No pudimos validar los documentos
            </h3>
            <p className="text-sm text-foreground/80 leading-relaxed">
              {errorMsg ||
                'No pudimos validar los documentos en este momento. Intenta nuevamente en unos segundos.'}
            </p>
          </div>
        </div>
      </div>
      <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          Cerrar
        </Button>
        <Button onClick={onRetry} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Reintentar
        </Button>
      </div>
    </div>
  )
}

/* -------------------- Crédito sub-views -------------------- */

const CREDITO_LOADING_STEPS = [
  { label: 'Descargando documento', icon: ScanLine },
  { label: 'Extrayendo contenido', icon: FileText },
  { label: 'Identificando institución y tipo de crédito', icon: Sparkles },
  { label: 'Validando campos mínimos', icon: ShieldCheck },
] as const

function CreditoLoadingView({
  current,
  total,
  fileName,
}: {
  current: number
  total: number
  fileName?: string
}) {
  const [step, setStep] = useState(0)
  const safeCurrent = Math.max(current, 1)
  const safeTotal = Math.max(total, 1)
  // Progreso por documento + sub-progreso por step.
  const perDoc = 100 / safeTotal
  const subPct = ((step + 1) / CREDITO_LOADING_STEPS.length) * perDoc
  const pct = Math.min((safeCurrent - 1) * perDoc + subPct, 99)

  // Ciclo de pasos para que no parezca pegado.
  useEffect(() => {
    setStep(0)
    const id = setInterval(() => {
      setStep((s) => (s + 1) % CREDITO_LOADING_STEPS.length)
    }, 1200)
    return () => clearInterval(id)
  }, [safeCurrent, fileName])

  return (
    <div className="py-6 space-y-6">
      {/* Tarjeta animada con beam de escaneo y skeleton de líneas */}
      <div className="relative mx-auto h-36 w-56 rounded-xl border-2 border-dashed border-primary/40 bg-gradient-to-br from-primary/5 to-primary/10 overflow-hidden">
        {/* Líneas de "texto" del documento */}
        <div className="absolute inset-0 p-4 flex flex-col gap-2 justify-center">
          {[90, 70, 80, 50, 65].map((w, i) => (
            <div
              key={i}
              className="h-1.5 rounded bg-primary/15 overflow-hidden relative"
              style={{ width: `${w}%` }}
            >
              <div
                className="absolute inset-y-0 w-1/2 bg-gradient-to-r from-transparent via-primary/40 to-transparent animate-shimmer"
                style={{ animationDelay: `${i * 120}ms` }}
              />
            </div>
          ))}
        </div>
        {/* Beam de scan vertical */}
        <div className="pointer-events-none absolute inset-x-2 top-1 h-[2px] rounded-full bg-primary shadow-[0_0_12px_2px_hsl(var(--primary)/0.6)] animate-scan-y" />
        {/* Icono central translúcido */}
        <div className="pointer-events-none absolute top-2 right-2 text-primary/40">
          <FileText className="h-5 w-5" />
        </div>
      </div>

      <div className="text-center space-y-1">
        <p className="text-sm font-semibold flex items-center justify-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          Validando documentos de crédito…
        </p>
        <p className="text-xs text-muted-foreground">
          Analizando {safeCurrent} de {safeTotal}
          {fileName ? ` · ${fileName}` : ''}
        </p>
      </div>

      {/* Lista de pasos animados */}
      <ul className="max-w-sm mx-auto space-y-1.5">
        {CREDITO_LOADING_STEPS.map((s, i) => {
          const isActive = i === step
          const isDone = i < step
          const Icon = s.icon
          return (
            <li
              key={s.label}
              className={cn(
                'flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-xs transition-all duration-300',
                isActive && 'bg-primary/10 text-foreground',
                isDone && 'text-muted-foreground',
                !isActive && !isDone && 'text-muted-foreground/70',
              )}
            >
              <span
                className={cn(
                  'h-5 w-5 rounded-full grid place-items-center shrink-0 transition-colors',
                  isActive && 'bg-primary text-primary-foreground',
                  isDone && 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300',
                  !isActive && !isDone && 'bg-muted text-muted-foreground',
                )}
              >
                {isDone ? (
                  <CheckCircle2 className="h-3 w-3" />
                ) : isActive ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Icon className="h-3 w-3" />
                )}
              </span>
              <span className="truncate">{s.label}</span>
            </li>
          )
        })}
      </ul>

      {/* Barra de progreso con efecto indeterminado encima */}
      <div className="max-w-sm mx-auto">
        <div className="relative h-2 w-full rounded-full bg-muted overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-500 ease-out"
            style={{ width: `${Math.max(pct, 5)}%` }}
          />
          <div className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/40 to-transparent animate-progress-indeterminate" />
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground text-center">
          No cierres esta ventana hasta finalizar el análisis.
        </p>
      </div>
    </div>
  )
}

function CreditoResultView({
  results,
  allOk,
  confirmForce,
  onToggleConfirmForce,
  onContinue,
  onForceContinue,
  onRetry,
  onClose,
  forcedCedula,
}: {
  results: CreditoDocResult[]
  allOk: boolean
  confirmForce: boolean
  onToggleConfirmForce: (v: boolean) => void
  onContinue: () => void
  onForceContinue: () => void
  onRetry: () => void
  onClose: () => void
  forcedCedula: boolean
}) {
  const okCount = results.filter((r) => r.canContinue).length
  const totalCount = results.length

  const summary = (() => {
    if (allOk) {
      return {
        Icon: ShieldCheck,
        ring: 'ring-emerald-200 dark:ring-emerald-900',
        bg: 'bg-emerald-50 dark:bg-emerald-950/30',
        iconBg: 'bg-emerald-100 dark:bg-emerald-900/60',
        iconText: 'text-emerald-600 dark:text-emerald-400',
        badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300',
        badgeText: 'Validación aprobada',
        title: 'Documentos de crédito reconocidos',
        message: `${okCount} de ${totalCount} documento${totalCount === 1 ? '' : 's'} corresponden visualmente a un crédito de consumo.`,
      }
    }
    return {
      Icon: ShieldAlert,
      ring: 'ring-amber-200 dark:ring-amber-900',
      bg: 'bg-amber-50 dark:bg-amber-950/30',
      iconBg: 'bg-amber-100 dark:bg-amber-900/60',
      iconText: 'text-amber-600 dark:text-amber-400',
      badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300',
      badgeText: 'Requiere atención',
      title: 'Algunos documentos no fueron validados',
      message: `${okCount} de ${totalCount} documento${totalCount === 1 ? '' : 's'} pasaron la validación visual de crédito de consumo.`,
    }
  })()

  return (
    <div className="space-y-5 animate-in fade-in-50 zoom-in-95 duration-300">
      <div className={cn('rounded-xl p-5 ring-1', summary.bg, summary.ring)}>
        <div className="flex items-start gap-4">
          <div className={cn('h-12 w-12 rounded-xl grid place-items-center shrink-0', summary.iconBg)}>
            <summary.Icon className={cn('h-6 w-6', summary.iconText)} />
          </div>
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className={cn('text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full', summary.badge)}>
                {summary.badgeText}
              </span>
              {forcedCedula && (
                <span className="text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300">
                  Cédula forzada
                </span>
              )}
            </div>
            <h3 className="text-base font-semibold leading-tight">{summary.title}</h3>
            <p className="text-sm text-foreground/80 leading-relaxed">{summary.message}</p>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        {results.map((r, i) => (
          <CreditoDocItem key={i} result={r} index={i + 1} />
        ))}
      </div>

      {allOk ? (
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={onContinue} className="gap-2 shadow-md shadow-primary/20">
            Continuar y actualizar estado
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <div className="rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900 p-4 space-y-3">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
            <div className="space-y-1">
              <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                ¿Avanzar de todas formas?
              </p>
              <p className="text-xs text-amber-900/90 dark:text-amber-200/90 leading-relaxed">
                Algunos documentos de crédito no fueron validados por la IA. Puedes
                continuar bajo tu responsabilidad o reintentar la validación.
              </p>
            </div>
          </div>

          <label className="flex items-start gap-2.5 cursor-pointer select-none rounded-md bg-white/60 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 px-3 py-2">
            <input
              type="checkbox"
              checked={confirmForce}
              onChange={(e) => onToggleConfirmForce(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-amber-400 text-amber-600 focus:ring-amber-500"
            />
            <span className="text-xs text-amber-900 dark:text-amber-200 leading-snug">
              Confirmo que revisé manualmente los documentos de crédito y deseo
              actualizar el estado igualmente.
            </span>
          </label>

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
            <Button variant="ghost" onClick={onRetry} className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Reintentar
            </Button>
            <Button
              onClick={onForceContinue}
              disabled={!confirmForce}
              className="gap-2 bg-amber-600 hover:bg-amber-700 text-white"
            >
              <ArrowRight className="h-4 w-4" />
              Actualizar estado de todas formas
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

function CreditoDocItem({ result, index }: { result: CreditoDocResult; index: number }) {
  const [open, setOpen] = useState(false)
  const variant =
    result.message.estado_validacion === 'ok'
      ? {
          Icon: CheckCircle2,
          iconClass: 'text-emerald-600 dark:text-emerald-400',
          iconBg: 'bg-emerald-100 dark:bg-emerald-900/50',
          borderClass: 'border-emerald-200 dark:border-emerald-900',
        }
      : result.message.estado_validacion === 'advertencia'
        ? {
            Icon: AlertTriangle,
            iconClass: 'text-amber-600 dark:text-amber-400',
            iconBg: 'bg-amber-100 dark:bg-amber-900/50',
            borderClass: 'border-amber-200 dark:border-amber-900',
          }
        : {
            Icon: XCircle,
            iconClass: 'text-destructive',
            iconBg: 'bg-destructive/15',
            borderClass: 'border-destructive/30',
          }

  const extra = result.extra ?? ({ recomendado: false } as CreditoExtra)
  const camposEntries = extra.campos ? Object.entries(extra.campos) : []
  const hasDetails =
    !!result.details.resumen ||
    !!result.details.recomendacion ||
    (result.details.alertas?.length ?? 0) > 0 ||
    (result.details.motivos?.length ?? 0) > 0 ||
    camposEntries.length > 0 ||
    extra.corresponde !== undefined ||
    extra.cumpleMinimo !== undefined

  // Badge "Recomendado" según cumple_minimo + recomendacion textual.
  const recBadge = extra.recomendado
    ? {
        label: 'Recomendado avanzar',
        cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300',
        Icon: CheckCircle2,
      }
    : {
        label: 'Revisión sugerida',
        cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300',
        Icon: AlertTriangle,
      }

  return (
    <div className={cn('rounded-lg border bg-card overflow-hidden', variant.borderClass)}>
      <button
        onClick={() => hasDetails && setOpen((s) => !s)}
        disabled={!hasDetails}
        className={cn(
          'w-full flex items-start gap-3 px-3 py-2.5 text-left transition-colors',
          hasDetails && 'hover:bg-muted/50 cursor-pointer',
        )}
      >
        <div className={cn('h-8 w-8 rounded-md grid place-items-center shrink-0', variant.iconBg)}>
          <variant.Icon className={cn('h-4 w-4', variant.iconClass)} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium leading-tight flex items-center gap-2">
            <span className="text-muted-foreground text-xs">#{index}</span>
            <span className="truncate">{result.fileName}</span>
          </p>
          <div className="flex flex-wrap items-center gap-1.5 mt-1">
            <span className={cn('inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold', recBadge.cls)}>
              <recBadge.Icon className="h-2.5 w-2.5" />
              {recBadge.label}
            </span>
            {extra.corresponde !== undefined && (
              <span
                className={cn(
                  'inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium',
                  extra.corresponde
                    ? 'bg-primary/10 text-primary'
                    : 'bg-muted text-muted-foreground',
                )}
              >
                {extra.corresponde ? 'Corresponde a crédito de consumo' : 'No corresponde a crédito'}
              </span>
            )}
            {extra.nivelConfianza && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-muted text-muted-foreground">
                Confianza: {extra.nivelConfianza}
              </span>
            )}
          </div>
        </div>
        {hasDetails && (
          open ? <ChevronUp className="h-4 w-4 text-muted-foreground mt-1 shrink-0" />
               : <ChevronDown className="h-4 w-4 text-muted-foreground mt-1 shrink-0" />
        )}
      </button>
      {open && hasDetails && (
        <div className="px-3 pb-3 pt-1 space-y-3 border-t bg-muted/20">
          <p className="text-xs text-foreground/80 leading-relaxed pt-2">
            {result.message.mensaje}
          </p>

          {(extra.tipoDetectado || extra.subtipoDetectado) && (
            <div className="flex flex-wrap gap-1.5">
              {extra.tipoDetectado && (
                <span className="text-[10px] px-2 py-0.5 rounded-md bg-primary/10 text-primary font-medium">
                  {humanize(extra.tipoDetectado)}
                </span>
              )}
              {extra.subtipoDetectado && (
                <span className="text-[10px] px-2 py-0.5 rounded-md bg-muted text-muted-foreground font-medium">
                  {humanize(extra.subtipoDetectado)}
                </span>
              )}
            </div>
          )}

          {result.details.resumen && (
            <div className="text-xs text-foreground/80 leading-relaxed whitespace-pre-line break-words">
              <span className="font-semibold">Resumen: </span>
              {result.details.resumen}
            </div>
          )}

          {camposEntries.length > 0 && (
            <div className="rounded-md border bg-background/60 p-2.5">
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
                  Campos detectados
                </p>
                {extra.cumpleMinimo !== undefined && (
                  <span
                    className={cn(
                      'inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold',
                      extra.cumpleMinimo
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300'
                        : 'bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300',
                    )}
                  >
                    {extra.cumpleMinimo ? (
                      <CheckCircle2 className="h-2.5 w-2.5" />
                    ) : (
                      <AlertTriangle className="h-2.5 w-2.5" />
                    )}
                    {extra.cumpleMinimo ? 'Cumple mínimos' : 'No cumple mínimos'}
                  </span>
                )}
              </div>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1">
                {camposEntries.map(([k, v]) => {
                  const status = fieldStatus(v)
                  return (
                    <li key={k} className="flex items-center justify-between gap-2 text-[11px] py-0.5">
                      <span className="text-muted-foreground truncate">{humanize(k)}</span>
                      <span className={cn('inline-flex items-center gap-1 font-medium shrink-0', status.cls)}>
                        <status.Icon className="h-3 w-3" />
                        {status.label}
                      </span>
                    </li>
                  )
                })}
              </ul>
              {extra.observacionMinimos && (
                <p className="text-[10px] text-muted-foreground mt-2 leading-snug">
                  {extra.observacionMinimos}
                </p>
              )}
            </div>
          )}

          {result.details.alertas && result.details.alertas.length > 0 && (
            <ul className="space-y-1">
              {result.details.alertas.map((a, i) => (
                <li key={i} className="text-[11px] text-amber-700 dark:text-amber-300 flex gap-2">
                  <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                  <span className="break-words">{a}</span>
                </li>
              ))}
            </ul>
          )}
          {result.details.motivos && result.details.motivos.length > 0 && (
            <ul className="space-y-1">
              {result.details.motivos.map((m, i) => (
                <li key={i} className="text-[11px] text-destructive flex gap-2">
                  <XCircle className="h-3 w-3 mt-0.5 shrink-0" />
                  <span className="break-words">{m}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            <span className="font-medium text-foreground">Recomendación: </span>
            {result.message.accion_recomendada}
          </p>
        </div>
      )}
    </div>
  )
}

/** Convierte snake_case a "Título legible". */
function humanize(s: string): string {
  return s
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

/** Mapea el valor textual de un campo detectado a un estado visual. */
function fieldStatus(value: string): { label: string; cls: string; Icon: typeof CheckCircle2 } {
  const v = (value || '').toLowerCase()
  if (v.startsWith('detectado')) {
    return {
      label: v.includes('enmascarado') ? 'Detectado (enmascarado)' : 'Detectado',
      cls: 'text-emerald-700 dark:text-emerald-400',
      Icon: CheckCircle2,
    }
  }
  if (v === 'no_visible' || v === 'no visible') {
    return { label: 'No visible', cls: 'text-muted-foreground', Icon: XCircle }
  }
  return { label: humanize(value), cls: 'text-muted-foreground', Icon: Info }
}