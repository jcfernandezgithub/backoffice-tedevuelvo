/**
 * Análisis con IA de un documento de crédito asociado a seguro de desgravamen.
 * Devuelve la tasa utilizada en el crédito (con seguro) y las proyecciones por plazo.
 */

export const CREDIT_RATE_ANALYSIS_ENDPOINT =
  (import.meta.env.VITE_N8N_CREDIT_RATE_ANALYSIS_URL as string | undefined) ||
  'https://gary-tester.app.n8n.cloud/webhook/8507c8f3-f138-45cc-830c-b97d55b4a9f3';

export interface CreditDocumentAnalysis {
  es_credito_valido?: boolean;
  institucion_financiera?: string;
  monto_credito_detectado?: number;
  cuota_mensual_detectada?: number;
  plazo_meses_detectado?: number;
  tasa_desgravamen_mensual_pct?: number;
}

export interface CreditRatesSummary {
  tasa_interes_mensual_credito_pct?: number;
  tasa_desgravamen_mensual_pct?: number;
  tasa_combinada_mensual_pct?: number;
  tasa_efectiva_anual_tea_pct?: number;
}

export interface CreditRateProjection {
  plazo_meses?: number;
  cuota_mensual_estimada?: number;
  tasa_interes_pura_acumulada_pct?: number;
  tasa_total_con_seguro_pct?: number;
  monto_total_a_pagar?: number;
}

export interface CreditRateAnalysisResponse {
  documento_analizado?: CreditDocumentAnalysis;
  resumen_tasas?: CreditRatesSummary;
  proyecciones_por_plazo?: CreditRateProjection[];
  tabla_resumen_markdown?: string;
  observaciones?: string;
  es_valido_para_continuar_proceso?: boolean;
  http_status_sugerido?: number;
  [key: string]: unknown;
}

export const MAX_CREDIT_FILE_SIZE = 15 * 1024 * 1024; // 15 MB

export async function analyzeCreditDocument(
  file: File,
  signal?: AbortSignal,
): Promise<CreditRateAnalysisResponse> {
  const formData = new FormData();
  // El webhook espera la key "file"; se agregan alias por compatibilidad.
  formData.append('file', file);
  formData.append('archivo', file);
  formData.append('documento', file);

  const response = await fetch(CREDIT_RATE_ANALYSIS_ENDPOINT, {
    method: 'POST',
    body: formData,
    signal,
  });

  let data: unknown = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    const message =
      (data as { message?: string } | null)?.message ||
      `El servicio de análisis respondió con estado ${response.status}.`;
    throw new Error(message);
  }

  if (!data) {
    throw new Error('El servicio de análisis no devolvió una respuesta válida.');
  }

  // n8n puede responder un array con un único item.
  const payload = Array.isArray(data) ? data[0] : data;
  return (payload ?? {}) as CreditRateAnalysisResponse;
}
