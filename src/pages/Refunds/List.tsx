import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { refundAdminApi } from '@/services/refundAdminApi'
import { AdminQueryParams, RefundStatus } from '@/types/refund'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Search, Filter, RotateCw, X, Copy, Check } from 'lucide-react'
import { toast } from '@/hooks/use-toast'

const statusLabels: Record<RefundStatus, string> = {
  REQUESTED: 'Solicitado',
  QUALIFYING: 'En calificación',
  DOCS_PENDING: 'Docs pendientes',
  DOCS_RECEIVED: 'Docs recibidos',
  SUBMITTED: 'Enviado',
  APPROVED: 'Aprobado',
  REJECTED: 'Rechazado',
  PAYMENT_SCHEDULED: 'Pago programado',
  PAID: 'Pagado',
  CANCELED: 'Cancelado',
}

const getStatusColors = (status: RefundStatus): string => {
  switch (status) {
    case 'REQUESTED':
      return 'bg-blue-500 hover:bg-blue-600 text-white border-blue-500'
    case 'QUALIFYING':
      return 'bg-yellow-500 hover:bg-yellow-600 text-white border-yellow-500'
    case 'DOCS_PENDING':
      return 'bg-orange-500 hover:bg-orange-600 text-white border-orange-500'
    case 'DOCS_RECEIVED':
      return 'bg-cyan-500 hover:bg-cyan-600 text-white border-cyan-500'
    case 'SUBMITTED':
      return 'bg-indigo-500 hover:bg-indigo-600 text-white border-indigo-500'
    case 'APPROVED':
      return 'bg-green-500 hover:bg-green-600 text-white border-green-500'
    case 'PAYMENT_SCHEDULED':
      return 'bg-emerald-500 hover:bg-emerald-600 text-white border-emerald-500'
    case 'PAID':
      return 'bg-green-600 hover:bg-green-700 text-white border-green-600'
    case 'REJECTED':
      return 'bg-red-500 hover:bg-red-600 text-white border-red-500'
    case 'CANCELED':
      return 'bg-gray-500 hover:bg-gray-600 text-white border-gray-500'
    default:
      return 'bg-primary hover:bg-primary/90 text-white border-primary'
  }
}

export default function RefundsList() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const [filters, setFilters] = useState<AdminQueryParams>({
    search: searchParams.get('search') || '',
    status: (searchParams.get('status') as RefundStatus) || undefined,
    from: searchParams.get('from') || '',
    to: searchParams.get('to') || '',
    page: Number(searchParams.get('page')) || 1,
    pageSize: Number(searchParams.get('pageSize')) || 20,
    sort: (searchParams.get('sort') as any) || 'createdAt:desc',
  })

  // Estado local para el input de búsqueda (para debounce)
  const [searchInput, setSearchInput] = useState(filters.search)
  const [copiedField, setCopiedField] = useState<string | null>(null)

  // Debounce para la búsqueda
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput !== filters.search) {
        handleFilterChange('search', searchInput)
      }
    }, 500) // Espera 500ms después de que el usuario deje de escribir

    return () => clearTimeout(timer)
  }, [searchInput])

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['refunds', filters],
    queryFn: () => refundAdminApi.list(filters),
    retry: false,
  })

  const handleFilterChange = (key: keyof AdminQueryParams, value: any) => {
    const newFilters = { ...filters, [key]: value, page: 1 }
    setFilters(newFilters)
    
    const params = new URLSearchParams()
    Object.entries(newFilters).forEach(([k, v]) => {
      if (v) params.set(k, String(v))
    })
    setSearchParams(params)
  }

  const handlePageChange = (newPage: number) => {
    const newFilters = { ...filters, page: newPage }
    setFilters(newFilters)
    
    const params = new URLSearchParams()
    Object.entries(newFilters).forEach(([k, v]) => {
      if (v) params.set(k, String(v))
    })
    setSearchParams(params)
  }

  const handleClearFilters = () => {
    const clearedFilters: AdminQueryParams = {
      search: '',
      status: undefined,
      from: '',
      to: '',
      page: 1,
      pageSize: 20,
      sort: 'createdAt:desc',
    }
    setFilters(clearedFilters)
    setSearchInput('')
    setSearchParams(new URLSearchParams())
  }

  const handleCopy = (text: string, fieldId: string) => {
    navigator.clipboard.writeText(text)
    setCopiedField(fieldId)
    setTimeout(() => setCopiedField(null), 2000)
    toast({
      title: 'Copiado',
      description: 'Campo copiado al portapapeles',
    })
  }

  if (error) {
    const errorMessage = (error as Error).message
    if (errorMessage === 'UNAUTHORIZED') {
      toast({
        title: 'Sesión expirada',
        description: 'Por favor inicia sesión nuevamente',
        variant: 'destructive',
      })
    } else {
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      })
    }
  }

  // Normalizar respuesta de la API - puede ser array o objeto
  const normalizedData = (() => {
    if (!data) {
      return { total: 0, page: 1, pageSize: 20, items: [] }
    }
    
    // Si es un array directo, crear el objeto esperado
    if (Array.isArray(data)) {
      return {
        total: data.length,
        page: filters.page || 1,
        pageSize: filters.pageSize || 20,
        items: data
      }
    }
    
    // Si es un objeto con items
    if (typeof data === 'object' && 'items' in data) {
      return data
    }
    
    // Fallback
    return { total: 0, page: 1, pageSize: 20, items: [] }
  })()

  const searchTerm = (filters.search || '').toLowerCase().trim()
  const filteredItems = searchTerm
    ? normalizedData.items.filter((r: any) => {
        const haystack = [
          r.publicId,
          r.id,
          r.email,
          r.rut,
          r.fullName,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        return haystack.includes(searchTerm)
      })
    : normalizedData.items

  const totalFiltered = filteredItems.length
  const totalPages = totalFiltered > 0 
    ? Math.ceil(totalFiltered / normalizedData.pageSize)
    : 0

  const currentPage = Math.min(filters.page || 1, Math.max(totalPages, 1))
  const startIndex = (currentPage - 1) * normalizedData.pageSize
  const paginatedItems = filteredItems.slice(startIndex, startIndex + normalizedData.pageSize)

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Solicitudes</h1>
        <Button onClick={() => refetch()} variant="outline" size="sm">
          <RotateCw className="h-4 w-4 mr-2" />
          Actualizar
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filtros
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearFilters}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4 mr-2" />
              Limpiar filtros
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar (ID, email, RUT, nombre)"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="pl-9"
              />
            </div>

            <Select
              value={filters.status || 'all'}
              onValueChange={(v) => handleFilterChange('status', v === 'all' ? undefined : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los estados</SelectItem>
                {Object.entries(statusLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={filters.sort || 'createdAt:desc'}
              onValueChange={(v) => handleFilterChange('sort', v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Ordenar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="createdAt:desc">Más recientes</SelectItem>
                <SelectItem value="createdAt:asc">Más antiguos</SelectItem>
                <SelectItem value="status:asc">Estado A-Z</SelectItem>
                <SelectItem value="status:desc">Estado Z-A</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-muted-foreground">Desde</label>
              <Input
                type="date"
                value={filters.from || ''}
                onChange={(e) => handleFilterChange('from', e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Hasta</label>
              <Input
                type="date"
                value={filters.to || ''}
                onChange={(e) => handleFilterChange('to', e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            Listado de Solicitudes
            {totalFiltered > 0 && (
              <span className="text-muted-foreground ml-2">({totalFiltered} total)</span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : paginatedItems.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No se encontraron solicitudes
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID Público</TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead>RUT</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Monto estimado</TableHead>
                    <TableHead>Institución</TableHead>
                    <TableHead>Creación</TableHead>
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedItems.map((refund) => (
                    <TableRow key={refund.id}>
                      <TableCell className="font-mono text-sm">
                        <div className="flex items-center gap-1">
                          <span>{refund.publicId}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleCopy(refund.publicId, `publicId-${refund.id}`)}
                            className="h-6 w-6 p-0"
                          >
                            {copiedField === `publicId-${refund.id}` ? (
                              <Check className="h-3 w-3 text-green-600" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>{refund.fullName}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <span>{refund.rut}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleCopy(refund.rut, `rut-${refund.id}`)}
                            className="h-6 w-6 p-0"
                          >
                            {copiedField === `rut-${refund.id}` ? (
                              <Check className="h-3 w-3 text-green-600" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        <div className="flex items-center gap-1">
                          <span>{refund.email}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleCopy(refund.email, `email-${refund.id}`)}
                            className="h-6 w-6 p-0"
                          >
                            {copiedField === `email-${refund.id}` ? (
                              <Check className="h-3 w-3 text-green-600" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={getStatusColors(refund.status)}>
                          {statusLabels[refund.status]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        ${refund.estimatedAmountCLP.toLocaleString('es-CL')}
                      </TableCell>
                      <TableCell className="text-sm">{refund.institutionId}</TableCell>
                      <TableCell className="text-sm">
                        {new Date(refund.createdAt).toLocaleDateString('es-CL')}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigate(`/refunds/${refund.id}`)}
                        >
                          Ver detalle
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <div className="text-sm text-muted-foreground">
                    Página {currentPage} de {totalPages}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={currentPage === 1}
                      onClick={() => handlePageChange(currentPage - 1)}
                    >
                      Anterior
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={currentPage === totalPages}
                      onClick={() => handlePageChange(currentPage + 1)}
                    >
                      Siguiente
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
