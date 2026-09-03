import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardPaste,
  FileCode2,
  Loader2,
  Upload,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  CartolaImportError,
  parseCartolaContent,
  parseCartolaFile,
  type CartolaImportResult,
} from '../services/cartolaImportService'

interface CartolaImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onImported: (result: CartolaImportResult, fileName?: string) => void
}

/**
 * Carga manual de la cartola: el usuario sube el XML descargado del banco
 * o pega el JSON/XML tal cual lo entrega el servicio. El contenido se
 * transforma al mismo formato que consume la conciliación.
 */
export function CartolaImportDialog({ open, onOpenChange, onImported }: CartolaImportDialogProps) {
  const [tab, setTab] = useState<'file' | 'paste'>('file')
  const [file, setFile] = useState<File | null>(null)
  const [pasted, setPasted] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [parsing, setParsing] = useState(false)
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setTab('file')
      setFile(null)
      setPasted('')
      setError(null)
      setParsing(false)
      setDragging(false)
    }
  }, [open])

  const handleError = useCallback((e: unknown) => {
    setError(
      e instanceof CartolaImportError || e instanceof Error
        ? e.message
        : 'No se pudo procesar el contenido de la cartola.',
    )
  }, [])

  const pickFile = (selected: File | null | undefined) => {
    setError(null)
    setFile(selected ?? null)
  }

  const handleImport = async () => {
    setError(null)
    setParsing(true)
    try {
      const result =
        tab === 'file'
          ? await parseCartolaFile(file as File)
          : parseCartolaContent(pasted)
      onImported(result, tab === 'file' ? file?.name : undefined)
      onOpenChange(false)
    } catch (e) {
      handleError(e)
    } finally {
      setParsing(false)
    }
  }

  const canImport = tab === 'file' ? !!file : pasted.trim().length > 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileCode2 className="h-5 w-5 text-primary" />
            Cargar cartola
          </DialogTitle>
          <DialogDescription>
            Sube el archivo XML descargado desde el portal del banco o pega el contenido
            XML/JSON. Los movimientos quedarán disponibles para conciliar en esta sesión.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => { setTab(v as 'file' | 'paste'); setError(null) }}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="file" className="gap-1.5">
              <Upload className="h-4 w-4" /> Subir archivo
            </TabsTrigger>
            <TabsTrigger value="paste" className="gap-1.5">
              <ClipboardPaste className="h-4 w-4" /> Pegar contenido
            </TabsTrigger>
          </TabsList>

          <TabsContent value="file" className="mt-4">
            <div
              role="button"
              tabIndex={0}
              onClick={() => inputRef.current?.click()}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  inputRef.current?.click()
                }
              }}
              onDragOver={(e) => {
                e.preventDefault()
                setDragging(true)
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault()
                setDragging(false)
                pickFile(e.dataTransfer.files?.[0])
              }}
              className={cn(
                'flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-8 text-center transition-colors cursor-pointer',
                dragging ? 'border-primary bg-primary/5' : 'bg-muted/20 hover:bg-muted/40',
              )}
            >
              {file ? (
                <>
                  <CheckCircle2 className="h-8 w-8 text-emerald-600" />
                  <div className="space-y-0.5">
                    <div className="text-sm font-medium break-all">{file.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {(file.size / 1024).toFixed(0)} KB — listo para procesar
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation()
                      pickFile(null)
                      if (inputRef.current) inputRef.current.value = ''
                    }}
                  >
                    <X className="h-4 w-4 mr-1" /> Quitar
                  </Button>
                </>
              ) : (
                <>
                  <Upload className="h-8 w-8 text-muted-foreground" />
                  <div className="space-y-0.5">
                    <div className="text-sm font-medium">
                      Arrastra el archivo aquí o haz clic para seleccionarlo
                    </div>
                    <div className="text-xs text-muted-foreground">Formatos: .xml o .json</div>
                  </div>
                </>
              )}
              <input
                ref={inputRef}
                type="file"
                accept=".xml,.json,.txt,application/xml,text/xml,application/json"
                className="hidden"
                onChange={(e) => pickFile(e.target.files?.[0])}
              />
            </div>
          </TabsContent>

          <TabsContent value="paste" className="mt-4 space-y-2">
            <Textarea
              value={pasted}
              onChange={(e) => {
                setPasted(e.target.value)
                setError(null)
              }}
              placeholder='Pega aquí el XML de la cartola o el JSON del servicio, por ejemplo: { "movimientos": { "movimiento": [ ... ] } }'
              className="min-h-[180px] font-mono text-xs"
              spellCheck={false}
            />
            <p className="text-xs text-muted-foreground">
              Se detecta automáticamente si el contenido es XML o JSON.
            </p>
          </TabsContent>
        </Tabs>

        {error && (
          <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={parsing}>
            Cancelar
          </Button>
          <Button onClick={handleImport} disabled={!canImport || parsing}>
            {parsing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Procesando…
              </>
            ) : (
              'Cargar movimientos'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
