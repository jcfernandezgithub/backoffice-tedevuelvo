import { useState } from 'react'
import { Check, ChevronsUpDown, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { institutionOptions, selectedInstitution } from '@/lib/institutionSelection'
import type { Institution } from '@/services/institutionsService'

interface Props {
  value?: string
  onChange: (value: string) => void
  institutions: Institution[]
  loading: boolean
  error: boolean
  onRetry: () => void
}

export function InstitutionSelect({ value, onChange, institutions, loading, error, onRetry }: Props) {
  const [open, setOpen] = useState(false)
  const options = institutionOptions(institutions)
  const selected = selectedInstitution(value, institutions)
  return (
    <div className="min-w-0 space-y-1">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" role="combobox" aria-label="Institución" aria-expanded={open}
            disabled={loading || error || options.length === 0} className="w-full justify-between font-normal min-w-0">
            <span className="truncate">{loading ? 'Cargando instituciones…' : selected?.label || value || 'Seleccionar institución'}</span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command>
            <CommandInput placeholder="Buscar institución…" />
            <CommandList>
              <CommandEmpty>No se encontraron instituciones.</CommandEmpty>
              <CommandGroup>
                {options.map(i => (
                  <CommandItem key={i.id} value={`${i.label} ${i.value}`} onSelect={() => { onChange(i.value); setOpen(false) }}>
                    <Check className={`mr-2 h-4 w-4 shrink-0 ${selected?.id === i.id ? 'opacity-100' : 'opacity-0'}`} />
                    {i.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {!loading && (error || options.length === 0) && (
        <div className="text-xs text-destructive">
          No se pudo cargar el catálogo de instituciones.
          <Button type="button" variant="ghost" size="sm" onClick={onRetry} className="h-7 gap-1"><RefreshCw className="h-3 w-3" />Reintentar</Button>
        </div>
      )}
      {!loading && !error && value && !selected && <p className="text-xs text-destructive">Institución actual fuera del catálogo: {value}</p>}
    </div>
  )
}