import { useMemo, useState } from 'react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

export type Column<T> = {
  key: keyof T
  header: string
  render?: (row: T) => React.ReactNode
  sortable?: boolean
}

interface Props<T> {
  data: T[]
  columns: Column<T>[]
  pageSize?: number
}

export function DataGrid<T extends Record<string, any>>({ data, columns, pageSize = 10 }: Props<T>) {
  const [page, setPage] = useState(1)
  const [sortKey, setSortKey] = useState<keyof T | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [q, setQ] = useState('')

  const filtered = useMemo(() => {
    if (!q) return data
    const lower = q.toLowerCase()
    return data.filter((row) => Object.values(row).some((v) => String(v).toLowerCase().includes(lower)))
  }, [data, q])

  const sorted = useMemo(() => {
    if (!sortKey) return filtered
    return [...filtered].sort((a, b) => {
      const av = a[sortKey]
      const bv = b[sortKey]
      if (av === bv) return 0
      const res = av > bv ? 1 : -1
      return sortDir === 'asc' ? res : -res
    })
  }, [filtered, sortKey, sortDir])

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize))
  const pageData = sorted.slice((page - 1) * pageSize, page * pageSize)

  const handleSort = (key: keyof T) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <Input placeholder="Buscar..." value={q} onChange={(e) => { setQ(e.target.value); setPage(1) }} />
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Página {page} de {totalPages}</span>
          <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))}>Anterior</Button>
          <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>Siguiente</Button>
        </div>
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((c) => (
                <TableHead key={String(c.key)} onClick={() => c.sortable && handleSort(c.key)} className={c.sortable ? 'cursor-pointer select-none' : ''}>
                  <div className="flex items-center gap-1">
                    {c.header}
                    {sortKey === c.key && (sortDir === 'asc' ? '▲' : '▼')}
                  </div>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageData.map((row, idx) => (
              <TableRow key={idx}>
                {columns.map((c) => (
                  <TableCell key={String(c.key)}>
                    {c.render ? c.render(row) : String(row[c.key])}
                  </TableCell>
                ))}
              </TableRow>
            ))}
            {pageData.length === 0 && (
              <TableRow>
                <TableCell colSpan={columns.length} className="text-center text-sm text-muted-foreground">Sin resultados</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
