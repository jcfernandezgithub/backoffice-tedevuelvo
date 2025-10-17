import { useState } from 'react'
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
import { Search, Filter, RotateCw } from 'lucide-react'
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

const statusVariants: Record<RefundStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  REQUESTED: 'secondary',
  QUALIFYING: 'secondary',
  DOCS_PENDING: 'outline',
  DOCS_RECEIVED: 'outline',
  SUBMITTED: 'default',
  APPROVED: 'default',
  REJECTED: 'destructive',
  PAYMENT_SCHEDULED: 'default',
  PAID: 'default',
  CANCELED: 'destructive',
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

  const totalPages = data && typeof data === 'object' && 'total' in data && 'pageSize' in data
    ? Math.ceil(data.total / data.pageSize)
    : 0

  // Normalizar respuesta de la API
  const normalizedData = data && typeof data === 'object' && 'items' in data
    ? data
    : { total: 0, page: 1, pageSize: 20, items: [] }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Refunds</h1>
        <Button onClick={() => refetch()} variant="outline" size="sm">
          <RotateCw className="h-4 w-4 mr-2" />
          Actualizar
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar (ID, email, RUT, nombre)"
                value={filters.search || ''}
                onChange={(e) => handleFilterChange('search', e.target.value)}
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
            Listado de Refunds
            {normalizedData.total > 0 && (
              <span className="text-muted-foreground ml-2">({normalizedData.total} total)</span>
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
          ) : normalizedData.items.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No se encontraron refunds
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
                  {normalizedData.items.map((refund) => (
                    <TableRow key={refund.id}>
                      <TableCell className="font-mono text-sm">{refund.publicId}</TableCell>
                      <TableCell>{refund.fullName}</TableCell>
                      <TableCell>{refund.rut}</TableCell>
                      <TableCell className="text-sm">{refund.email}</TableCell>
                      <TableCell>
                        <Badge variant={statusVariants[refund.status]}>
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
                    Página {normalizedData.page} de {totalPages}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={normalizedData.page === 1}
                      onClick={() => handlePageChange(normalizedData.page - 1)}
                    >
                      Anterior
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={normalizedData.page === totalPages}
                      onClick={() => handlePageChange(normalizedData.page + 1)}
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
