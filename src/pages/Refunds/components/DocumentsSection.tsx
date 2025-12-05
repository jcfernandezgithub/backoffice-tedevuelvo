import { useState, useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Download, Eye, ExternalLink, Loader2, Image as ImageIcon, Upload, FileUp, X } from 'lucide-react'
import { publicFilesApi, type DocumentMeta, type SignedPdfInfo } from '@/services/publicFilesApi'
import { DocumentViewer } from './DocumentViewer'
import { useToast } from '@/hooks/use-toast'
import { format } from 'date-fns'
import { authService } from '@/services/authService'

const API_BASE_URL = 'https://tedevuelvo-app-be.onrender.com/api/v1'

const DOCUMENT_KINDS = [
  { value: 'certificado_cobertura', label: 'Certificado de Cobertura' },
  { value: 'carta_corte', label: 'Carta de Corte' },
  { value: 'liquidacion', label: 'Liquidación' },
  { value: 'comprobante_pago', label: 'Comprobante de Pago' },
  { value: 'documento_identidad', label: 'Documento de Identidad' },
  { value: 'otro', label: 'Otro' },
]

interface DocumentsSectionProps {
  publicId: string
  clientToken?: string
  documents?: DocumentMeta[]
}

export function DocumentsSection({ publicId, clientToken, documents: propDocuments }: DocumentsSectionProps) {
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  const [viewingDoc, setViewingDoc] = useState<{ doc: DocumentMeta; title: string } | null>(null)
  const [idImages, setIdImages] = useState<{ front?: string; back?: string }>({})
  
  // Upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploadKind, setUploadKind] = useState<string>('')
  const [customFileName, setCustomFileName] = useState<string>('')
  const [isUploading, setIsUploading] = useState(false)
  const [isDragging, setIsDragging] = useState(false)

  const { data: attachments = [], isLoading: loadingAttachments, refetch: refetchDocuments } = useQuery({
    queryKey: ['refund-documents', publicId],
    queryFn: () => publicFilesApi.listRefundDocuments(publicId),
  })

  const { data: signedPdfInfo } = useQuery<SignedPdfInfo>({
    queryKey: ['refund-signed-pdf', publicId],
    queryFn: () => publicFilesApi.getSignedPdfInfo(publicId),
  })

  useEffect(() => {
    if (!clientToken) return

    const loadIdImages = async () => {
      try {
        const frontBlob = await publicFilesApi.getIdImageBlob(publicId, 'id-front', clientToken)
        setIdImages((prev) => ({ ...prev, front: URL.createObjectURL(frontBlob) }))
      } catch {
        // Silently fail if not available
      }

      try {
        const backBlob = await publicFilesApi.getIdImageBlob(publicId, 'id-back', clientToken)
        setIdImages((prev) => ({ ...prev, back: URL.createObjectURL(backBlob) }))
      } catch {
        // Silently fail if not available
      }
    }

    loadIdImages()

    return () => {
      if (idImages.front) URL.revokeObjectURL(idImages.front)
      if (idImages.back) URL.revokeObjectURL(idImages.back)
    }
  }, [publicId, clientToken])

  const getFileName = (key: string) => {
    const parts = key.split('/')
    return parts[parts.length - 1]
  }

  const handleDownload = async (doc: DocumentMeta) => {
    try {
      const blob = await publicFilesApi.getRefundDocumentBlob(publicId, doc.id)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = getFileName(doc.key)
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast({ title: 'Documento descargado' })
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
    }
  }

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setSelectedFile(file)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    
    const file = e.dataTransfer.files?.[0]
    if (file) {
      const allowedTypes = ['.pdf', '.jpg', '.jpeg', '.png', '.doc', '.docx', '.xls', '.xlsx']
      const extension = '.' + file.name.split('.').pop()?.toLowerCase()
      if (allowedTypes.includes(extension)) {
        setSelectedFile(file)
      } else {
        toast({
          title: 'Tipo de archivo no permitido',
          description: 'Solo se permiten archivos PDF, imágenes, Word y Excel',
          variant: 'destructive'
        })
      }
    }
  }

  const handleClearFile = () => {
    setSelectedFile(null)
    setUploadKind('')
    setCustomFileName('')
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleUpload = async () => {
    if (!selectedFile || !uploadKind) {
      toast({ 
        title: 'Error', 
        description: 'Selecciona un archivo y tipo de documento', 
        variant: 'destructive' 
      })
      return
    }

    setIsUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', selectedFile)
      formData.append('kind', uploadKind)
      if (customFileName.trim()) {
        formData.append('fileName', customFileName.trim())
      }

      const token = authService.getAccessToken()
      const response = await fetch(`${API_BASE_URL}/refund-requests/${publicId}/upload-file`, {
        method: 'POST',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.message || 'Error al subir archivo')
      }

      toast({ title: 'Archivo subido exitosamente' })
      handleClearFile()
      
      // Refrescar lista de documentos inmediatamente
      await refetchDocuments()
    } catch (err: any) {
      toast({ 
        title: 'Error al subir archivo', 
        description: err.message, 
        variant: 'destructive' 
      })
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Subir archivo */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5" />
            Subir Documento
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div 
            className={`relative border-2 border-dashed rounded-lg p-6 transition-colors ${
              isDragging 
                ? 'border-primary bg-primary/5' 
                : 'border-muted-foreground/25 hover:border-muted-foreground/50'
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            {/* Drop zone overlay */}
            {isDragging && (
              <div className="absolute inset-0 flex items-center justify-center bg-primary/10 rounded-lg z-10">
                <div className="text-center">
                  <FileUp className="w-12 h-12 mx-auto text-primary mb-2" />
                  <p className="text-lg font-medium text-primary">Suelta el archivo aquí</p>
                </div>
              </div>
            )}
            
            {!selectedFile ? (
              <div className="text-center py-4">
                <FileUp className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground mb-2">
                  Arrastra un archivo aquí o haz clic para seleccionar
                </p>
                <Input
                  ref={fileInputRef}
                  id="file-upload"
                  type="file"
                  onChange={handleFileSelect}
                  className="hidden"
                  accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx"
                />
                <Button 
                  variant="outline" 
                  onClick={() => fileInputRef.current?.click()}
                  type="button"
                >
                  Seleccionar archivo
                </Button>
                <p className="text-xs text-muted-foreground mt-2">
                  PDF, imágenes, Word o Excel (máx. 20MB)
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Selected file info */}
                <div className="flex items-center justify-between bg-muted/50 rounded-lg p-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <FileUp className="w-8 h-8 text-primary flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="font-medium truncate">{selectedFile.name}</p>
                      <p className="text-xs text-muted-foreground">{formatBytes(selectedFile.size)}</p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={handleClearFile}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
                
                {/* Form fields */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="doc-kind" className="text-sm font-medium mb-2 block">
                      Tipo de documento *
                    </Label>
                    <Select value={uploadKind} onValueChange={setUploadKind}>
                      <SelectTrigger id="doc-kind">
                        <SelectValue placeholder="Seleccionar tipo" />
                      </SelectTrigger>
                      <SelectContent>
                        {DOCUMENT_KINDS.map((kind) => (
                          <SelectItem key={kind.value} value={kind.value}>
                            {kind.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="custom-filename" className="text-sm font-medium mb-2 block">
                      Nombre personalizado
                    </Label>
                    <Input
                      id="custom-filename"
                      type="text"
                      value={customFileName}
                      onChange={(e) => setCustomFileName(e.target.value)}
                      placeholder="Opcional"
                    />
                  </div>

                  <div className="flex items-end">
                    <Button
                      onClick={handleUpload}
                      disabled={!selectedFile || !uploadKind || isUploading}
                      className="w-full"
                    >
                      {isUploading ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Subiendo...
                        </>
                      ) : (
                        <>
                          <Upload className="w-4 h-4 mr-2" />
                          Subir archivo
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Adjuntos */}
      <Card>
        <CardHeader>
          <CardTitle>Documentos</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingAttachments ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : attachments.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin documentos adjuntos</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre del Archivo</TableHead>
                  <TableHead>Tamaño</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {attachments.map((doc) => (
                  <TableRow key={doc.id}>
                    <TableCell className="font-mono text-xs break-all">{getFileName(doc.key)}</TableCell>
                    <TableCell>{formatBytes(doc.size)}</TableCell>
                    <TableCell>{format(new Date(doc.createdAt), 'dd/MM/yyyy HH:mm')}</TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setViewingDoc({ doc, title: `${doc.kind} - ${doc.id}` })}
                        aria-label="Ver PDF"
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDownload(doc)}
                        aria-label="Descargar PDF"
                      >
                        <Download className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Mandato firmado */}
      {(signedPdfInfo?.hasSignedPdf || signedPdfInfo?.signedPdfUrl) && (
        <Card>
          <CardHeader>
            <CardTitle>Mandato Firmado</CardTitle>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              onClick={() => window.open(signedPdfInfo.signedPdfUrl || signedPdfInfo.url, '_blank')}
              aria-label="Ver mandato firmado"
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              Ver mandato firmado
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Documentos de identidad */}
      {clientToken && (idImages.front || idImages.back) && (
        <Card>
          <CardHeader>
            <CardTitle>Documentos de Identidad</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {idImages.front && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Frente</p>
                  <div className="border rounded-lg overflow-hidden">
                    <img
                      src={idImages.front}
                      alt="DNI Frente"
                      className="w-full h-auto"
                      aria-label="Ver DNI frente"
                    />
                  </div>
                </div>
              )}
              {idImages.back && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Dorso</p>
                  <div className="border rounded-lg overflow-hidden">
                    <img
                      src={idImages.back}
                      alt="DNI Dorso"
                      className="w-full h-auto"
                      aria-label="Ver DNI dorso"
                    />
                  </div>
                </div>
              )}
              {!idImages.front && !idImages.back && (
                <div className="col-span-2 flex items-center justify-center py-8 text-muted-foreground">
                  <ImageIcon className="w-6 h-6 mr-2" />
                  <p className="text-sm">Documentos de identidad no disponibles</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Visor de documentos */}
      {viewingDoc && (
        <DocumentViewer
          open={!!viewingDoc}
          onClose={() => setViewingDoc(null)}
          title={viewingDoc.title}
          getBlob={() => publicFilesApi.getRefundDocumentBlob(publicId, viewingDoc.doc.id)}
          contentType={viewingDoc.doc.contentType}
        />
      )}
    </div>
  )
}
