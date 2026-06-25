import { authenticatedFetch } from './apiClient';

const API_BASE_URL = 'https://tedevuelvo-app-be.onrender.com/api/v1';

export interface Institution {
  id: string;
  value: string;
  label: string;
  grupo: string;
  margen_seguridad: number;
  active: boolean;
}

export type InstitutionPayload = Omit<Institution, 'id'>;

const CACHE_KEY = 'tdv:institutions:public:v1';

/** Cache sincrónica en memoria + localStorage, alimentada por el hook. */
let memCache: Institution[] | null = null;

export function getCachedInstitutions(): Institution[] {
  if (memCache) return memCache;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) {
      memCache = JSON.parse(raw) as Institution[];
      return memCache!;
    }
  } catch {
    /* noop */
  }
  return [];
}

export function setCachedInstitutions(list: Institution[]) {
  memCache = list;
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(list));
  } catch {
    /* noop */
  }
}

function normalize(raw: any): Institution {
  return {
    id: String(raw.id ?? raw._id ?? raw.value),
    value: String(raw.value ?? ''),
    label: String(raw.label ?? ''),
    grupo: String(raw.grupo ?? ''),
    margen_seguridad: Number(raw.margen_seguridad ?? 0),
    active: raw.active !== false,
  };
}

async function parseJsonOrThrow(res: Response, action: string) {
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`No se pudo ${action} (${res.status}): ${text}`);
  }
  return res.json();
}

export const institutionsService = {
  async listPublic(): Promise<Institution[]> {
    const res = await fetch(`${API_BASE_URL}/public/institutions`);
    const data = await parseJsonOrThrow(res, 'cargar instituciones públicas');
    const list = (Array.isArray(data) ? data : []).map(normalize);
    setCachedInstitutions(list);
    return list;
  },

  async listAdmin(): Promise<Institution[]> {
    const res = await authenticatedFetch('/admin/institutions');
    const data = await parseJsonOrThrow(res, 'cargar instituciones');
    return (Array.isArray(data) ? data : []).map(normalize);
  },

  async create(payload: InstitutionPayload): Promise<Institution> {
    const res = await authenticatedFetch('/admin/institutions', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return normalize(await parseJsonOrThrow(res, 'crear institución'));
  },

  async update(id: string, payload: Partial<InstitutionPayload>): Promise<Institution> {
    const res = await authenticatedFetch(`/admin/institutions/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
    return normalize(await parseJsonOrThrow(res, 'actualizar institución'));
  },

  async remove(id: string): Promise<void> {
    const res = await authenticatedFetch(`/admin/institutions/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok && res.status !== 204) {
      const text = await res.text().catch(() => '');
      throw new Error(`No se pudo eliminar institución (${res.status}): ${text}`);
    }
  },
};