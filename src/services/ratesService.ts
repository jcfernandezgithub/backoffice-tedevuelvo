import { authenticatedFetch } from './apiClient';
import fallbackBankCesantia from '@/data/tasas_cesantia_banco.json';
import fallbackTdvCesantia from '@/data/tasas_cesantia_te_devuelvo.json';
import fallbackMatrix from '@/data/tasas_formateadas_te_devuelvo.json';

// ── Tipos ────────────────────────────────────────────────────────────────────

export interface MonthlyRate {
  desde: number;
  hasta: number | null;
  tasa_mensual: number;
}
export type MonthlyRateRanges = Record<string, MonthlyRate>;
export type BankRatesResponse = Record<string, MonthlyRateRanges>;
export type TeDevuelvoRatesResponse = Record<string, MonthlyRateRanges>;

export interface RateRangeInput {
  tramo: string;
  orden: number;
  desde: number;
  hasta: number | null;
  tasa_mensual: number;
}

export type TermRates = Record<string, number>;
export type AmountRates = Record<string, TermRates>;
export type AgeGroupRates = Record<string, AmountRates>;
export type BankRateMatrixResponse = Record<string, AgeGroupRates>;

export interface MatrixTermInput { plazo: number; orden: number; tasa: number }
export interface MatrixAmountInput { monto: number; orden: number; plazos: MatrixTermInput[] }
export interface MatrixAgeGroupInput { grupo: string; orden: number; montos: MatrixAmountInput[] }

// ── Cache sincrónica (memoria + localStorage) con fallback a los JSON ────────

const CACHE_KEYS = {
  bank: 'tdv:rates:bank-cesantia:v1',
  tdv: 'tdv:rates:tdv-cesantia:v1',
  matrix: 'tdv:rates:matrix:v1',
} as const;

type CacheName = keyof typeof CACHE_KEYS;

const mem: { [K in CacheName]: any } = { bank: null, tdv: null, matrix: null };

function readCache<T>(name: CacheName, fallback: T): T {
  if (mem[name]) return mem[name] as T;
  try {
    const raw = localStorage.getItem(CACHE_KEYS[name]);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Object.keys(parsed).length > 0) {
        mem[name] = parsed;
        return parsed as T;
      }
    }
  } catch {
    /* noop */
  }
  return fallback;
}

function writeCache(name: CacheName, value: unknown) {
  mem[name] = value;
  try {
    localStorage.setItem(CACHE_KEYS[name], JSON.stringify(value));
  } catch {
    /* noop */
  }
}

/** Tasas de cesantía por banco (sincrónico, para los cálculos). */
export function getBankCesantiaRates(): BankRatesResponse {
  const fb = fallbackBankCesantia as unknown as BankRatesResponse;
  const cached = readCache<BankRatesResponse>('bank', fb);
  // Fusionamos: el servicio manda, pero si una institución no viene en la
  // respuesta (o llega vacía) usamos la tasa estática para no mostrar $0.
  const merged: BankRatesResponse = { ...fb };
  for (const [bank, ranges] of Object.entries(cached || {})) {
    if (ranges && Object.keys(ranges).length > 0) merged[bank] = ranges;
  }
  return merged;
}

/** Tasas de cesantía Te Devuelvo (sincrónico). */
export function getTdvCesantiaRates(): TeDevuelvoRatesResponse {
  const fb = fallbackTdvCesantia as unknown as TeDevuelvoRatesResponse;
  const cached = readCache<TeDevuelvoRatesResponse>('tdv', fb);
  const merged: TeDevuelvoRatesResponse = { ...fb };
  for (const [owner, ranges] of Object.entries(cached || {})) {
    if (ranges && Object.keys(ranges).length > 0) merged[owner] = ranges;
  }
  return merged;
}

/** Matriz bancaria de desgravamen (sincrónico). */
export function getBankRateMatrix(): BankRateMatrixResponse {
  return readCache<BankRateMatrixResponse>('matrix', fallbackMatrix as unknown as BankRateMatrixResponse);
}

// ── Helpers HTTP ─────────────────────────────────────────────────────────────

async function handle(res: Response, action: string) {
  if (res.status === 204) return null;
  const text = await res.text().catch(() => '');
  let body: any = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }
  if (!res.ok) {
    const message = body?.message;
    const detail = Array.isArray(message) ? message.join(', ') : message || text || res.statusText;
    if (res.status === 403) {
      throw new Error(
        `No se pudo ${action}: tu usuario no tiene permisos de escritura sobre tasas (403). ${detail || ''}`.trim(),
      );
    }
    throw new Error(`No se pudo ${action}: ${detail}`);
  }
  return body;
}

const enc = encodeURIComponent;

// ── Normalización de respuestas ──────────────────────────────────────────────
// El backend puede responder envuelto ({ data }, { items }, { results }) o como
// arreglo de documentos ([{ banco, tramos: [...] }]). Normalizamos todo al
// formato Record que consumen la calculadora y la UI.

function unwrap(raw: any): any {
  if (!raw) return raw;
  if (Array.isArray(raw)) return raw;
  for (const k of ['data', 'items', 'results', 'records']) {
    if (raw[k] !== undefined) return raw[k];
  }
  return raw;
}

function num(v: any): number {
  const n = typeof v === 'string' ? Number(v) : v;
  return Number.isFinite(n) ? n : 0;
}

function normalizeMonthly(raw: any): Record<string, MonthlyRateRanges> {
  const src = unwrap(raw);
  if (!src) return {};
  const out: Record<string, MonthlyRateRanges> = {};

  const buildRanges = (tramos: any): MonthlyRateRanges => {
    const ranges: MonthlyRateRanges = {};
    if (Array.isArray(tramos)) {
      tramos.forEach((t: any, i: number) => {
        const name = t?.tramo ?? t?.nombre ?? t?.name ?? `Tramo ${i + 1}`;
        ranges[name] = {
          desde: num(t?.desde),
          hasta: t?.hasta === null || t?.hasta === undefined ? null : num(t.hasta),
          tasa_mensual: num(t?.tasa_mensual ?? t?.tasa),
        };
      });
    } else if (tramos && typeof tramos === 'object') {
      for (const [name, t] of Object.entries<any>(tramos)) {
        if (!t || typeof t !== 'object') continue;
        ranges[name] = {
          desde: num(t?.desde),
          hasta: t?.hasta === null || t?.hasta === undefined ? null : num(t.hasta),
          tasa_mensual: num(t?.tasa_mensual ?? t?.tasa),
        };
      }
    }
    return ranges;
  };

  if (Array.isArray(src)) {
    for (const doc of src) {
      const owner = doc?.banco ?? doc?.nombre ?? doc?.name ?? doc?.entidad;
      if (!owner) continue;
      out[owner] = buildRanges(doc?.tramos ?? doc?.rangos ?? doc);
    }
    return out;
  }

  for (const [owner, value] of Object.entries<any>(src)) {
    const ranges = buildRanges(value?.tramos ?? value);
    if (Object.keys(ranges).length) out[owner] = ranges;
  }
  return out;
}

function normalizeMatrix(raw: any): BankRateMatrixResponse {
  const src = unwrap(raw);
  if (!src) return {};
  if (!Array.isArray(src)) return src as BankRateMatrixResponse;
  const out: BankRateMatrixResponse = {};
  for (const doc of src) {
    const bank = doc?.banco ?? doc?.nombre ?? doc?.name;
    if (!bank) continue;
    const groups: AgeGroupRates = {};
    const gruposEdad = doc?.gruposEdad ?? doc?.grupos ?? [];
    for (const g of Array.isArray(gruposEdad) ? gruposEdad : []) {
      const gname = g?.grupo ?? g?.nombre ?? g?.name;
      if (!gname) continue;
      const amounts: AmountRates = {};
      for (const m of Array.isArray(g?.montos) ? g.montos : []) {
        const terms: TermRates = {};
        for (const p of Array.isArray(m?.plazos) ? m.plazos : []) {
          terms[String(p?.plazo)] = num(p?.tasa);
        }
        amounts[String(num(m?.monto))] = terms;
      }
      groups[gname] = amounts;
    }
    out[bank] = groups;
  }
  return out;
}

function nonEmpty<T extends object>(value: T, fallback: T): T {
  return value && Object.keys(value).length > 0 ? value : fallback;
}

// ── API ──────────────────────────────────────────────────────────────────────

export const ratesService = {
  // Tasas bancarias mensuales (cesantía)
  async listBankRates(): Promise<BankRatesResponse> {
    const raw = await handle(await authenticatedFetch('/bank-rates'), 'cargar tasas bancarias');
    const data = nonEmpty(normalizeMonthly(raw), getBankCesantiaRates());
    writeCache('bank', data);
    return data as BankRatesResponse;
  },
  async createBankRate(payload: { banco: string; orden: number; tramos: RateRangeInput[] }) {
    return handle(
      await authenticatedFetch('/bank-rates', { method: 'POST', body: JSON.stringify(payload) }),
      'crear la entidad',
    );
  },
  async replaceBankRanges(bankName: string, tramos: RateRangeInput[]) {
    return handle(
      await authenticatedFetch(`/bank-rates/${enc(bankName)}/tramos`, {
        method: 'PUT',
        body: JSON.stringify({ tramos }),
      }),
      'reemplazar los tramos',
    );
  },
  async updateBankRange(bankName: string, rangeName: string, patch: Partial<MonthlyRate>) {
    return handle(
      await authenticatedFetch(`/bank-rates/${enc(bankName)}/tramos/${enc(rangeName)}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      }),
      'actualizar el tramo',
    );
  },
  async deleteBankRate(bankName: string) {
    return handle(
      await authenticatedFetch(`/bank-rates/${enc(bankName)}`, { method: 'DELETE' }),
      'eliminar la entidad',
    );
  },

  // Tasas Te Devuelvo
  async listTeDevuelvoRates(): Promise<TeDevuelvoRatesResponse> {
    const raw = await handle(await authenticatedFetch('/te-devuelvo-rates'), 'cargar tasas Te Devuelvo');
    const data = nonEmpty(normalizeMonthly(raw), getTdvCesantiaRates());
    writeCache('tdv', data);
    return data as TeDevuelvoRatesResponse;
  },
  async createTeDevuelvoRate(payload: { nombre: string; orden: number; tramos: RateRangeInput[] }) {
    return handle(
      await authenticatedFetch('/te-devuelvo-rates', { method: 'POST', body: JSON.stringify(payload) }),
      'crear la configuración',
    );
  },
  async replaceTeDevuelvoRanges(name: string, tramos: RateRangeInput[]) {
    return handle(
      await authenticatedFetch(`/te-devuelvo-rates/${enc(name)}/tramos`, {
        method: 'PUT',
        body: JSON.stringify({ tramos }),
      }),
      'reemplazar los tramos',
    );
  },
  async updateTeDevuelvoRange(name: string, rangeName: string, patch: Partial<MonthlyRate>) {
    return handle(
      await authenticatedFetch(`/te-devuelvo-rates/${enc(name)}/tramos/${enc(rangeName)}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      }),
      'actualizar el tramo',
    );
  },
  async deleteTeDevuelvoRate(name: string) {
    return handle(
      await authenticatedFetch(`/te-devuelvo-rates/${enc(name)}`, { method: 'DELETE' }),
      'eliminar la configuración',
    );
  },

  // Matriz bancaria (desgravamen)
  async listBankRateMatrix(): Promise<BankRateMatrixResponse> {
    const raw = await handle(await authenticatedFetch('/bank-rate-matrix'), 'cargar la matriz de tasas');
    const data = nonEmpty(normalizeMatrix(raw), getBankRateMatrix());
    writeCache('matrix', data);
    return data as BankRateMatrixResponse;
  },
  async createBankRateMatrix(payload: { banco: string; orden: number; gruposEdad: MatrixAgeGroupInput[] }) {
    return handle(
      await authenticatedFetch('/bank-rate-matrix', { method: 'POST', body: JSON.stringify(payload) }),
      'crear la matriz',
    );
  },
  async replaceBankRateMatrix(bankName: string, gruposEdad: MatrixAgeGroupInput[]) {
    return handle(
      await authenticatedFetch(`/bank-rate-matrix/${enc(bankName)}`, {
        method: 'PUT',
        body: JSON.stringify({ gruposEdad }),
      }),
      'reemplazar la matriz',
    );
  },
  async replaceMatrixTerms(bankName: string, ageGroup: string, amount: number, plazos: MatrixTermInput[]) {
    return handle(
      await authenticatedFetch(
        `/bank-rate-matrix/${enc(bankName)}/grupos/${enc(ageGroup)}/montos/${amount}/plazos`,
        { method: 'PUT', body: JSON.stringify({ plazos }) },
      ),
      'reemplazar los plazos',
    );
  },
  async updateMatrixRate(bankName: string, ageGroup: string, amount: number, term: number, tasa: number) {
    return handle(
      await authenticatedFetch(
        `/bank-rate-matrix/${enc(bankName)}/grupos/${enc(ageGroup)}/montos/${amount}/plazos/${term}`,
        { method: 'PATCH', body: JSON.stringify({ tasa }) },
      ),
      'actualizar la tasa',
    );
  },
  async deleteBankRateMatrix(bankName: string) {
    return handle(
      await authenticatedFetch(`/bank-rate-matrix/${enc(bankName)}`, { method: 'DELETE' }),
      'eliminar la matriz',
    );
  },
};

export { writeCache as setRatesCache };
