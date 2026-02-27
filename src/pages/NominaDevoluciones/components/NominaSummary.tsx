import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Money } from '@/components/common/Money'
import { NominaRowInput, ValidationError } from '../logic/nomina_logic_complete'
import { FileText, AlertTriangle, CheckCircle2, Clock } from 'lucide-react'

interface Props {
  rows: NominaRowInput[]
  errors: ValidationError[]
  lastModified: string | null
}

export function NominaSummary({ rows, errors, lastModified }: Props) {
  const totalMonto = rows.reduce((acc, r) => acc + (Number(r.monto) || 0), 0)
  const rowErrors = errors.filter(e => e.scope === 'row')
  const invalidRowIndices = new Set(rowErrors.map(e => e.rowIndex))
  const validCount = rows.length - invalidRowIndices.size
  const invalidCount = invalidRowIndices.size

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <Card>
        <CardContent className="p-4 flex items-center gap-3">
          <FileText className="h-5 w-5 text-primary" />
          <div>
            <p className="text-xs text-muted-foreground">Total filas</p>
            <p className="text-xl font-bold">{rows.length}</p>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4 flex items-center gap-3">
          <CheckCircle2 className="h-5 w-5 text-emerald-600" />
          <div>
            <p className="text-xs text-muted-foreground">Válidas</p>
            <p className="text-xl font-bold text-emerald-600">{errors.length > 0 ? validCount : '—'}</p>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4 flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-destructive" />
          <div>
            <p className="text-xs text-muted-foreground">Con error</p>
            <p className="text-xl font-bold text-destructive">{errors.length > 0 ? invalidCount : '—'}</p>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4 flex items-center gap-3">
          <div>
            <p className="text-xs text-muted-foreground">Monto total</p>
            <p className="text-xl font-bold"><Money value={totalMonto} /></p>
          </div>
        </CardContent>
      </Card>
      {lastModified && (
        <div className="col-span-2 sm:col-span-4 flex items-center gap-2 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          Borrador guardado: {new Date(lastModified).toLocaleString('es-CL')}
        </div>
      )}
    </div>
  )
}
