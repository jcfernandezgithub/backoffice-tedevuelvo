import { FormControl } from '@/components/ui/form'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { institutionOptions, selectedInstitution } from '@/lib/institutionSelection'
import type { Institution } from '@/services/institutionsService'

interface InstitutionSelectProps {
  value: string
  original: string
  onChange: (value: string) => void
  onBlur: () => void
  institutions: Institution[]
  available: boolean
  loading: boolean
}

export function InstitutionSelect({ value, original, onChange, onBlur, institutions, available, loading }: InstitutionSelectProps) {
  const options = institutionOptions(institutions)
  const legacy = original && !options.some(option => option.value === original)
  return (
    <Select value={value} onValueChange={onChange} disabled={!available || options.length === 0}>
      <FormControl>
        <SelectTrigger onBlur={onBlur} aria-label="Institución" className="min-w-0 [&>span]:truncate">
          <SelectValue placeholder={loading ? 'Cargando…' : available ? 'Seleccionar institución' : 'Catálogo no disponible'} />
        </SelectTrigger>
      </FormControl>
      <SelectContent>
        {legacy && <SelectItem value={original} disabled>{selectedInstitution(original, institutions)?.label || original} (actual)</SelectItem>}
        {options.map(option => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
      </SelectContent>
    </Select>
  )
}