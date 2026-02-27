import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NominaHeaderInput } from '../logic/nomina_logic_complete'

interface Props {
  header: NominaHeaderInput
  onChange: (partial: Partial<NominaHeaderInput>) => void
}

export function NominaHeaderForm({ header, onChange }: Props) {
  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-lg">Datos del encabezado</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="nombreEmpresa">Nombre empresa</Label>
            <Input id="nombreEmpresa" value={header.nombreEmpresa} onChange={e => onChange({ nombreEmpresa: e.target.value })} placeholder="TDV SERVICIOS SPA" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rutEmpresa">RUT empresa</Label>
            <Input id="rutEmpresa" value={header.rutEmpresa} onChange={e => onChange({ rutEmpresa: e.target.value })} placeholder="78168126-1" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="convenio">Nº convenio</Label>
            <Input id="convenio" value={header.convenio} onChange={e => onChange({ convenio: e.target.value })} placeholder="123" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="fechaProceso">Fecha proceso</Label>
            <Input id="fechaProceso" type="date" value={header.fechaProceso || ''} onChange={e => onChange({ fechaProceso: e.target.value })} />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
