import { authenticatedFetch, publicFetch } from './apiClient';

/**
 * Interruptor global de "Validación de imágenes con IA".
 *
 * - GET  /ai-image-validation  → público, responde directamente `true`/`false`.
 * - PATCH /ai-image-validation → requiere JWT con rol ADMIN, body `{ enabled }`,
 *   responde directamente `true`/`false`. El primer PATCH crea el registro.
 */

async function handle(res: Response, action: string): Promise<boolean> {
  const text = await res.text().catch(() => '');
  if (!res.ok) {
    let detail = text;
    try {
      const body = text ? JSON.parse(text) : null;
      const m = body?.message;
      detail = Array.isArray(m) ? m.join(', ') : m || text;
    } catch {
      /* noop */
    }
    if (res.status === 403) {
      throw new Error(`No se pudo ${action}: tu usuario no tiene rol ADMIN (403).`);
    }
    if (res.status === 401) {
      throw new Error(`No se pudo ${action}: la sesión es inválida o expiró (401).`);
    }
    throw new Error(`No se pudo ${action}: ${detail || res.statusText}`);
  }
  // La API responde un booleano a pelo (true / false)
  try {
    return JSON.parse(text) === true;
  } catch {
    return text.trim() === 'true';
  }
}

export const aiImageValidationService = {
  /** Consulta pública del estado actual del interruptor. */
  getEnabled(): Promise<boolean> {
    return publicFetch('/ai-image-validation').then((r) =>
      handle(r, 'consultar la configuración de validación de imágenes'),
    );
  },
  /** Actualización administrativa (crea el registro si no existe). */
  setEnabled(enabled: boolean): Promise<boolean> {
    return authenticatedFetch('/ai-image-validation', {
      method: 'PATCH',
      body: JSON.stringify({ enabled }),
    }).then((r) => handle(r, 'actualizar la configuración de validación de imágenes'));
  },
};