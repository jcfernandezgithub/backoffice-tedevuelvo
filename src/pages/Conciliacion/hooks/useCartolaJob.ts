import { useCallback, useEffect, useRef, useState } from 'react'
import {
  startBankDownload,
  sendBankCaptcha,
  getBankJob,
  type BankDownloadResult,
  type BankJobResponse,
  type StartBankJobResponse,
} from '../services/cartolaService'
import { resolveCaptchaText } from '../services/captchaOcrService'

export type CartolaJobPhase =
  | 'idle' // Sin trabajo activo (p.ej. luego de cancelar)
  | 'starting' // Iniciando el trabajo en el backend
  | 'waiting_captcha' // El banco pidió CAPTCHA: se muestra el modal
  | 'sending_captcha' // Enviando el código CAPTCHA
  | 'processing' // Descarga en curso (polling cada 3s)
  | 'completed' // Cartola lista (result disponible)
  | 'failed' // Error terminal

export interface CartolaJobState {
  phase: CartolaJobPhase
  jobId: string | null
  captchaImage: string | null
  captchaMessage: string | null
  /** Texto del CAPTCHA detectado por OCR (sugerencia pre-cargada en el input). */
  captchaSuggestion: string | null
  /** true mientras el servicio OCR está procesando la imagen actual. */
  solvingCaptcha: boolean
  result: BankDownloadResult | null
  error: string | null
}

const INITIAL_STATE: CartolaJobState = {
  phase: 'idle',
  jobId: null,
  captchaImage: null,
  captchaMessage: null,
  captchaSuggestion: null,
  solvingCaptcha: false,
  result: null,
  error: null,
}

const POLL_INTERVAL_MS = 3_000
const MAX_CONSECUTIVE_POLL_ERRORS = 5

function toErrorMessage(e: unknown, fallback: string): string {
  return e instanceof Error && e.message ? e.message : fallback
}

/**
 * Máquina de estados para la descarga asíncrona de la cartola bancaria.
 * Mantiene el mismo jobId durante todo el flujo y detiene el polling al
 * desmontar o al llegar a un estado terminal.
 */
export function useCartolaJob() {
  const [state, setState] = useState<CartolaJobState>(INITIAL_STATE)
  const jobIdRef = useRef<string | null>(null)
  const stopPollingRef = useRef<(() => void) | null>(null)
  const ocrRequestRef = useRef(0)

  const stopPolling = useCallback(() => {
    stopPollingRef.current?.()
    stopPollingRef.current = null
  }, [])

  // Detener el polling al desmontar para evitar consultas duplicadas.
  useEffect(() => stopPolling, [stopPolling])

  /** Polling cada 3s mientras el trabajo siga en PROCESSING. */
  const beginPolling = useCallback(
    (jobId: string) => {
      stopPolling()
      let stopped = false
      let timeoutId: ReturnType<typeof setTimeout> | undefined
      let consecutiveErrors = 0

      const poll = async () => {
        if (stopped) return
        try {
          const job = await getBankJob(jobId)
          if (stopped) return
          consecutiveErrors = 0
          if (job.status === 'PROCESSING') {
            setState((s) => ({ ...s, phase: 'processing', jobId }))
            timeoutId = setTimeout(poll, POLL_INTERVAL_MS)
          } else {
            // Estado terminal (COMPLETED / FAILED) o nuevo CAPTCHA.
            applyJobPayloadRef.current(job)
          }
        } catch (e) {
          if (stopped) return
          consecutiveErrors += 1
          if (consecutiveErrors >= MAX_CONSECUTIVE_POLL_ERRORS) {
            stopPolling()
            setState({
              phase: 'failed',
              jobId,
              captchaImage: null,
              captchaMessage: null,
              captchaSuggestion: null,
              solvingCaptcha: false,
              result: null,
              error: toErrorMessage(e, 'No se pudo consultar el estado de la descarga.'),
            })
          } else {
            timeoutId = setTimeout(poll, POLL_INTERVAL_MS)
          }
        }
      }

      void poll()
      stopPollingRef.current = () => {
        stopped = true
        if (timeoutId) clearTimeout(timeoutId)
      }
    },
    [stopPolling],
  )

  /**
   * Lanza el OCR sobre la imagen del CAPTCHA. El resultado solo se aplica
   * si el trabajo sigue esperando CAPTCHA con esa misma imagen (se ignoran
   * respuestas tardías de imágenes anteriores).
   */
  const solveCaptcha = useCallback(async (image: string) => {
    const requestId = ++ocrRequestRef.current
    const text = await resolveCaptchaText(image)
    if (ocrRequestRef.current !== requestId) return
    setState((s) => {
      if (s.phase !== 'waiting_captcha' || s.captchaImage !== image) return s
      return { ...s, solvingCaptcha: false, captchaSuggestion: text }
    })
  }, [])

  /** Traduce una respuesta del backend (inicio, captcha o polling) a estado de UI. */
  const applyJobPayload = useCallback(
    (payload: StartBankJobResponse | BankJobResponse) => {
      jobIdRef.current = payload.jobId
      switch (payload.status) {
        case 'WAITING_CAPTCHA': {
          stopPolling()
          const message =
            'message' in payload && typeof payload.message === 'string'
              ? payload.message
              : null
          const image = payload.captchaImage ?? null
          setState({
            phase: 'waiting_captcha',
            jobId: payload.jobId,
            captchaImage: image,
            captchaMessage: message,
            captchaSuggestion: null,
            solvingCaptcha: !!image,
            result: null,
            error: null,
          })
          // Ayuda OCR: pre-cargar el texto detectado (falla en silencio).
          if (image) void solveCaptcha(image)
          break
        }
        case 'PROCESSING': {
          setState((s) => ({
            ...s,
            phase: 'processing',
            jobId: payload.jobId,
            captchaImage: null,
            captchaMessage: null,
            error: null,
          }))
          beginPolling(payload.jobId)
          break
        }
        case 'COMPLETED': {
          const result = 'result' in payload ? payload.result : undefined
          if (result) {
            stopPolling()
            setState({
              phase: 'completed',
              jobId: payload.jobId,
              captchaImage: null,
              captchaMessage: null,
              captchaSuggestion: null,
              solvingCaptcha: false,
              result,
              error: null,
            })
          } else {
            // Aún no tenemos el resultado: seguimos consultando el job.
            setState((s) => ({ ...s, phase: 'processing', jobId: payload.jobId }))
            beginPolling(payload.jobId)
          }
          break
        }
        case 'FAILED': {
          stopPolling()
          const error =
            ('error' in payload && typeof payload.error === 'string' && payload.error) ||
            ('message' in payload && typeof payload.message === 'string' && payload.message) ||
            'La descarga de la cartola falló.'
          setState({
            phase: 'failed',
            jobId: payload.jobId,
            captchaImage: null,
            captchaMessage: null,
            captchaSuggestion: null,
            solvingCaptcha: false,
            result: null,
            error,
          })
          break
        }
      }
    },
    [stopPolling, beginPolling, solveCaptcha],
  )

  // Ref para romper el ciclo beginPolling ↔ applyJobPayload.
  const applyJobPayloadRef = useRef(applyJobPayload)
  applyJobPayloadRef.current = applyJobPayload

  /**
   * Lanza el OCR sobre la imagen del CAPTCHA. El resultado solo se aplica
   * si el trabajo sigue esperando CAPTCHA con esa misma imagen (se ignoran
   * respuestas tardías de imágenes anteriores).
   */
  const solveCaptcha = useCallback(async (image: string) => {
    const requestId = ++ocrRequestRef.current
    const text = await resolveCaptchaText(image)
    if (ocrRequestRef.current !== requestId) return
    setState((s) => {
      if (s.phase !== 'waiting_captcha' || s.captchaImage !== image) return s
      return { ...s, solvingCaptcha: false, captchaSuggestion: text }
    })
  }, [])

  /** Inicia un nuevo trabajo de descarga para el rango indicado. */
  const start = useCallback(
    async (from: string, to: string) => {
      stopPolling()
      jobIdRef.current = null
      setState({ ...INITIAL_STATE, phase: 'starting' })
      try {
        const res = await startBankDownload(from, to)
        applyJobPayload(res)
      } catch (e) {
        setState({
          ...INITIAL_STATE,
          phase: 'failed',
          error: toErrorMessage(e, 'No se pudo iniciar la descarga de la cartola.'),
        })
      }
    },
    [applyJobPayload, stopPolling],
  )

  /** Envía el código CAPTCHA del trabajo activo. */
  const submitCaptcha = useCallback(
    async (code: string) => {
      const jobId = jobIdRef.current
      if (!jobId) return
      setState((s) => ({ ...s, phase: 'sending_captcha', captchaMessage: null }))
      try {
        const res = await sendBankCaptcha(jobId, code)
        applyJobPayload(res)
      } catch (e) {
        // Error de red/servidor al enviar: volvemos al CAPTCHA conservando la imagen.
        setState((s) => ({
          ...s,
          phase: 'waiting_captcha',
          captchaMessage: toErrorMessage(e, 'No se pudo enviar el código. Intenta nuevamente.'),
        }))
      }
    },
    [applyJobPayload],
  )

  /** Abandona el trabajo activo (el backend lo expira por su cuenta). */
  const cancel = useCallback(() => {
    stopPolling()
    jobIdRef.current = null
    setState(INITIAL_STATE)
  }, [stopPolling])

  return { state, start, submitCaptcha, cancel }
}