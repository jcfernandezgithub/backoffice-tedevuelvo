import * as XLSX from 'xlsx'

export function exportCSV<T extends Record<string, any>>(rows: T[], filename: string) {
  const csv = toCSV(rows)
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export function exportXLSX<T extends Record<string, any>>(rows: T[], filename: string) {
  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Datos')
  const finalName = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`
  // Use blob + anchor download (more reliable than XLSX.writeFile inside iframes / sandboxed previews)
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  const blob = new Blob([wbout], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = finalName
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function toCSV<T extends Record<string, any>>(rows: T[]) {
  if (rows.length === 0) return ''
  const headers = Object.keys(rows[0])
  const lines = [headers.join(',')]
  rows.forEach((r) => {
    lines.push(headers.map((h) => JSON.stringify(r[h] ?? '')).join(','))
  })
  return lines.join('\n')
}
