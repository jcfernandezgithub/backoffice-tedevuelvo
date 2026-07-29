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
  return readCache<BankRatesResponse>('bank', fallbackBankCesantia as unknown as BankRatesResponse);
}

/** Tasas de cesantía Te Devuelvo (sincrónico). */
export function getTdvCesantiaRates(): TeDevuelvoRatesResponse {
  return readCache<TeDevuelvoRatesResponse>('tdv', fallbackTdvCesantia as unknown as TeDevuelvoRatesResponse);
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
    throw new Error(`No se pudo ${action}: ${detail}`);
  }
  return body;
}

const enc = encodeURIComponent;

// ── API ──────────────────────────────────────────────────────────────────────

export const ratesService = {
  // Tasas bancarias mensuales (cesantía)
  async listBankRates(): Promise<BankRatesResponse> {
    const data = (await handle(await authenticatedFetch('/bank-rates'), 'cargar tasas bancarias')) || {};
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
    const data = (await handle(await authenticatedFetch('/te-devuelvo-rates'), 'cargar tasas Te Devuelvo')) || {};
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
    const data = (await handle(await authenticatedFetch('/bank-rate-matrix'), 'cargar la matriz de tasas')) || {};
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
