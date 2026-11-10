import { authenticatedFetch } from './apiClient'

export interface FinancialInstitutionContact {
  id: string
  name: string
  email: string
  createdAt: string
  updatedAt: string
}

export interface FinancialContactPage {
  items: FinancialInstitutionContact[]
  pagination: { page: number; limit: number; total: number; totalPages: number }
}

export class FinancialContactError extends Error {
  constructor(message: string, public status: number) { super(message) }
}

export async function readContactResponse<T>(response: Response): Promise<T> {
  if (response.status === 204) return undefined as T
  const body = await response.json()
  if (!response.ok) {
    const raw = Array.isArray(body?.message) ? body.message.join(', ') : body?.message
    const message = response.status === 403 ? 'No tienes permiso para administrar entidades financieras.'
      : response.status === 404 ? 'Esta entidad ya no existe. Actualizamos el listado.'
      : response.status === 409 ? 'Ya existe una entidad con este nombre.'
      : response.status === 401 ? 'Tu sesión ha expirado. Vuelve a iniciar sesión.'
      : response.status === 400 ? raw || 'Revisa los datos ingresados.'
      : 'No se pudo completar la operación. Inténtalo nuevamente.'
    throw new FinancialContactError(message, response.status)
  }
  return body as T
}

const base = '/financial-institution-contacts'
async function request<T>(path = '', init: RequestInit = {}): Promise<T> {
  return readContactResponse<T>(await authenticatedFetch(`${base}${path}`, init))
}
const normalize = (item: FinancialInstitutionContact & { _id?: string }): FinancialInstitutionContact => ({
  id: item.id ?? item._id ?? '', name: item.name, email: item.email, createdAt: item.createdAt, updatedAt: item.updatedAt,
})

export const financialInstitutionContactsApi = {
  list: async (page = 1, limit = 20, signal?: AbortSignal): Promise<FinancialContactPage> => {
    const data = await request<FinancialContactPage>(`?page=${page}&limit=${limit}`, { signal })
    return { ...data, items: data.items.map(normalize) }
  },
  get: async (id: string) => normalize(await request<FinancialInstitutionContact>(`/${encodeURIComponent(id)}`)),
  create: async (input: { name: string; email: string }) => normalize(await request<FinancialInstitutionContact>('', {
    method: 'POST', body: JSON.stringify({ name: input.name, email: input.email }),
  })),
  update: async (id: string, input: { name: string; email: string }) => normalize(await request<FinancialInstitutionContact>(`/${encodeURIComponent(id)}`, {
    method: 'PATCH', body: JSON.stringify({ name: input.name, email: input.email }),
  })),
  delete: (id: string) => request<void>(`/${encodeURIComponent(id)}`, { method: 'DELETE' }),
}