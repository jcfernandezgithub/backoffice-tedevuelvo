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
  tasa_mensual_pura_pct?: number;
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

  return unwrapAnalysis(data);
}

/**
 * n8n puede envolver el resultado (array, `output`, `json`, `data`, `body`)
 * o devolverlo como string JSON. Se busca recursivamente el objeto que
 * contiene las tasas / proyecciones.
 */
function unwrapAnalysis(input: unknown, depth = 0): CreditRateAnalysisResponse {
  if (depth > 6 || input == null) return {} as CreditRateAnalysisResponse;

  if (typeof input === 'string') {
    const text = input.trim();
    if (!text.startsWith('{') && !text.startsWith('[')) return {} as CreditRateAnalysisResponse;
    try {
      return unwrapAnalysis(JSON.parse(text), depth + 1);
    } catch {
      return {} as CreditRateAnalysisResponse;
    }
  }

  if (Array.isArray(input)) {
    for (const item of input) {
      const found = unwrapAnalysis(item, depth + 1);
      if (looksLikeAnalysis(found)) return found;
    }
    return {} as CreditRateAnalysisResponse;
  }

  if (typeof input !== 'object') return {} as CreditRateAnalysisResponse;

  const obj = input as Record<string, unknown>;
  if (looksLikeAnalysis(obj)) return normalizeAnalysis(obj);

  for (const key of ['output', 'json', 'data', 'body', 'result', 'response']) {
    if (key in obj) {
      const found = unwrapAnalysis(obj[key], depth + 1);
      if (looksLikeAnalysis(found)) return found;
    }
  }

  return normalizeAnalysis(obj);
}

/** Convierte a número tolerando strings con %, puntos y comas. */
function toNum(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return undefined;
  const cleaned = value.replace(/[%\s$]/g, '').replace(/\.(?=\d{3}\b)/g, '').replace(',', '.');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : undefined;
}

/** Aplana recursivamente el payload en pares [clave, valor numérico]. */
function flattenNumbers(input: unknown, depth = 0, acc: Array<[string, number]> = []) {
  if (depth > 5 || input == null || typeof input !== 'object') return acc;
  if (Array.isArray(input)) return acc; // las listas se tratan aparte (proyecciones)
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    const n = toNum(v);
    if (n !== undefined) acc.push([k.toLowerCase(), n]);
    else flattenNumbers(v, depth + 1, acc);
  }
  return acc;
}

function pick(
  pairs: Array<[string, number]>,
  include: string[],
  exclude: string[] = [],
): number | undefined {
  const hit = pairs.find(
    ([k, v]) =>
      include.every((t) => k.includes(t)) && !exclude.some((t) => k.includes(t)) && v !== 0,
  );
  return hit?.[1];
}

/** Tolera variantes de claves y deriva los valores que la IA no entregó. */
function normalizeAnalysis(obj: Record<string, unknown>): CreditRateAnalysisResponse {
  const out = { ...(obj as CreditRateAnalysisResponse) };
  const pairs = flattenNumbers(obj);

  // ---- Datos del documento ----
  const doc: CreditDocumentAnalysis = { ...(out.documento_analizado ?? {}) };
  doc.monto_credito_detectado =
    toNum(doc.monto_credito_detectado) ?? pick(pairs, ['monto'], ['total', 'pagar', 'cuota']);
  doc.cuota_mensual_detectada =
    toNum(doc.cuota_mensual_detectada) ?? pick(pairs, ['cuota'], ['plazo', 'numero', 'cantidad']);
  doc.plazo_meses_detectado =
    toNum(doc.plazo_meses_detectado) ?? pick(pairs, ['plazo']) ?? pick(pairs, ['meses']);
  out.documento_analizado = doc;

  // ---- Tasas ----
  const r: CreditRatesSummary = { ...(out.resumen_tasas ?? {}) };
  const desgravamen =
    toNum(r.tasa_desgravamen_mensual_pct) ??
    toNum(doc.tasa_desgravamen_mensual_pct) ??
    pick(pairs, ['desgravamen']);
  const interes =
    toNum(r.tasa_interes_mensual_credito_pct) ??
    pick(pairs, ['interes', 'mensual'], ['acumulad', 'seguro', 'total']) ??
    pick(pairs, ['tasa', 'credito'], ['acumulad', 'seguro', 'anual', 'combinada']);
  let combinada =
    toNum(r.tasa_combinada_mensual_pct) ??
    pick(pairs, ['combinada']) ??
    pick(pairs, ['con_seguro'], ['acumulad', 'total_a']) ??
    pick(pairs, ['total', 'seguro'], ['acumulad', 'pagar']);
  if (combinada === undefined && interes !== undefined) {
    combinada = interes + (desgravamen ?? 0);
  }
  let tea =
    toNum(r.tasa_efectiva_anual_tea_pct) ?? pick(pairs, ['tea']) ?? pick(pairs, ['anual']);
  if (tea === undefined && combinada !== undefined) {
    tea = (Math.pow(1 + combinada / 100, 12) - 1) * 100;
  }
  r.tasa_desgravamen_mensual_pct = desgravamen;
  r.tasa_interes_mensual_credito_pct = interes;
  r.tasa_combinada_mensual_pct = combinada;
  r.tasa_efectiva_anual_tea_pct = tea;
  out.resumen_tasas = r;

  // ---- Proyecciones ----
  if (!Array.isArray(out.proyecciones_por_plazo)) {
    const alt =
      obj['proyecciones'] ??
      obj['proyeccionesPorPlazo'] ??
      obj['proyeccion_por_plazo'] ??
      obj['proyecciones_por_cuotas'] ??
      obj['tabla_proyecciones'];
    if (Array.isArray(alt)) out.proyecciones_por_plazo = alt as CreditRateProjection[];
  }
  if (Array.isArray(out.proyecciones_por_plazo)) {
    const monto = doc.monto_credito_detectado;
    out.proyecciones_por_plazo = out.proyecciones_por_plazo.map((p) => {
      const raw = (p ?? {}) as Record<string, unknown>;
      const plazo = toNum(raw.plazo_meses ?? raw.plazo ?? raw.cuotas ?? raw.meses);
      const tasaConSeguro =
        toNum(raw.tasa_total_con_seguro_pct ?? raw.tasa_con_seguro_pct ?? raw.tasa_con_seguro) ??
        combinada;
      const tasaMensualPura =
        toNum(
          raw.tasa_mensual_pura_pct ??
            raw.tasa_interes_mensual_pct ??
            raw.tasa_interes_mensual_credito_pct ??
            raw.tasa_pura,
        ) ?? interes;
      let cuota = toNum(raw.cuota_mensual_estimada ?? raw.cuota_estimada ?? raw.cuota_mensual);
      let total = toNum(raw.monto_total_a_pagar ?? raw.total_a_pagar ?? raw.total);
      // Derivación por anualidad cuando la IA no devuelve montos.
      if ((!cuota || cuota <= 0) && monto && plazo && tasaConSeguro) {
        const i = tasaConSeguro / 100;
        cuota = i > 0 ? (monto * i) / (1 - Math.pow(1 + i, -plazo)) : monto / plazo;
      }
      if ((!total || total <= 0) && cuota && plazo) total = cuota * plazo;
      let acumulada = toNum(raw.tasa_interes_pura_acumulada_pct ?? raw.tasa_acumulada_pct);
      if ((!acumulada || acumulada <= 0) && total && monto) {
        acumulada = (total / monto - 1) * 100;
      }
      return {
        ...p,
        plazo_meses: plazo,
        tasa_mensual_pura_pct: tasaMensualPura,
        cuota_mensual_estimada: cuota,
        monto_total_a_pagar: total,
        tasa_interes_pura_acumulada_pct: acumulada,
        tasa_total_con_seguro_pct: tasaConSeguro,
      } as CreditRateProjection;
    });
  }

  return out;
}


function looksLikeAnalysis(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const obj = value as Record<string, unknown>;
  return (
    'resumen_tasas' in obj ||
    'proyecciones_por_plazo' in obj ||
    'documento_analizado' in obj ||
    'es_valido_para_continuar_proceso' in obj
  );
}
