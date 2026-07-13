import { Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import type { UserFiltersV2 } from '../types/userTypesV2'
import { useRoles } from '@/pages/Ajustes/hooks/useRoles'

interface Props {
  filters: UserFiltersV2
  onChange: (f: UserFiltersV2) => void
  resultCount: number
  total: number
}

export const DEFAULT_FILTERS: UserFiltersV2 = {
  search: '',
  role: 'ALL',
  state: 'ALL',
  backofficeOnly: false,
}

export function UsersFilters({ filters, onChange, resultCount, total }: Props) {
  const { roles } = useRoles({ includeCustomer: true })
  const hasActive =
    filters.search !== '' ||
    filters.role !== 'ALL' ||
    filters.state !== 'ALL' ||
    filters.backofficeOnly

  const roleSelected = filters.role !== 'ALL'

  return (
    <div className="space-y-3">
      <div className="flex flex-col md:flex-row md:items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={filters.search}
            onChange={(e) => onChange({ ...filters, search: e.target.value })}
            placeholder="Buscar por nombre o correo…"
            className="pl-9"
            aria-label="Buscar usuarios"
          />
        </div>
        <Select value={filters.role} onValueChange={(v) => onChange({ ...filters, role: v })}>
          <SelectTrigger className="md:w-52" aria-label="Filtrar por rol">
            <SelectValue placeholder="Rol" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos los roles</SelectItem>
            {roles.map((r) => (
              <SelectItem key={r.id} value={r.id}>{r.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filters.state} onValueChange={(v) => onChange({ ...filters, state: v as UserFiltersV2['state'] })}>
          <SelectTrigger className="md:w-56" aria-label="Filtrar por estado">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos los estados</SelectItem>
            <SelectItem value="ACTIVE">Activo</SelectItem>
            <SelectItem value="INACTIVE">Inactivo</SelectItem>
            <SelectItem value="PENDING">Invitación pendiente</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          onClick={() => onChange(DEFAULT_FILTERS)}
          disabled={!hasActive}
        >
          <X className="h-4 w-4 mr-2" />
          Limpiar
        </Button>
      </div>
      <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Mostrando <span className="font-medium text-foreground">{resultCount}</span>
          {total > 0 ? <> de {total} usuarios</> : <> usuarios en esta página</>}
        </p>
        <div className="flex items-center gap-2">
          <Checkbox
            id="backoffice-only"
            checked={filters.backofficeOnly}
            disabled={roleSelected}
            onCheckedChange={(v) => onChange({ ...filters, backofficeOnly: v === true })}
          />
          <Label
            htmlFor="backoffice-only"
            className={`text-xs cursor-pointer select-none ${roleSelected ? 'text-muted-foreground/60' : 'text-muted-foreground'}`}
            title={roleSelected ? 'Desactiva el filtro por rol para usar esta opción' : undefined}
          >
            Solo Usuarios BackOffice
          </Label>
        </div>
      </div>
    </div>
  )
}