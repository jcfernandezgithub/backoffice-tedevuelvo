/**
 * Validación visual de documentos de crédito de consumo via servicio externo (n8n).
 *
 * IMPORTANTE:
 * - La validación es solo visual, no oficial.
 * - No exponer scoring técnico ni datos sensibles al usuario final.
 */

export const CREDITO_VALIDATION_ENDPOINT =
  (import.meta.env.VITE_N8N_CREDITO_VALIDATION_URL as string | undefined) ||
  'https://gary-tester.app.n8n.cloud/webhook/validar-documento-credito-consumo'

export type CreditoResultadoFinal =
  | 'valido_visualmente'
  | 'probablemente_valido_visualmente'
  | 'no_valido_para_validacion_completa'
  | 'no_concluyente'
  | 'no_valido'
  | 'no_corresponde'

export interface CreditoValidationResponse {
  resultado_final?: CreditoResultadoFinal | string
  es_valida_para_continuar_proceso?: boolean
  scoring_correspondencia_visual?: number
  validacion_completa?: boolean
  motivos_no_validez?: string[]
  alertas?: string[]
  recomendacion?: string
  resumen?: string
  [key: string]: any
}

export interface CreditoValidationMessage {
  estado_validacion: 'ok' | 'advertencia' | 'error'
  titulo: string
  mensaje: string
  accion_recomendada: string
  puede_reintentar: boolean
}

const MESSAGES: Record<CreditoResultadoFinal, CreditoValidationMessage> = {
  valido_visualmente: {
    estado_validacion: 'ok',
    titulo: 'Documento de crédito reconocido',
    mensaje:
      'El archivo corresponde visualmente a un documento de crédito de consumo válido.',
    accion_recomendada: 'Puedes continuar con el proceso.',
    puede_reintentar: false,
  },
  probablemente_valido_visualmente: {
    estado_validacion: 'advertencia',
    titulo: 'Documento probablemente válido',
    mensaje:
      'El archivo parece corresponder a un documento de crédito de consumo, pero podría requerir revisión adicional.',
    accion_recomendada: 'Puedes continuar, te sugerimos verificar manualmente.',
    puede_reintentar: false,
  },
  no_valido_para_validacion_completa: {
    estado_validacion: 'advertencia',
    titulo: 'Documento incompleto',
    mensaje:
      'El archivo no contiene suficiente información para validar que sea un documento de crédito de consumo.',
    accion_recomendada:
      'Verifica que el archivo cargado esté completo y legible.',
    puede_reintentar: true,
  },
  no_valido: {
    estado_validacion: 'error',
    titulo: 'Documento no válido',
    mensaje:
      'El archivo no cumple con los requisitos para ser considerado un documento de crédito de consumo.',
    accion_recomendada:
      'Revisa que el archivo corresponda al contrato o documento del crédito.',
    puede_reintentar: true,
  },
  no_corresponde: {
    estado_validacion: 'error',
    titulo: 'No corresponde a un crédito de consumo',
    mensaje:
      'El análisis visual indica que el archivo no es un documento asociado a un crédito de consumo.',
    accion_recomendada:
      'Carga el documento correcto (contrato, pagaré o equivalente del crédito de consumo).',
    puede_reintentar: true,
  },
  no_concluyente: {
    estado_validacion: 'advertencia',
    titulo: 'No pudimos validar el documento',
    mensaje:
      'La calidad del archivo no permite determinar con certeza si corresponde a un crédito de consumo.',
    accion_recomendada:
      'Intenta nuevamente con un archivo más claro y legible.',
    puede_reintentar: true,
  },
}

export function buildCreditoValidationMessage(
  validation: CreditoValidationResponse | null | undefined,
): CreditoValidationMessage {
  const result = (validation?.resultado_final as CreditoResultadoFinal) || 'no_concluyente'
  return MESSAGES[result] || MESSAGES.no_concluyente
}

export async function validateCreditoDocument(params: {
  file: File
}): Promise<CreditoValidationResponse> {
  const endpoint = CREDITO_VALIDATION_ENDPOINT
  if (!endpoint) {
    throw new Error('No está configurado el endpoint de validación de crédito.')
  }

  const formData = new FormData()
  // Enviamos el archivo bajo varios nombres comunes para máxima compatibilidad
  // con la configuración del webhook n8n.
  formData.append('documento', params.file)
  formData.append('archivo', params.file)
  formData.append('file', params.file)

  const response = await fetch(endpoint, {
    method: 'POST',
    body: formData,
  })

  let data: CreditoValidationResponse | null = null
  try {
    data = await response.json()
  } catch {
    data = null
  }

  if (!response.ok && !data) {
    throw new Error('No fue posible validar el documento de crédito.')
  }

  return data || {}
}