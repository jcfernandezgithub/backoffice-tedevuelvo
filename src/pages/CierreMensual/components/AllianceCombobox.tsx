import { useState } from 'react'
import { Check, ChevronsUpDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'

interface AllianceComboboxProps {
  value: string
  onChange: (value: string) => void
  partners: Array<{ id: string; nombre: string }>
}

export function AllianceCombobox({ value, onChange, partners }: AllianceComboboxProps) {
  const [open, setOpen] = useState(false)

  const selectedLabel = value === 'all'
    ? 'Todas las alianzas'
    : partners.find(p => p.id === value)?.nombre || 'Alianza'

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal h-10"
        >
          <span className="truncate">{selectedLabel}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0 z-50 bg-popover" align="start">
        <Command>
          <CommandInput placeholder="Buscar alianza..." />
          <CommandList>
            <CommandEmpty>No se encontró alianza.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="all"
                keywords={['todas', 'all']}
                onSelect={() => {
                  onChange('all')
                  setOpen(false)
                }}
              >
                <Check className={cn('mr-2 h-4 w-4', value === 'all' ? 'opacity-100' : 'opacity-0')} />
                Todas las alianzas
              </CommandItem>
              {partners.map(p => (
                <CommandItem
                  key={p.id}
                  value={p.id}
                  keywords={[p.nombre]}
                  onSelect={() => {
                    onChange(p.id)
                    setOpen(false)
                  }}
                >
                  <Check className={cn('mr-2 h-4 w-4', value === p.id ? 'opacity-100' : 'opacity-0')} />
                  {p.nombre}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
