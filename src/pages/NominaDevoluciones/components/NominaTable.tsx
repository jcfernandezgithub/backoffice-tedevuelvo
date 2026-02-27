import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { NominaRowInput, ValidationError, DEFAULT_NOMINA_CATALOGS } from '../logic/nomina_logic_complete'
import { cn } from '@/lib/utils'
import { ChevronDown, ChevronUp, AlertTriangle, Copy, Trash2 } from 'lucide-react'
import { useState } from 'react'

interface Props {
  rows: NominaRowInput[]
  errors: ValidationError[]
  selectedIndex: number | null
  onSelect: (index: number | null) => void
  onUpdate: (index: number, partial: Partial<NominaRowInput>) => void
  onDuplicate?: (index: number) => void
  onRemove?: (index: number) => void
}

const catalogs = DEFAULT_NOMINA_CATALOGS

function Field({ label, error, children, className }: { label: string; error?: boolean; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('space-y-1', className)}>
      <label className={cn('text-[11px] font-medium uppercase tracking-wide', error ? 'text-destructive' : 'text-muted-foreground')}>
        {label}
      </label>
      {children}
    </div>
  )
}

export function NominaTable({ rows, errors, selectedIndex, onSelect, onUpdate, onDuplicate, onRemove }: Props) {
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set())

  const rowErrorsByIndex = new Map<number, ValidationError[]>()
  errors.filter(e => e.scope === 'row' && e.rowIndex !== undefined).forEach(e => {
    const arr = rowErrorsByIndex.get(e.rowIndex!) || []
    arr.push(e)
    rowErrorsByIndex.set(e.rowIndex!, arr)
  })

  const fieldHasError = (rowIdx: number, field: string) =>
    rowErrorsByIndex.get(rowIdx)?.some(e => e.field === field)

  const toggleExpand = (idx: number) => {
    setExpandedRows(prev => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx)
      else next.add(idx)
      return next
    })
  }

  if (rows.length === 0) {
    return (
      <div className="border rounded-lg p-12 text-center text-muted-foreground">
        <p className="text-lg font-medium mb-1">Sin filas</p>
        <p className="text-sm">Agrega filas manualmente, importa un CSV o carga el ejemplo.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {rows.map((row, idx) => {
        const hasErr = rowErrorsByIndex.has(idx)
        const isExpanded = expandedRows.has(idx)
        const isSelected = selectedIndex === idx
        const rowErrors = rowErrorsByIndex.get(idx) || []

        return (
          <Card
            key={idx}
            data-row-index={idx}
            className={cn(
              'overflow-hidden transition-all',
              isSelected && 'ring-2 ring-primary/40',
              hasErr && 'border-destructive/40 bg-destructive/[0.02]',
            )}
          >
            {/* Header row — always visible: #, name, rut, amount, actions */}
            <div
              className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/40 transition-colors"
              onClick={() => {
                onSelect(isSelected ? null : idx)
                if (!isExpanded) toggleExpand(idx)
              }}
            >
              <span className="font-mono text-xs text-muted-foreground w-6 shrink-0 text-center">
                {idx + 1}
              </span>

              {hasErr && (
                <Badge variant="destructive" className="text-[10px] px-1.5 py-0 shrink-0">
                  <AlertTriangle className="h-3 w-3 mr-0.5" />
                  {rowErrors.length}
                </Badge>
              )}

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm truncate">
                    {row.nombreProveedor || <span className="text-muted-foreground italic">Sin nombre</span>}
                  </span>
                  <span className="text-xs text-muted-foreground shrink-0">{row.rutProveedor}</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                  <span>{row.bancoProveedor || 'Sin banco'}</span>
                  <span>•</span>
                  <span>{row.cuentaProveedor || 'Sin cuenta'}</span>
                </div>
              </div>

              <span className="text-base font-semibold tabular-nums whitespace-nowrap">
                ${row.monto.toLocaleString('es-CL')}
              </span>

              <div className="flex items-center gap-1 shrink-0">
                {onDuplicate && (
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={e => { e.stopPropagation(); onDuplicate(idx) }}>
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                )}
                {onRemove && (
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={e => { e.stopPropagation(); onRemove(idx) }}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={e => { e.stopPropagation(); toggleExpand(idx) }}>
                  {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            {/* Expanded detail — full editable fields */}
            {isExpanded && (
              <div className="px-4 pb-4 pt-1 border-t bg-muted/20">
                {/* Row 1: Identity */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
                  <Field label="RUT Cliente" error={fieldHasError(idx, 'rutProveedor')}>
                    <Input className="h-8 text-sm" value={row.rutProveedor} onChange={e => onUpdate(idx, { rutProveedor: e.target.value })} />
                  </Field>
                  <Field label="Nombre Cliente" error={fieldHasError(idx, 'nombreProveedor')} className="sm:col-span-1 lg:col-span-2">
                    <Input className="h-8 text-sm" value={row.nombreProveedor} onChange={e => onUpdate(idx, { nombreProveedor: e.target.value })} />
                  </Field>
                  <Field label="Email">
                    <Input className="h-8 text-sm" value={row.emailAviso || ''} onChange={e => onUpdate(idx, { emailAviso: e.target.value })} />
                  </Field>
                </div>

                {/* Row 2: Bank */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
                  <Field label="Banco" error={fieldHasError(idx, 'bancoProveedor')}>
                    <Select value={row.bancoProveedor} onValueChange={v => onUpdate(idx, { bancoProveedor: v })}>
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue placeholder="Seleccionar banco" />
                      </SelectTrigger>
                      <SelectContent>
                        {catalogs.bancos.map(b => <SelectItem key={b.sbifCode} value={b.name}>{b.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Nº Cuenta" error={fieldHasError(idx, 'cuentaProveedor')}>
                    <Input className="h-8 text-sm" value={row.cuentaProveedor} onChange={e => onUpdate(idx, { cuentaProveedor: e.target.value })} />
                  </Field>
                  <Field label="Forma de Pago" error={fieldHasError(idx, 'formaPago')}>
                    <Select value={row.formaPago} onValueChange={v => onUpdate(idx, { formaPago: v })}>
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue placeholder="Forma pago" />
                      </SelectTrigger>
                      <SelectContent>
                        {catalogs.formasPago.map(f => <SelectItem key={f.code} value={f.name}>{f.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Monto ($)" error={fieldHasError(idx, 'monto')}>
                    <Input className="h-8 text-sm" type="number" value={row.monto} onChange={e => onUpdate(idx, { monto: Number(e.target.value) })} />
                  </Field>
                </div>

                {/* Row 3: Document & extras */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <Field label="Tipo Documento" error={fieldHasError(idx, 'tipoDocumento')}>
                    <Select value={row.tipoDocumento} onValueChange={v => onUpdate(idx, { tipoDocumento: v })}>
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue placeholder="Tipo" />
                      </SelectTrigger>
                      <SelectContent>
                        {catalogs.tiposDocumento.map(t => <SelectItem key={t.code} value={t.name}>{t.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Nº Documento" error={fieldHasError(idx, 'numeroDocumento')}>
                    <Input className="h-8 text-sm" value={row.numeroDocumento} onChange={e => onUpdate(idx, { numeroDocumento: e.target.value })} />
                  </Field>
                  <Field label="Cód. Sucursal">
                    <Input className="h-8 text-sm" value={row.codigoSucursal || ''} onChange={e => onUpdate(idx, { codigoSucursal: e.target.value })} />
                  </Field>
                  <Field label="Glosa / Mensaje">
                    <Input className="h-8 text-sm" value={row.mensajeAviso || ''} onChange={e => onUpdate(idx, { mensajeAviso: e.target.value })} />
                  </Field>
                </div>

                {/* Error messages for this row */}
                {rowErrors.length > 0 && (
                  <div className="mt-3 p-2 rounded bg-destructive/10 border border-destructive/20">
                    <ul className="text-xs text-destructive space-y-0.5">
                      {rowErrors.map((err, i) => (
                        <li key={i}>• <strong>{err.field}</strong>: {err.message}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </Card>
        )
      })}
    </div>
  )
}
