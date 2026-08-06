import { authenticatedFetch } from '@/services/apiClient'

export interface CartolaMovimiento {
  fecha_movimiento?: string
  descripcion?: string
  cargo?: string | number | null
  abono?: string | number | null
  saldo_diario?: string | number | null
  sucursal?: string
  documento_numero?: string
  monto?: string | number
  [key: string]: unknown
}

export interface CartolaData {
  empresa_nombre?: string
  cuenta_numero?: string
  moneda?: string
  fecha_desde?: string
  fecha_hasta?: string
  monto_disponible?: string | number
  movimientos?: {
    movimiento?: CartolaMovimiento[] | CartolaMovimiento
  }
  [key: string]: unknown
}

export interface CartolaRange {
  from: string
  to: string
}

// =====================================================================
// Flujo asíncrono de descarga de cartola Scotiabank (con CAPTCHA)
//
//   1. POST /bank/download-xml-cartola?from&to  → inicia el trabajo.
//   2. Si status = WAITING_CAPTCHA → mostrar captchaImage (Data URL) y
//      enviar el código con POST /bank/download-jobs/:jobId/captcha.
//   3. Mientras status = PROCESSING → polling GET /bank/download-jobs/:jobId.
//   4. Estados terminales: COMPLETED (con result) / FAILED (con error).
//
// El jobId identifica una sesión viva de Playwright en el backend: no se
// debe persistir ni continuar en otra instancia del frontend.
// =====================================================================

export type BankJobStatus = 'WAITING_CAPTCHA' | 'PROCESSING' | 'COMPLETED' | 'FAILED'

export interface StartBankJobResponse {
  ok: boolean
  jobId: string
  status: BankJobStatus
  captchaImage?: string
  message?: string
}

export interface BankDownloadResult {
  ok: true
  filename: string
  filePath: string
  from: string
  to: string
  selectedDatesBeforeSearch?: { from?: string; to?: string }
  selectedDatesAfterSearch?: { from?: string; to?: string }
  data: CartolaData
  raw?: unknown
}

export interface BankJobResponse {
  jobId: string
  status: BankJobStatus
  captchaImage?: string
  result?: BankDownloadResult
  error?: string
  createdAt?: string
}

function getErrorMessage(payload: unknown, fallback: string): string {
  if (payload && typeof payload === 'object') {
    const p = payload as Record<string, unknown>
    if (typeof p.message === 'string' && p.message.trim()) return p.message
    if (typeof p.error === 'string' && p.error.trim()) return p.error
  }
  return fallback
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await authenticatedFetch(path, options)
  const payload = await res.json().catch(() => null)
  if (!res.ok) {
    throw new Error(getErrorMessage(payload, `Error ${res.status}`))
  }
  return payload as T
}

/** Inicia el trabajo de descarga. Puede responder WAITING_CAPTCHA de inmediato. */
export async function startBankDownload(from: string, to: string): Promise<StartBankJobResponse> {
  const qs = new URLSearchParams({ from, to }).toString()
  return request<StartBankJobResponse>(`/bank/download-xml-cartola?${qs}`, {
    method: 'POST',
  })
}

/** Envía el código CAPTCHA ingresado por el usuario (sin transformar el valor). */
export async function sendBankCaptcha(
  jobId: string,
  captcha: string,
): Promise<StartBankJobResponse> {
  return request<StartBankJobResponse>(
    `/bank/download-jobs/${encodeURIComponent(jobId)}/captcha`,
    {
      method: 'POST',
      body: JSON.stringify({ captcha }),
    },
  )
}

/** Consulta el estado actual del trabajo de descarga. */
export async function getBankJob(jobId: string): Promise<BankJobResponse> {
  return request<BankJobResponse>(`/bank/download-jobs/${encodeURIComponent(jobId)}`)
}