import { authenticatedFetch, publicFetch } from './apiClient';

/**
 * Configuración del filtro de valor mínimo de póliza.
 *
 * Regla de negocio (la aplica el backend): si `value <= minimumValue`,
 * la póliza debe filtrarse. El límite NUNCA se fija en el frontend; se
 * lee de la configuración activa que devuelve cada respuesta.
 *
 * Endpoints:
 * - POST   /policy-minimum-value/validate  → público, valida un valor.
 * - GET    /policy-minimum-value           → público, lista configuraciones.
 * - GET    /policy-minimum-value/:id       → público, una configuración.
 * - POST   /policy-minimum-value           → ADMIN, crea.
 * - PATCH  /policy-minimum-value/:id       → ADMIN, actualización parcial.
 * - DELETE /policy-minimum-value/:id       → ADMIN, elimina (204).
 */

export interface PolicyMinimumValueConfig {
  id: string;
  minimumValue: number;
  belowMinimumCode: string;
  belowMinimumMessage: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface PolicyMinimumValueInput {
  minimumValue: number;
  belowMinimumCode: string;
  belowMinimumMessage: string;
  isActive: boolean;
}

export type PolicyMinimumValuePatch = Partial<PolicyMinimumValueInput>;

export interface PolicyMinimumValueResult {
  shouldFilter: boolean;
  value: number;
  minimumValue: number;
  code: string;
  message: string | null;
}

// ── Normalización ────────────────────────────────────────────────────────────

function unwrap(raw: any): any {
  if (!raw) return raw;
  if (Array.isArray(raw)) return raw;
  for (const k of ['data', 'items', 'results', 'records']) {
    if (raw[k] !== undefined) return raw[k];
  }
  return raw;
}

function normalizeConfig(raw: any): PolicyMinimumValueConfig | null {
  if (!raw || typeof raw !== 'object') return null;
  const id = raw.id ?? raw._id; // MongoDB → id
  if (!id) return null;
  return {
    id: String(id),
    minimumValue: Number(raw.minimumValue ?? 0),
    belowMinimumCode: String(raw.belowMinimumCode ?? ''),
    belowMinimumMessage: String(raw.belowMinimumMessage ?? ''),
    isActive: Boolean(raw.isActive),
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
}

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
    const m = body?.message;
    const detail = Array.isArray(m) ? m.join(', ') : m || text || res.statusText;
    if (res.status === 403) {
      throw new Error(`No se pudo ${action}: tu usuario no tiene rol ADMIN (403).`);
    }
    if (res.status === 401) {
      throw new Error(`No se pudo ${action}: la sesión es inválida o expiró (401).`);
    }
    throw new Error(`No se pudo ${action}: ${detail}`);
  }
  return body;
}

// ── API ──────────────────────────────────────────────────────────────────────

export const policyMinimumValueService = {
  /** Validación pública: decide el flujo SOLO con `shouldFilter`. */
  async validate(value: number): Promise<PolicyMinimumValueResult> {
    const raw = await handle(
      await publicFetch('/policy-minimum-value/validate', {
        method: 'POST',
        body: JSON.stringify({ value }),
      }),
      'validar el valor de la póliza',
    );
    return raw as PolicyMinimumValueResult;
  },

  /** Lista pública de configuraciones. 404 → sin configuraciones. */
  async list(): Promise<PolicyMinimumValueConfig[]> {
    const res = await publicFetch('/policy-minimum-value');
    if (res.status === 404) return [];
    const raw = await handle(res, 'cargar las configuraciones');
    const src = unwrap(raw);
    const arr = Array.isArray(src) ? src : src ? [src] : [];
    return arr
      .map(normalizeConfig)
      .filter((c): c is PolicyMinimumValueConfig => c !== null);
  },

  async getById(id: string): Promise<PolicyMinimumValueConfig | null> {
    const raw = await handle(
      await publicFetch(`/policy-minimum-value/${encodeURIComponent(id)}`),
      'consultar la configuración',
    );
    return normalizeConfig(unwrap(raw));
  },

  async create(payload: PolicyMinimumValueInput): Promise<PolicyMinimumValueConfig | null> {
    const raw = await handle(
      await authenticatedFetch('/policy-minimum-value', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
      'crear la configuración',
    );
    return normalizeConfig(unwrap(raw));
  },

  async update(
    id: string,
    patch: PolicyMinimumValuePatch,
  ): Promise<PolicyMinimumValueConfig | null> {
    const raw = await handle(
      await authenticatedFetch(`/policy-minimum-value/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      }),
      'actualizar la configuración',
    );
    return normalizeConfig(unwrap(raw));
  },

  async remove(id: string): Promise<null> {
    return handle(
      await authenticatedFetch(`/policy-minimum-value/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      }),
      'eliminar la configuración',
    );
  },
};