import { authenticatedFetch } from '@/services/apiClient'

export interface CartolaMovimiento {
  fecha?: string
  descripcion?: string
  cargo?: string | number | null
  abono?: string | number | null
  saldo_diario?: string | number | null
  [key: string]: unknown
}

export interface CartolaData {
  empresa_nombre?: string
  cuenta_numero?: string
  moneda?: string
  fecha_desde?: string
  fecha_hasta?: string
  monto_disponible?: string | number
  movimientos?: {
    movimiento?: CartolaMovimiento[] | CartolaMovimiento
  }
  [key: string]: unknown
}

export interface CartolaResponse {
  ok: boolean
  filename?: string
  filePath?: string
  data: CartolaData
}

export async function downloadCartolaXml(): Promise<CartolaResponse> {
  const res = await authenticatedFetch('/bank/download-xml-cartola', {
    method: 'POST',
    body: JSON.stringify({}),
  })
  if (!res.ok) {
    let msg = `Error ${res.status}`
    try {
      const j = await res.json()
      msg = j?.message || j?.error || msg
    } catch {
      /* noop */
    }
    throw new Error(msg)
  }
  return (await res.json()) as CartolaResponse
}