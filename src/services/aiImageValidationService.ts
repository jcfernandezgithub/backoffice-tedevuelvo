import { authenticatedFetch, publicFetch } from './apiClient';

/**
 * Configuración global de las validaciones con IA.
 *
 * - GET  /ai-image-validation  → público, responde
 *   `{ imageValidationEnabled, docsValidationEnabled }`. Si aún no existe
 *   configuración en el backend, ambos valores se devuelven como `false`.
 * - PATCH /ai-image-validation → requiere JWT con rol ADMIN, body parcial
 *   (uno o ambos campos) y responde siempre la configuración completa.
 *   El primer PATCH crea el registro automáticamente.
 */

export interface AiValidationConfiguration {
  imageValidationEnabled: boolean;
  docsValidationEnabled: boolean;
}

export type UpdateAiValidationConfiguration = Partial<AiValidationConfiguration>;

function parseConfig(text: string): AiValidationConfiguration {
  try {
    const body = text ? JSON.parse(text) : null;
    // Compatibilidad con la versión anterior del servicio (booleano a pelo).
    if (typeof body === 'boolean') {
      return { imageValidationEnabled: body, docsValidationEnabled: false };
    }
    return {
      imageValidationEnabled: body?.imageValidationEnabled === true,
      docsValidationEnabled: body?.docsValidationEnabled === true,
    };
  } catch {
    return { imageValidationEnabled: false, docsValidationEnabled: false };
  }
}

async function handle(res: Response, action: string): Promise<AiValidationConfiguration> {
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
  return parseConfig(text);
}

export const aiImageValidationService = {
  /** Consulta pública de la configuración actual. */
  getConfig(): Promise<AiValidationConfiguration> {
    return publicFetch('/ai-image-validation').then((r) =>
      handle(r, 'consultar la configuración de validación con IA'),
    );
  },
  /**
   * Actualización administrativa parcial: enviar solo el campo modificado.
   * La respuesta siempre contiene la configuración completa.
   */
  updateConfig(
    patch: UpdateAiValidationConfiguration,
  ): Promise<AiValidationConfiguration> {
    return authenticatedFetch('/ai-image-validation', {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }).then((r) => handle(r, 'actualizar la configuración de validación con IA'));
  },
};