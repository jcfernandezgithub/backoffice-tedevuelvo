import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { ArchiveRestore, Trash2 } from 'lucide-react'

interface Props {
  onRestore: () => void
  onDiscard: () => void
}

export function NominaDraftBanner({ onRestore, onDiscard }: Props) {
  return (
    <Alert className="border-amber-300 bg-amber-50">
      <AlertDescription className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <span className="text-amber-800 font-medium">
          Se encontró un borrador guardado. ¿Deseas restaurarlo?
        </span>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={onRestore}>
            <ArchiveRestore className="mr-1 h-4 w-4" /> Restaurar
          </Button>
          <Button size="sm" variant="ghost" onClick={onDiscard}>
            <Trash2 className="mr-1 h-4 w-4" /> Descartar
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  )
}
