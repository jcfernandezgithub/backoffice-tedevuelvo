import { Button } from '@/components/ui/button'
import { Plus, Copy, Trash2, CheckCircle, FileDown, FileUp, Download, Eraser, PlayCircle, Group, UserCheck } from 'lucide-react'

interface Props {
  hasSelection: boolean
  selectedIndex: number | null
  onAdd: () => void
  onAddFromRefunds: () => void
  onDuplicate: () => void
  onRemove: () => void
  onValidate: () => void
  onGenerateNormal: () => void
  onGenerateGrouped: () => void
  onImportCsv: () => void
  onDownloadTemplate: () => void
  onLoadExample: () => void
  onClear: () => void
  rowCount: number
}

export function NominaToolbar({
  hasSelection, onAdd, onAddFromRefunds, onDuplicate, onRemove,
  onValidate, onGenerateNormal, onGenerateGrouped,
  onImportCsv, onDownloadTemplate, onLoadExample, onClear, rowCount,
}: Props) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button size="sm" variant="default" onClick={onAddFromRefunds}><UserCheck className="mr-1 h-4 w-4" /> Agregar desde solicitudes</Button>
      <Button size="sm" variant="outline" onClick={onAdd}><Plus className="mr-1 h-4 w-4" /> Fila manual</Button>
      <Button size="sm" variant="outline" onClick={onDuplicate} disabled={!hasSelection}><Copy className="mr-1 h-4 w-4" /> Duplicar</Button>
      <Button size="sm" variant="destructive" onClick={onRemove} disabled={!hasSelection}><Trash2 className="mr-1 h-4 w-4" /> Eliminar</Button>

      <div className="w-px bg-border mx-1 hidden sm:block" />

      <Button size="sm" variant="outline" onClick={onValidate} disabled={rowCount === 0}><CheckCircle className="mr-1 h-4 w-4" /> Validar</Button>
      <Button size="sm" onClick={onGenerateNormal} disabled={rowCount === 0}><FileDown className="mr-1 h-4 w-4" /> TXT Normal</Button>
      <Button size="sm" variant="secondary" onClick={onGenerateGrouped} disabled={rowCount === 0}><Group className="mr-1 h-4 w-4" /> TXT Agrupado</Button>

      <div className="w-px bg-border mx-1 hidden sm:block" />

      <Button size="sm" variant="outline" onClick={onImportCsv}><FileUp className="mr-1 h-4 w-4" /> Importar CSV</Button>
      <Button size="sm" variant="ghost" onClick={onDownloadTemplate}><Download className="mr-1 h-4 w-4" /> Plantilla CSV</Button>
      <Button size="sm" variant="ghost" onClick={onLoadExample}><PlayCircle className="mr-1 h-4 w-4" /> Cargar ejemplo</Button>
      <Button size="sm" variant="ghost" onClick={onClear}><Eraser className="mr-1 h-4 w-4" /> Limpiar</Button>
    </div>
  )
}
