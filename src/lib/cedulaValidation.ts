/**
 * Validación visual de cédula de identidad chilena via servicio externo (n8n).
 *
 * IMPORTANTE:
 * - La validación es solo visual, no oficial.
 * - Nunca loguear la respuesta completa: puede contener información sensible.
 * - No exponer scoring técnico ni datos personales detectados al usuario final.
 */

export const CEDULA_VALIDATION_ENDPOINT =
  (import.meta.env.VITE_N8N_CEDULA_VALIDATION_URL as string | undefined) ||
  'https://gary-tester.app.n8n.cloud/webhook/validar-cedula-chilena'

export type ResultadoFinal =
  | 'valido_visualmente'
  | 'probablemente_valido_visualmente'
  | 'no_valido_para_validacion_completa'
  | 'no_concluyente'
  | 'no_valido'
  | 'no_corresponde'

export interface CedulaValidationResponse {
  resultado_final?: ResultadoFinal | string
  es_valida_para_continuar_proceso?: boolean
  scoring_correspondencia_visual?: number
  validacion_completa?: boolean
  motivos_no_validez?: string[]
  alertas?: string[]
  recomendacion?: string
  // Otros campos sensibles pueden venir; se ignoran intencionalmente en la UI.
  [key: string]: any
}

export interface ValidationMessage {
  estado_validacion: 'ok' | 'advertencia' | 'error'
  titulo: string
  mensaje: string
  accion_recomendada: string
  puede_reintentar: boolean
  mostrar_score: false
}

const MESSAGES: Record<ResultadoFinal, Omit<ValidationMessage, 'mostrar_score'>> = {
  valido_visualmente: {
    estado_validacion: 'ok',
    titulo: 'Documentos cargados correctamente',
    mensaje: 'Los documentos fueron recibidos correctamente.',
    accion_recomendada: 'Puedes continuar con el proceso.',
    puede_reintentar: false,
  },
  probablemente_valido_visualmente: {
    estado_validacion: 'advertencia',
    titulo: 'Documentos recibidos',
    mensaje:
      'Los documentos fueron cargados correctamente, aunque podrían requerir una revisión adicional.',
    accion_recomendada: 'Puedes continuar con el proceso.',
    puede_reintentar: false,
  },
  no_valido_para_validacion_completa: {
    estado_validacion: 'advertencia',
    titulo: 'Faltan documentos por cargar',
    mensaje:
      'Necesitamos una foto del frente y otra del reverso de la cédula de identidad chilena.',
    accion_recomendada:
      'Carga ambas caras del documento con buena iluminación y sin cortes.',
    puede_reintentar: true,
  },
  no_valido: {
    estado_validacion: 'error',
    titulo: 'No pudimos validar los documentos',
    mensaje: 'Las imágenes cargadas no cumplen con los requisitos para continuar.',
    accion_recomendada:
      'Revisa que correspondan al frente y reverso de la cédula de identidad chilena e intenta nuevamente.',
    puede_reintentar: true,
  },
  no_corresponde: {
    estado_validacion: 'error',
    titulo: 'Documento no reconocido',
    mensaje:
      'Las imágenes cargadas no parecen corresponder a una cédula de identidad chilena.',
    accion_recomendada:
      'Carga nuevamente el frente y reverso de la cédula de identidad chilena.',
    puede_reintentar: true,
  },
  no_concluyente: {
    estado_validacion: 'advertencia',
    titulo: 'No pudimos validar las imágenes',
    mensaje: 'La calidad de las imágenes no permite completar la validación.',
    accion_recomendada:
      'Intenta nuevamente con fotos más claras, sin reflejos y con el documento completo visible.',
    puede_reintentar: true,
  },
}

export function buildDocumentValidationMessage(
  validation: CedulaValidationResponse | null | undefined,
): ValidationMessage {
  const result = (validation?.resultado_final as ResultadoFinal) || 'no_concluyente'
  const entry = MESSAGES[result] || MESSAGES.no_concluyente
  return { ...entry, mostrar_score: false }
}

const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
const MAX_SIZE_BYTES = 10 * 1024 * 1024 // 10 MB

export interface FrontendValidationError {
  code:
    | 'missing_anverso'
    | 'missing_reverso'
    | 'invalid_type_anverso'
    | 'invalid_type_reverso'
    | 'too_large_anverso'
    | 'too_large_reverso'
  message: string
}

export function validateFilesBeforeUpload(
  anversoFile: File | null | undefined,
  reversoFile: File | null | undefined,
): FrontendValidationError | null {
  if (!anversoFile) {
    return { code: 'missing_anverso', message: 'Debes cargar la imagen frontal de la cédula.' }
  }
  if (!reversoFile) {
    return { code: 'missing_reverso', message: 'Debes cargar la imagen trasera de la cédula.' }
  }
  if (!ALLOWED_TYPES.includes(anversoFile.type)) {
    return { code: 'invalid_type_anverso', message: 'El archivo del anverso debe ser una imagen JPG, PNG o WEBP.' }
  }
  if (!ALLOWED_TYPES.includes(reversoFile.type)) {
    return { code: 'invalid_type_reverso', message: 'El archivo del reverso debe ser una imagen JPG, PNG o WEBP.' }
  }
  if (anversoFile.size > MAX_SIZE_BYTES) {
    return { code: 'too_large_anverso', message: 'La imagen del anverso supera el tamaño máximo permitido (10 MB).' }
  }
  if (reversoFile.size > MAX_SIZE_BYTES) {
    return { code: 'too_large_reverso', message: 'La imagen del reverso supera el tamaño máximo permitido (10 MB).' }
  }
  return null
}

export async function validateCedulaChilenaDocuments(params: {
  anversoFile: File
  reversoFile: File
}): Promise<CedulaValidationResponse> {
  const endpoint = CEDULA_VALIDATION_ENDPOINT
  if (!endpoint) {
    throw new Error('No está configurado el endpoint de validación documental.')
  }

  const formData = new FormData()
  formData.append('anverso', params.anversoFile)
  formData.append('reverso', params.reversoFile)
  formData.append('requiere_ambas_caras', 'true')

  const response = await fetch(endpoint, {
    method: 'POST',
    body: formData,
    // NO setear Content-Type manualmente; el browser arma el boundary multipart.
  })

  let data: CedulaValidationResponse | null = null
  try {
    data = await response.json()
  } catch {
    data = null
  }

  if (!response.ok && !data) {
    throw new Error('No fue posible validar los documentos.')
  }

  return data || {}
}