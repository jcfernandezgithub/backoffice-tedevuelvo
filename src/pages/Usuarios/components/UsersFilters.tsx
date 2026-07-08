import { Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { UserFiltersV2 } from '../types/userTypesV2'

interface Props {
  filters: UserFiltersV2
  onChange: (f: UserFiltersV2) => void
  resultCount: number
  total: number
}

export const DEFAULT_FILTERS: UserFiltersV2 = { search: '', role: 'ALL', state: 'ALL' }

export function UsersFilters({ filters, onChange, resultCount, total }: Props) {
  const hasActive = filters.search !== '' || filters.role !== 'ALL' || filters.state !== 'ALL'

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
        <Select value={filters.role} onValueChange={(v) => onChange({ ...filters, role: v as UserFiltersV2['role'] })}>
          <SelectTrigger className="md:w-52" aria-label="Filtrar por rol">
            <SelectValue placeholder="Rol" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos los roles</SelectItem>
            <SelectItem value="ADMIN">Administrador</SelectItem>
            <SelectItem value="CALLCENTER">Call Center</SelectItem>
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
      <p className="text-xs text-muted-foreground">
        Mostrando <span className="font-medium text-foreground">{resultCount}</span> de {total} usuarios
      </p>
    </div>
  )
}