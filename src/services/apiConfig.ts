/** Legacy services retain their existing environment when no override is configured. */
export function normalizeApiBaseUrl(value: string): string {
  const base = value.trim().replace(/\/+$/, '')
  return base.endsWith('/api/v1') ? base : `${base}/api/v1`
}

export const configuredApiBaseUrl = import.meta.env.VITE_API_BASE_URL
  ? normalizeApiBaseUrl(import.meta.env.VITE_API_BASE_URL)
  : undefined
export const legacyApiBaseUrl = configuredApiBaseUrl ?? 'https://tedevuelvo-app-be.onrender.com/api/v1'