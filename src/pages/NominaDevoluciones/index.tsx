import { useState, useCallback } from 'react'
import { useNomina } from './hooks/useNomina'
import { NominaDraftBanner } from './components/NominaDraftBanner'
import { NominaHeaderForm } from './components/NominaHeaderForm'
import { NominaSummary } from './components/NominaSummary'
import { NominaToolbar } from './components/NominaToolbar'
import { NominaTable } from './components/NominaTable'
import { NominaErrorPanel } from './components/NominaErrorPanel'
import { NominaCsvImportDialog } from './components/NominaCsvImportDialog'
import { AddFromRefundsDialog } from './components/AddFromRefundsDialog'
import { downloadTxtFile } from './logic/nomina_logic_complete'
import { toast } from 'sonner'


const CSV_TEMPLATE_HEADERS = [
  'rutProveedor', 'nombreProveedor', 'emailAviso', 'bancoProveedor',
  'cuentaProveedor', 'formaPago', 'tipoDocumento', 'numeroDocumento',
  'monto', 'codigoSucursal', 'mensajeAviso',
]

export default function NominaDevoluciones() {
  const nom = useNomina()
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [csvOpen, setCsvOpen] = useState(false)
  const [refundsOpen, setRefundsOpen] = useState(false)

  const handleValidate = useCallback(() => {
    const result = nom.validate()
    if (result.valid) toast.success('Nómina válida — sin errores')
    else toast.error(`${result.errors.length} error(es) encontrado(s)`)
  }, [nom])

  const handleGenerate = useCallback((grouped: boolean) => {
    const res = nom.generate(grouped)
    if (res) {
      toast.success(`Archivo ${res.fileName} descargado (${res.lineCount} líneas)`)
    }
  }, [nom])

  const handleDownloadTemplate = useCallback(() => {
    const content = CSV_TEMPLATE_HEADERS.join(',') + '\n'
    downloadTxtFile('plantilla_nomina.csv', content)
    toast.success('Plantilla CSV descargada')
  }, [])

  const handleFocusRow = useCallback((index: number) => {
    setSelectedIndex(index)
    // Scroll into view
    const el = document.querySelector(`[data-row-index="${index}"]`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [])

  return (
    <div className="p-4 md:p-6 max-w-[1400px] mx-auto">
      <div className="space-y-6 pb-12">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Nómina de devoluciones</h1>
          <p className="text-muted-foreground text-sm">Genera archivos TXT para Scotiabank desde datos manuales o CSV.</p>
        </div>

        {nom.draftFound && (
          <NominaDraftBanner onRestore={nom.restoreDraft} onDiscard={nom.discardDraft} />
        )}

        <NominaHeaderForm header={nom.header} onChange={nom.updateHeader} />

        <NominaSummary rows={nom.rows} errors={nom.errors} lastModified={nom.lastModified} />

        <NominaToolbar
          hasSelection={selectedIndex !== null}
          selectedIndex={selectedIndex}
          onAdd={nom.addRow}
          onAddFromRefunds={() => setRefundsOpen(true)}
          onDuplicate={() => selectedIndex !== null && nom.duplicateRow(selectedIndex)}
          onRemove={() => {
            if (selectedIndex !== null) {
              nom.removeRow(selectedIndex)
              setSelectedIndex(null)
            }
          }}
          onValidate={handleValidate}
          onGenerateNormal={() => handleGenerate(false)}
          onGenerateGrouped={() => handleGenerate(true)}
          onImportCsv={() => setCsvOpen(true)}
          onDownloadTemplate={handleDownloadTemplate}
          onLoadExample={nom.loadExample}
          onClear={nom.clearAll}
          rowCount={nom.rows.length}
        />

        <NominaTable
          rows={nom.rows}
          errors={nom.errors}
          selectedIndex={selectedIndex}
          onSelect={setSelectedIndex}
          onUpdate={nom.updateRow}
        />

        <NominaErrorPanel errors={nom.errors} onFocusRow={handleFocusRow} />

        {nom.lastExportResult && (
          <div className="text-sm text-muted-foreground border rounded-lg p-4 bg-muted/30">
            Última exportación: <strong>{nom.lastExportResult.fileName}</strong> — {nom.lastExportResult.lineCount} líneas — ${nom.lastExportResult.totalAmount.toLocaleString('es-CL')} — modo {nom.lastExportResult.mode}
          </div>
        )}

        <NominaCsvImportDialog open={csvOpen} onClose={() => setCsvOpen(false)} onImport={nom.importRows} />

        <AddFromRefundsDialog
          open={refundsOpen}
          onClose={() => setRefundsOpen(false)}
          onAdd={(rows) => {
            nom.importRows(rows)
            toast.success(`${rows.length} solicitud(es) agregada(s) a la nómina`)
          }}
          existingRuts={nom.rows.map(r => r.rutProveedor)}
        />
      </div>
    </div>
  )
}
