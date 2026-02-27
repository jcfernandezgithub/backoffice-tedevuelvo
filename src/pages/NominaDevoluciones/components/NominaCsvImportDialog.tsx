import { useState, useRef } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { NominaRowInput } from '../logic/nomina_logic_complete'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { FileUp, AlertTriangle } from 'lucide-react'

const CSV_HEADERS = [
  'rutProveedor', 'nombreProveedor', 'emailAviso', 'bancoProveedor',
  'cuentaProveedor', 'formaPago', 'tipoDocumento', 'numeroDocumento',
  'monto', 'codigoSucursal', 'mensajeAviso',
]

interface Props {
  open: boolean
  onClose: () => void
  onImport: (rows: NominaRowInput[]) => void
}

function parseCsv(text: string): { rows: NominaRowInput[]; errors: string[] } {
  const errors: string[] = []
  const lines = text.split(/\r?\n/).filter(l => l.trim())
  if (lines.length < 2) {
    errors.push('El CSV debe tener al menos un encabezado y una fila de datos.')
    return { rows: [], errors }
  }

  // Detect delimiter
  const delim = lines[0].includes(';') ? ';' : ','
  const headerLine = lines[0].split(delim).map(h => h.trim().replace(/^["']|["']$/g, ''))

  // Map headers to indices
  const headerMap = new Map<string, number>()
  headerLine.forEach((h, i) => headerMap.set(h.toLowerCase(), i))

  const missing = CSV_HEADERS.filter(h => !headerMap.has(h.toLowerCase()))
  if (missing.length > 0) {
    errors.push(`Columnas faltantes: ${missing.join(', ')}`)
  }

  const rows: NominaRowInput[] = []
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(delim).map(c => c.trim().replace(/^["']|["']$/g, ''))
    if (cols.every(c => !c)) continue // skip empty rows

    const get = (key: string) => {
      const idx = headerMap.get(key.toLowerCase())
      return idx !== undefined ? cols[idx] || '' : ''
    }

    const montoRaw = get('monto').replace(/[$.]/g, '').replace(',', '.')
    const monto = Number(montoRaw)
    if (isNaN(monto)) {
      errors.push(`Fila ${i}: monto inválido "${get('monto')}"`)
    }

    rows.push({
      rutProveedor: get('rutProveedor'),
      nombreProveedor: get('nombreProveedor'),
      bancoProveedor: get('bancoProveedor'),
      cuentaProveedor: get('cuentaProveedor'),
      tipoDocumento: get('tipoDocumento'),
      numeroDocumento: get('numeroDocumento'),
      monto: isNaN(monto) ? 0 : monto,
      formaPago: get('formaPago'),
      codigoSucursal: get('codigoSucursal') || '000',
      emailAviso: get('emailAviso'),
      mensajeAviso: get('mensajeAviso'),
    })
  }

  return { rows, errors }
}

export function NominaCsvImportDialog({ open, onClose, onImport }: Props) {
  const [preview, setPreview] = useState<NominaRowInput[]>([])
  const [parseErrors, setParseErrors] = useState<string[]>([])
  const fileRef = useRef<HTMLInputElement>(null)

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      const { rows, errors } = parseCsv(text)
      setPreview(rows)
      setParseErrors(errors)
    }
    reader.readAsText(file, 'UTF-8')
  }

  const handleImport = () => {
    onImport(preview)
    setPreview([])
    setParseErrors([])
    onClose()
  }

  const handleClose = () => {
    setPreview([])
    setParseErrors([])
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && handleClose()}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><FileUp className="h-5 w-5" /> Importar CSV</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <input ref={fileRef} type="file" accept=".csv,.txt" onChange={handleFile} className="block w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 cursor-pointer" />

          {parseErrors.length > 0 && (
            <Alert className="border-amber-300 bg-amber-50">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <AlertDescription>
                <ul className="list-disc ml-4 text-sm text-amber-800">
                  {parseErrors.map((e, i) => <li key={i}>{e}</li>)}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {preview.length > 0 && (
            <>
              <p className="text-sm text-muted-foreground">{preview.length} fila(s) encontrada(s). Revisa la preview antes de importar.</p>
              <div className="rounded-md border overflow-x-auto max-h-60">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>RUT</TableHead>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Banco</TableHead>
                      <TableHead>Monto</TableHead>
                      <TableHead>Tipo Doc.</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.slice(0, 20).map((r, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-xs">{i + 1}</TableCell>
                        <TableCell className="text-xs">{r.rutProveedor}</TableCell>
                        <TableCell className="text-xs">{r.nombreProveedor}</TableCell>
                        <TableCell className="text-xs">{r.bancoProveedor}</TableCell>
                        <TableCell className="text-xs">{r.monto}</TableCell>
                        <TableCell className="text-xs">{r.tipoDocumento}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {preview.length > 20 && <p className="text-xs text-muted-foreground">Mostrando 20 de {preview.length} filas.</p>}
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={handleClose}>Cancelar</Button>
          <Button onClick={handleImport} disabled={preview.length === 0}>Importar {preview.length} fila(s)</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
