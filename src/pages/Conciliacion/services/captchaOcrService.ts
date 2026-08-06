// =====================================================================
// Servicio OCR (webhook n8n) para resolver el CAPTCHA de Scotiabank.
//
// Recibe la imagen en base64 (Data URL) que entrega el backend bancario
// y devuelve el texto detectado. Es una ayuda para pre-cargar el input:
// cualquier fallo (red, timeout, formato inesperado) se resuelve con
// `null` y el usuario simplemente ingresa el código a mano.
//
// IMPORTANTE: se usa `fetch` plano (sin authenticatedFetch) porque es un
// servicio externo — nunca debe enviarse el JWT a terceros.
// =====================================================================

const OCR_WEBHOOK_URL = 'https://gary-tester.app.n8n.cloud/webhook/image-ocr'
const OCR_TIMEOUT_MS = 15_000

/** Limpia el texto detectado: los CAPTCHA nunca contienen espacios. */
function sanitizeCaptchaText(text: string): string | null {
  const cleaned = text.replace(/\s+/g, '')
  return cleaned || null
}

/** Extrae el texto de formatos de respuesta habituales (string, JSON, array n8n). */
function extractTextFromPayload(payload: unknown): string | null {
  if (typeof payload === 'string') return sanitizeCaptchaText(payload)
  if (Array.isArray(payload)) {
    for (const item of payload) {
      const text = extractTextFromPayload(item)
      if (text) return text
    }
    return null
  }
  if (payload && typeof payload === 'object') {
    const p = payload as Record<string, unknown>
    for (const key of ['text', 'captcha', 'code', 'result', 'content', 'output', 'message', 'data']) {
      const text = extractTextFromPayload(p[key])
      if (text) return text
    }
  }
  return null
}

/**
 * Resuelve el texto de un CAPTCHA a partir de su Data URL base64.
 * Devuelve `null` ante cualquier problema (el flujo continúa sin sugerencia).
 */
export async function resolveCaptchaText(imageDataUrl: string): Promise<string | null> {
  try {
    const mimeType = /^data:([^;,]+)/.exec(imageDataUrl)?.[1] ?? 'image/png'
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), OCR_TIMEOUT_MS)
    let res: Response
    try {
      res = await fetch(OCR_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: imageDataUrl, mimeType }),
        signal: controller.signal,
      })
    } finally {
      clearTimeout(timeout)
    }
    if (!res.ok) return null
    const raw = (await res.text()).trim()
    if (!raw) return null
    try {
      return extractTextFromPayload(JSON.parse(raw))
    } catch {
      // Respuesta de texto plano.
      return sanitizeCaptchaText(raw)
    }
  } catch {
    return null
  }
}