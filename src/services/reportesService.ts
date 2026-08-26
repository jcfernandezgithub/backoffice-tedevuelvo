import * as XLSX from 'xlsx'

const MAX_CELL_TEXT = 32000 // Excel limita a 32.767 caracteres por celda
const MAX_ROWS_PER_SHEET = 50_000 // Se divide en varias hojas para no reventar memoria

/** Convierte cualquier valor a algo que xlsx pueda escribir sin fallar. */
function sanitizeValue(value: unknown): string | number | boolean {
  if (value === null || value === undefined) return ''
  if (typeof value === 'number') return Number.isFinite(value) ? value : ''
  if (typeof value === 'boolean') return value
  if (typeof value === 'bigint') return Number(value)
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? '' : value.toISOString()
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value).slice(0, MAX_CELL_TEXT)
    } catch {
      return ''
    }
  }
  const text = String(value)
  return text.length > MAX_CELL_TEXT ? text.slice(0, MAX_CELL_TEXT) : text
}

/** Unión ordenada de todas las claves presentes en las filas. */
function collectHeaders<T extends Record<string, any>>(rows: T[]): string[] {
  const headers: string[] = []
  const seen = new Set<string>()
  rows.forEach((row) => {
    if (!row || typeof row !== 'object') return
    Object.keys(row).forEach((key) => {
      if (!seen.has(key)) {
        seen.add(key)
        headers.push(key)
      }
    })
  })
  return headers
}

function toAOA<T extends Record<string, any>>(rows: T[], headers: string[]): (string | number | boolean)[][] {
  const aoa: (string | number | boolean)[][] = [headers]
  rows.forEach((row) => {
    aoa.push(headers.map((h) => sanitizeValue(row?.[h])))
  })
  return aoa
}

function triggerDownload(blob: Blob, finalName: string) {
  const url = URL.createObjectURL(blob)

  // Detect sandboxed preview iframe (downloads blocked silently when
  // the iframe lacks `allow-downloads`). In that case, open the blob in
  // a new top-level tab so the browser triggers the download there.
  const inIframe = (() => {
    try { return window.self !== window.top } catch { return true }
  })()

  if (inIframe) {
    const win = window.open(url, '_blank')
    if (!win) {
      // Popup blocked → fallback to anchor with target=_top
      const a = document.createElement('a')
      a.href = url
      a.download = finalName
      a.target = '_top'
      a.rel = 'noopener'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    }
  } else {
    const a = document.createElement('a')
    a.href = url
    a.download = finalName
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }
  setTimeout(() => URL.revokeObjectURL(url), 30_000)
}

export function exportCSV<T extends Record<string, any>>(rows: T[], filename: string) {
  const csv = toCSV(rows)
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  triggerDownload(blob, filename.endsWith('.csv') ? filename : `${filename}.csv`)
}

export function exportXLSX<T extends Record<string, any>>(rows: T[], filename: string) {
  const finalName = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`
  const safeRows = (rows || []).filter((r) => r && typeof r === 'object')
  const headers = collectHeaders(safeRows)

  try {
    const wb = XLSX.utils.book_new()

    // Dividir en hojas: evita fallas de asignación de memoria (RangeError:
    // Invalid array length) cuando el dataset es grande.
    const chunks = Math.max(1, Math.ceil(safeRows.length / MAX_ROWS_PER_SHEET))
    for (let i = 0; i < chunks; i++) {
      const slice = safeRows.slice(i * MAX_ROWS_PER_SHEET, (i + 1) * MAX_ROWS_PER_SHEET)
      const ws = XLSX.utils.aoa_to_sheet(toAOA(slice, headers))
      XLSX.utils.book_append_sheet(wb, ws, chunks === 1 ? 'Datos' : `Datos ${i + 1}`)
    }

    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
    const blob = new Blob([wbout], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
    triggerDownload(blob, finalName)
  } catch (error) {
    // Último recurso: si xlsx no puede generar el binario (memoria/límites del
    // navegador), entregamos un CSV con la misma información en lugar de perder
    // toda la exportación.
    console.error('[exportXLSX] Falló la generación del .xlsx, se exporta CSV:', error, {
      rows: safeRows.length,
      columns: headers.length,
    })
    exportCSV(
      safeRows.map((row) => {
        const clean: Record<string, string | number | boolean> = {}
        headers.forEach((h) => { clean[h] = sanitizeValue(row?.[h]) })
        return clean
      }),
      finalName.replace(/\.xlsx$/, ''),
    )
    throw new Error('XLSX_FALLBACK_CSV')
  }
}

function toCSV<T extends Record<string, any>>(rows: T[]) {
  if (rows.length === 0) return ''
  const headers = collectHeaders(rows)
  const lines = [headers.map((h) => JSON.stringify(h)).join(',')]
  rows.forEach((r) => {
    lines.push(headers.map((h) => JSON.stringify(sanitizeValue(r?.[h]) ?? '')).join(','))
  })
  return lines.join('\n')
}
