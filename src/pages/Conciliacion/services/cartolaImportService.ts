import type { CartolaData, CartolaMovimiento } from './cartolaService'

/**
 * Importación manual de la cartola bancaria.
 *
 * El usuario descarga el XML desde el portal de Scotiabank (o copia el JSON
 * que devuelve el servicio backend) y lo carga en la aplicación. Aquí lo
 * transformamos a la MISMA estructura `CartolaData` que ya consume la
 * conciliación, de modo que el resto del flujo funciona sin cambios.
 */

export interface CartolaImportResult {
  cartola: CartolaData
  movimientos: CartolaMovimiento[]
  /** 'xml' | 'json' — origen detectado del contenido pegado o del archivo. */
  source: 'xml' | 'json'
}

export class CartolaImportError extends Error {}

/** Convierte un nodo XML en un objeto plano (tags repetidos → arreglos). */
function xmlNodeToJson(node: Element): unknown {
  const children = Array.from(node.children)

  if (children.length === 0) {
    return (node.textContent ?? '').trim()
  }

  const out: Record<string, unknown> = {}

  for (const child of children) {
    const key = child.tagName
    const value = xmlNodeToJson(child)
    if (key in out) {
      const existing = out[key]
      if (Array.isArray(existing)) existing.push(value)
      else out[key] = [existing, value]
    } else {
      out[key] = value
    }
  }

  return out
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v)
}

/**
 * Busca en profundidad el objeto que contiene los movimientos. Tolera
 * envoltorios distintos (`{ cartola: ... }`, `{ data: ... }`, respuesta
 * completa del job, XML con raíz arbitraria, etc.).
 */
function findCartolaNode(value: unknown, depth = 0): Record<string, unknown> | null {
  if (depth > 8) return null

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findCartolaNode(item, depth + 1)
      if (found) return found
    }
    return null
  }

  if (!isRecord(value)) return null

  // Un nodo válido es aquel que declara movimientos.
  if ('movimientos' in value || 'movimiento' in value) {
    if ('movimientos' in value) return value
    // Nodo `{ movimiento: [...] }`: lo envolvemos para normalizar.
    return { movimientos: value }
  }

  for (const child of Object.values(value)) {
    const found = findCartolaNode(child, depth + 1)
    if (found) return found
  }

  return null
}

function normalizeMovimientos(cartola: Record<string, unknown>): CartolaMovimiento[] {
  const movimientos = cartola.movimientos
  let raw: unknown = movimientos

  if (isRecord(movimientos)) raw = movimientos.movimiento
  if (raw === undefined || raw === null) return []

  const list = Array.isArray(raw) ? raw : [raw]
  return list.filter(isRecord) as CartolaMovimiento[]
}

function buildResult(node: Record<string, unknown>, source: 'xml' | 'json'): CartolaImportResult {
  const movimientos = normalizeMovimientos(node)

  if (movimientos.length === 0) {
    throw new CartolaImportError(
      'El archivo se leyó correctamente, pero no contiene movimientos.',
    )
  }

  const cartola: CartolaData = {
    ...node,
    movimientos: { movimiento: movimientos },
  }

  return { cartola, movimientos, source }
}

/** Detecta si el contenido es XML o JSON y lo transforma a `CartolaData`. */
export function parseCartolaContent(rawContent: string): CartolaImportResult {
  const content = rawContent.trim()

  if (!content) {
    throw new CartolaImportError('El contenido está vacío.')
  }

  const looksLikeXml = content.startsWith('<')

  if (looksLikeXml) {
    const doc = new DOMParser().parseFromString(content, 'application/xml')
    const parseError = doc.querySelector('parsererror')
    if (parseError || !doc.documentElement) {
      throw new CartolaImportError(
        'El XML no se pudo leer. Verifica que el archivo esté completo y sin modificaciones.',
      )
    }

    const json = xmlNodeToJson(doc.documentElement)
    const wrapped = isRecord(json) ? { [doc.documentElement.tagName]: json } : json
    const node = findCartolaNode(wrapped)

    if (!node) {
      throw new CartolaImportError(
        'No se encontraron movimientos en el XML de la cartola.',
      )
    }

    return buildResult(node, 'xml')
  }

  let json: unknown
  try {
    json = JSON.parse(content)
  } catch {
    throw new CartolaImportError(
      'El contenido no es un XML ni un JSON válido. Revísalo e intenta nuevamente.',
    )
  }

  const node = findCartolaNode(json)
  if (!node) {
    throw new CartolaImportError('No se encontraron movimientos en el JSON entregado.')
  }

  return buildResult(node, 'json')
}

/** Lee un archivo (.xml/.json/.txt) y lo transforma a `CartolaData`. */
export async function parseCartolaFile(file: File): Promise<CartolaImportResult> {
  const text = await file.text()
  return parseCartolaContent(text)
}
