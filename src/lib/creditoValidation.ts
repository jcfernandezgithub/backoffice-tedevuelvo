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
  const result = normalizeResultadoFinal(validation)
  return MESSAGES[result] || MESSAGES.no_concluyente
}

/**
 * Mapea el `resultado_final` del servicio (que puede traer códigos propios del
 * dominio crédito) a la taxonomía interna que usamos para construir mensajes.
 * Si no se reconoce, se infiere a partir de otras señales (corresponde_credito_consumo,
 * es_valida_para_continuar_proceso, nivel_confianza).
 */
function normalizeResultadoFinal(
  validation: CreditoValidationResponse | null | undefined,
): CreditoResultadoFinal {
  const raw = (validation?.resultado_final ?? '').toString().toLowerCase().trim()

  // Aliases directos del servicio de validación de crédito de consumo.
  const ALIAS: Record<string, CreditoResultadoFinal> = {
    valido_visualmente: 'valido_visualmente',
    probablemente_valido_visualmente: 'probablemente_valido_visualmente',
    no_valido_para_validacion_completa: 'no_valido_para_validacion_completa',
    no_concluyente: 'no_concluyente',
    no_valido: 'no_valido',
    no_corresponde: 'no_corresponde',
    // Códigos específicos del endpoint de crédito de consumo.
    valido_documento_credito: 'valido_visualmente',
    valido_credito_consumo: 'valido_visualmente',
    posible_documento_credito: 'probablemente_valido_visualmente',
    posible_credito_consumo: 'probablemente_valido_visualmente',
    documento_credito_incompleto: 'no_valido_para_validacion_completa',
    documento_complementario: 'probablemente_valido_visualmente',
    no_corresponde_credito_consumo: 'no_corresponde',
    no_credito_consumo: 'no_corresponde',
  }

  if (raw && ALIAS[raw]) return ALIAS[raw]

  // Fallback por señales semánticas.
  const continuar = validation?.es_valida_para_continuar_proceso === true
  const corresponde = (validation as any)?.corresponde_credito_consumo === true
  const confianza = ((validation as any)?.nivel_confianza ?? '').toString().toLowerCase()

  if (continuar && corresponde) {
    if (confianza === 'alto' || confianza === 'alta') return 'valido_visualmente'
    return 'probablemente_valido_visualmente'
  }
  if (corresponde && !continuar) return 'no_valido_para_validacion_completa'
  if (!corresponde && raw) return 'no_corresponde'
  return 'no_concluyente'
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