import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { NominaRowInput, ValidationError, DEFAULT_NOMINA_CATALOGS } from '../logic/nomina_logic_complete'
import { cn } from '@/lib/utils'

interface Props {
  rows: NominaRowInput[]
  errors: ValidationError[]
  selectedIndex: number | null
  onSelect: (index: number | null) => void
  onUpdate: (index: number, partial: Partial<NominaRowInput>) => void
}

const catalogs = DEFAULT_NOMINA_CATALOGS

export function NominaTable({ rows, errors, selectedIndex, onSelect, onUpdate }: Props) {
  const rowErrorsByIndex = new Map<number, ValidationError[]>()
  errors.filter(e => e.scope === 'row' && e.rowIndex !== undefined).forEach(e => {
    const arr = rowErrorsByIndex.get(e.rowIndex!) || []
    arr.push(e)
    rowErrorsByIndex.set(e.rowIndex!, arr)
  })

  const fieldHasError = (rowIdx: number, field: string) =>
    rowErrorsByIndex.get(rowIdx)?.some(e => e.field === field)

  if (rows.length === 0) {
    return (
      <div className="border rounded-lg p-12 text-center text-muted-foreground">
        <p className="text-lg font-medium mb-1">Sin filas</p>
        <p className="text-sm">Agrega filas manualmente, importa un CSV o carga el ejemplo.</p>
      </div>
    )
  }

  return (
    <div className="rounded-md border overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">#</TableHead>
            <TableHead className="min-w-[120px]">RUT Prov.</TableHead>
            <TableHead className="min-w-[160px]">Nombre Prov.</TableHead>
            <TableHead className="min-w-[140px]">Email</TableHead>
            <TableHead className="min-w-[160px]">Banco</TableHead>
            <TableHead className="min-w-[120px]">Cuenta</TableHead>
            <TableHead className="min-w-[160px]">Forma Pago</TableHead>
            <TableHead className="min-w-[130px]">Tipo Doc.</TableHead>
            <TableHead className="min-w-[100px]">Nº Doc.</TableHead>
            <TableHead className="min-w-[100px]">Monto</TableHead>
            <TableHead className="min-w-[80px]">Suc.</TableHead>
            <TableHead className="min-w-[140px]">Glosa</TableHead>
            <TableHead className="w-10"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, idx) => {
            const hasErr = rowErrorsByIndex.has(idx)
            return (
              <TableRow
                key={idx}
                className={cn(
                  selectedIndex === idx && 'bg-primary/5',
                  hasErr && 'bg-destructive/5',
                  'cursor-pointer'
                )}
                onClick={() => onSelect(selectedIndex === idx ? null : idx)}
              >
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {idx + 1}
                  {hasErr && <Badge variant="destructive" className="ml-1 text-[9px] px-1 py-0">!</Badge>}
                </TableCell>
                <TableCell>
                  <Input className={cn('h-8 text-xs', fieldHasError(idx, 'rutProveedor') && 'border-destructive')} value={row.rutProveedor} onChange={e => onUpdate(idx, { rutProveedor: e.target.value })} onClick={e => e.stopPropagation()} />
                </TableCell>
                <TableCell>
                  <Input className={cn('h-8 text-xs', fieldHasError(idx, 'nombreProveedor') && 'border-destructive')} value={row.nombreProveedor} onChange={e => onUpdate(idx, { nombreProveedor: e.target.value })} onClick={e => e.stopPropagation()} />
                </TableCell>
                <TableCell>
                  <Input className="h-8 text-xs" value={row.emailAviso || ''} onChange={e => onUpdate(idx, { emailAviso: e.target.value })} onClick={e => e.stopPropagation()} />
                </TableCell>
                <TableCell>
                  <Select value={row.bancoProveedor} onValueChange={v => onUpdate(idx, { bancoProveedor: v })}>
                    <SelectTrigger className={cn('h-8 text-xs', fieldHasError(idx, 'bancoProveedor') && 'border-destructive')} onClick={e => e.stopPropagation()}>
                      <SelectValue placeholder="Banco" />
                    </SelectTrigger>
                    <SelectContent>
                      {catalogs.bancos.map(b => <SelectItem key={b.sbifCode} value={b.name}>{b.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <Input className={cn('h-8 text-xs', fieldHasError(idx, 'cuentaProveedor') && 'border-destructive')} value={row.cuentaProveedor} onChange={e => onUpdate(idx, { cuentaProveedor: e.target.value })} onClick={e => e.stopPropagation()} />
                </TableCell>
                <TableCell>
                  <Select value={row.formaPago} onValueChange={v => onUpdate(idx, { formaPago: v })}>
                    <SelectTrigger className={cn('h-8 text-xs', fieldHasError(idx, 'formaPago') && 'border-destructive')} onClick={e => e.stopPropagation()}>
                      <SelectValue placeholder="Forma pago" />
                    </SelectTrigger>
                    <SelectContent>
                      {catalogs.formasPago.map(f => <SelectItem key={f.code} value={f.name}>{f.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <Select value={row.tipoDocumento} onValueChange={v => onUpdate(idx, { tipoDocumento: v })}>
                    <SelectTrigger className={cn('h-8 text-xs', fieldHasError(idx, 'tipoDocumento') && 'border-destructive')} onClick={e => e.stopPropagation()}>
                      <SelectValue placeholder="Tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      {catalogs.tiposDocumento.map(t => <SelectItem key={t.code} value={t.name}>{t.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <Input className={cn('h-8 text-xs', fieldHasError(idx, 'numeroDocumento') && 'border-destructive')} value={row.numeroDocumento} onChange={e => onUpdate(idx, { numeroDocumento: e.target.value })} onClick={e => e.stopPropagation()} />
                </TableCell>
                <TableCell>
                  <Input className={cn('h-8 text-xs', fieldHasError(idx, 'monto') && 'border-destructive')} type="number" value={row.monto} onChange={e => onUpdate(idx, { monto: Number(e.target.value) })} onClick={e => e.stopPropagation()} />
                </TableCell>
                <TableCell>
                  <Input className="h-8 text-xs" value={row.codigoSucursal || ''} onChange={e => onUpdate(idx, { codigoSucursal: e.target.value })} onClick={e => e.stopPropagation()} />
                </TableCell>
                <TableCell>
                  <Input className="h-8 text-xs" value={row.mensajeAviso || ''} onChange={e => onUpdate(idx, { mensajeAviso: e.target.value })} onClick={e => e.stopPropagation()} />
                </TableCell>
                <TableCell />
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
