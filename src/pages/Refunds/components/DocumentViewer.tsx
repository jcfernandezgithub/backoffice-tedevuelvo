import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Loader2 } from 'lucide-react'

interface DocumentViewerProps {
  open: boolean
  onClose: () => void
  title: string
  getBlob: () => Promise<Blob>
  contentType: string
}

export function DocumentViewer({ open, onClose, title, getBlob, contentType }: DocumentViewerProps) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) {
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl)
        setBlobUrl(null)
      }
      setError(null)
      return
    }

    const loadDocument = async () => {
      setLoading(true)
      setError(null)
      try {
        const blob = await getBlob()
        const url = URL.createObjectURL(blob)
        setBlobUrl(url)
      } catch (err: any) {
        setError(err.message || 'Error al cargar documento')
      } finally {
        setLoading(false)
      }
    }

    loadDocument()
  }, [open])

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl h-[90vh]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-hidden">
          {loading && (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-8 h-8 animate-spin" />
            </div>
          )}
          {error && (
            <div className="flex items-center justify-center h-full text-destructive">
              {error}
            </div>
          )}
          {blobUrl && !loading && !error && (
            <>
              {contentType.includes('pdf') ? (
                <iframe
                  src={blobUrl}
                  className="w-full h-full border-0"
                  title={title}
                  aria-label={`Visor de PDF: ${title}`}
                />
              ) : (
                <img
                  src={blobUrl}
                  alt={title}
                  className="w-full h-full object-contain"
                />
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
