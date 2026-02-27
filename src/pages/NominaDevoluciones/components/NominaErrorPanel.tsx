import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ValidationError } from '../logic/nomina_logic_complete'
import { AlertTriangle } from 'lucide-react'

interface Props {
  errors: ValidationError[]
  onFocusRow?: (index: number) => void
}

export function NominaErrorPanel({ errors, onFocusRow }: Props) {
  if (errors.length === 0) return null

  const headerErrors = errors.filter(e => e.scope === 'header')
  const systemErrors = errors.filter(e => e.scope === 'system')
  const rowErrors = errors.filter(e => e.scope === 'row')

  // Group row errors by rowIndex
  const rowGroups = new Map<number, ValidationError[]>()
  rowErrors.forEach(e => {
    const idx = e.rowIndex ?? -1
    const arr = rowGroups.get(idx) || []
    arr.push(e)
    rowGroups.set(idx, arr)
  })

  return (
    <Card className="border-destructive/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2 text-destructive">
          <AlertTriangle className="h-4 w-4" />
          {errors.length} error{errors.length !== 1 ? 'es' : ''} encontrado{errors.length !== 1 ? 's' : ''}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 max-h-64 overflow-y-auto">
        {systemErrors.map((e, i) => (
          <div key={`sys-${i}`} className="text-sm">
            <Badge variant="outline" className="mr-2">Sistema</Badge>
            {e.message}
          </div>
        ))}
        {headerErrors.map((e, i) => (
          <div key={`hdr-${i}`} className="text-sm">
            <Badge variant="outline" className="mr-2">Encabezado</Badge>
            <span className="font-medium">{e.field}:</span> {e.message}
          </div>
        ))}
        {Array.from(rowGroups.entries()).map(([rowIdx, errs]) => (
          <div key={`row-${rowIdx}`} className="text-sm">
            <button
              type="button"
              className="text-primary underline-offset-2 hover:underline font-medium"
              onClick={() => onFocusRow?.(rowIdx)}
            >
              Fila {rowIdx + 1}
            </button>
            <ul className="ml-4 mt-1 space-y-0.5 list-disc text-muted-foreground">
              {errs.map((e, i) => (
                <li key={i}><span className="font-medium text-foreground">{e.field}:</span> {e.message}</li>
              ))}
            </ul>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
