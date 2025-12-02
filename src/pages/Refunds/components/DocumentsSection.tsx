import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Download, Eye, ExternalLink, Loader2, Image as ImageIcon } from 'lucide-react'
import { publicFilesApi, type DocumentMeta, type SignedPdfInfo } from '@/services/publicFilesApi'
import { DocumentViewer } from './DocumentViewer'
import { useToast } from '@/hooks/use-toast'
import { format } from 'date-fns'

interface DocumentsSectionProps {
  publicId: string
  clientToken?: string
}

export function DocumentsSection({ publicId, clientToken }: DocumentsSectionProps) {
  const { toast } = useToast()
  const [viewingDoc, setViewingDoc] = useState<{ doc: DocumentMeta; title: string } | null>(null)
  const [idImages, setIdImages] = useState<{ front?: string; back?: string }>({})

  const { data: attachments = [], isLoading: loadingAttachments } = useQuery({
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

  const handleDownload = async (doc: DocumentMeta) => {
    try {
      const blob = await publicFilesApi.getRefundDocumentBlob(publicId, doc.id)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${doc.kind}-${doc.id}.pdf`
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

  return (
    <div className="space-y-6">
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
                  <TableHead>ID</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Tamaño</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {attachments.map((doc) => (
                  <TableRow key={doc.id}>
                    <TableCell className="font-mono text-xs">{doc.id.slice(0, 8)}...</TableCell>
                    <TableCell>{doc.kind}</TableCell>
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
