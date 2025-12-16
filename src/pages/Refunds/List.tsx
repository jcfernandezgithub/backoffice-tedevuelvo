import { useState, useEffect, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { refundAdminApi } from '@/services/refundAdminApi'
import { alianzasService } from '@/services/alianzasService'
import { allianceUsersClient } from '@/pages/Alianzas/services/allianceUsersClient'
import { AdminQueryParams, RefundStatus, RefundRequest } from '@/types/refund'
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
import { Checkbox } from '@/components/ui/checkbox'
import { Search, Filter, RotateCw, X, Copy, Check, ArrowUpDown, ArrowUp, ArrowDown, CheckCircle, AlertCircle, Flag } from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { GenerateExcelDialog } from './components/GenerateExcelDialog'
import { ExportToExcelDialog } from './components/ExportToExcelDialog'
import { MobileCard } from '@/components/common/MobileCard'
import { useIsMobile } from '@/hooks/use-mobile'

const statusLabels: Record<RefundStatus, string> = {
  simulated: 'Simulado',
  requested: 'Solicitado',
  qualifying: 'En calificación',
  docs_pending: 'Documentos pendientes',
  docs_received: 'Documentos recibidos',
  submitted: 'Ingresado',
  approved: 'Aprobado',
  rejected: 'Rechazado',
  payment_scheduled: 'Pago programado',
  paid: 'Pagado',
  canceled: 'Cancelado',
  datos_sin_simulacion: 'Datos (sin simulación)',
}

// Helper para obtener fecha local en formato YYYY-MM-DD
const toLocalDateString = (date: Date): string => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const getStatusColors = (status: RefundStatus): string => {
  switch (status) {
    case 'simulated':
      return 'bg-blue-500 hover:bg-blue-600 text-white border-blue-500'
    case 'requested':
      return 'bg-blue-400 hover:bg-blue-500 text-white border-blue-400'
    case 'qualifying':
      return 'bg-yellow-500 hover:bg-yellow-600 text-white border-yellow-500'
    case 'docs_pending':
      return 'bg-orange-500 hover:bg-orange-600 text-white border-orange-500'
    case 'docs_received':
      return 'bg-cyan-500 hover:bg-cyan-600 text-white border-cyan-500'
    case 'submitted':
      return 'bg-indigo-500 hover:bg-indigo-600 text-white border-indigo-500'
    case 'approved':
      return 'bg-green-500 hover:bg-green-600 text-white border-green-500'
    case 'payment_scheduled':
      return 'bg-emerald-500 hover:bg-emerald-600 text-white border-emerald-500'
    case 'paid':
      return 'bg-green-600 hover:bg-green-700 text-white border-green-600'
    case 'rejected':
      return 'bg-red-500 hover:bg-red-600 text-white border-red-500'
    case 'canceled':
      return 'bg-gray-500 hover:bg-gray-600 text-white border-gray-500'
    case 'datos_sin_simulacion':
      return 'bg-purple-500 hover:bg-purple-600 text-white border-purple-500'
    default:
      return 'bg-primary hover:bg-primary/90 text-white border-primary'
  }
}

interface RefundsListProps {
  title?: string
  listTitle?: string
  detailBasePath?: string
}

export default function RefundsList({ title = 'Solicitudes', listTitle = 'Listado de Solicitudes', detailBasePath = '/refunds' }: RefundsListProps) {
  const isMobile = useIsMobile()
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
  
  const [mandateFilter, setMandateFilter] = useState<string>(searchParams.get('mandate') || 'all')
  const [originFilter, setOriginFilter] = useState<string>(searchParams.get('origin') || 'all')

  // Estado local para el input de búsqueda (para debounce)
  const [searchInput, setSearchInput] = useState(filters.search)
  const [copiedField, setCopiedField] = useState<string | null>(null)
  const [sortField, setSortField] = useState<string>('createdAt')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')
  
  // Estado para selección de solicitudes
  const [selectedRefunds, setSelectedRefunds] = useState<Set<string>>(new Set())
  const [selectAll, setSelectAll] = useState(false)

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

  // Fetch partners para mostrar nombres de alianzas
  const { data: partnersData } = useQuery({
    queryKey: ['partners-list'],
    queryFn: () => alianzasService.list({ pageSize: 100 }),
    staleTime: 30 * 60 * 1000, // 30 minutos
  })

  // Mapa de partnerId a nombre
  const partnerNameMap = useMemo(() => {
    const map: Record<string, string> = {}
    partnersData?.items.forEach((p: any) => {
      map[p.id] = p.nombre
    })
    return map
  }, [partnersData])

  // Obtener unique partnerIds de los items actuales para buscar gestores
  const uniquePartnerIds = useMemo(() => {
    if (!data) return []
    const items = Array.isArray(data) ? data : (data as any).items || []
    const ids = new Set<string>()
    items.forEach((r: any) => {
      if (r.partnerId) ids.add(r.partnerId)
    })
    return Array.from(ids)
  }, [data])

  // Fetch partner users para mostrar nombres de gestores
  const { data: partnerUsersData } = useQuery({
    queryKey: ['partner-users-for-refunds', uniquePartnerIds],
    queryFn: async () => {
      const allUsers: Record<string, string> = {}
      await Promise.all(
        uniquePartnerIds.map(async (partnerId) => {
          try {
            const result = await allianceUsersClient.listAllianceUsers(partnerId, { pageSize: 100 })
            result.users.forEach((user) => {
              allUsers[user.id] = user.name
            })
          } catch (error) {
            // Silently fail for individual requests
          }
        })
      )
      return allUsers
    },
    enabled: uniquePartnerIds.length > 0,
    staleTime: 30 * 60 * 1000, // 30 minutos
  })

  // Mapa de partnerUserId a nombre del gestor
  const gestorNameMap = partnerUsersData || {}

  const handleFilterChange = (key: keyof AdminQueryParams, value: any) => {
    const newFilters = { ...filters, [key]: value, page: 1 }
    setFilters(newFilters)
    
    const params = new URLSearchParams()
    Object.entries(newFilters).forEach(([k, v]) => {
      if (v) params.set(k, String(v))
    })
    setSearchParams(params)
  }

  const handleDateRangeChange = (from: string, to: string) => {
    const newFilters = { ...filters, from, to, page: 1 }
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
    setMandateFilter('all')
    setOriginFilter('all')
    setSearchParams(new URLSearchParams())
  }
  
  const handleOriginFilterChange = (value: string) => {
    setOriginFilter(value)
    const params = new URLSearchParams(searchParams)
    if (value === 'all') {
      params.delete('origin')
    } else {
      params.set('origin', value)
    }
    setSearchParams(params)
  }
  
  const handleMandateFilterChange = (value: string) => {
    setMandateFilter(value)
    const params = new URLSearchParams(searchParams)
    if (value === 'all') {
      params.delete('mandate')
    } else {
      params.set('mandate', value)
    }
    setSearchParams(params)
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

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allIds = paginatedItems.map((r: any) => r.id)
      setSelectedRefunds(new Set(allIds))
      setSelectAll(true)
    } else {
      setSelectedRefunds(new Set())
      setSelectAll(false)
    }
  }

  const handleSelectRefund = (refundId: string, checked: boolean) => {
    const newSelected = new Set(selectedRefunds)
    if (checked) {
      newSelected.add(refundId)
    } else {
      newSelected.delete(refundId)
      setSelectAll(false)
    }
    setSelectedRefunds(newSelected)
  }

  const getSelectedRefundsData = (): RefundRequest[] => {
    const selected = paginatedItems.filter((r: any) => selectedRefunds.has(r.id))
    
    // Validar que todas tengan mandato firmado
    const withoutMandate = selected.filter((r: any) => {
      const status = mandateStatuses?.[r.publicId]
      return !status?.hasSignedPdf
    })

    if (withoutMandate.length > 0) {
      toast({
        title: 'Error',
        description: `${withoutMandate.length} solicitud(es) seleccionada(s) no tiene(n) mandato firmado`,
        variant: 'destructive',
      })
      return []
    }

    return selected as RefundRequest[]
  }

  const handleExcelGenerated = () => {
    setSelectedRefunds(new Set())
    setSelectAll(false)
  }

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  const SortIcon = ({ field }: { field: string }) => {
    if (sortField !== field) {
      return <ArrowUpDown className="h-4 w-4 ml-1 opacity-30" />
    }
    return sortDirection === 'asc' ? (
      <ArrowUp className="h-4 w-4 ml-1" />
    ) : (
      <ArrowDown className="h-4 w-4 ml-1" />
    )
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
  const textFilteredItems = searchTerm
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
  
  // Aplicar filtro por fecha de creación (interpretando las fechas como LOCAL)
  const dateFilteredItems = textFilteredItems.filter((r: any) => {
    if (!r.createdAt) return true

    // Día de creación en horario local (a medianoche local)
    const createdAt = new Date(r.createdAt)
    const createdLocalDay = new Date(
      createdAt.getFullYear(),
      createdAt.getMonth(),
      createdAt.getDate(),
      0, 0, 0, 0
    )

    // Helpers para construir límites del día en LOCAL a partir de YYYY-MM-DD
    const parseLocalStart = (s: string) => {
      const [y, m, d] = s.split('-').map(Number)
      return new Date(y, (m as number) - 1, d as number, 0, 0, 0, 0)
    }
    const parseLocalEnd = (s: string) => {
      const [y, m, d] = s.split('-').map(Number)
      return new Date(y, (m as number) - 1, d as number, 23, 59, 59, 999)
    }

    if (filters.from) {
      const fromStart = parseLocalStart(filters.from)
      if (createdLocalDay < fromStart) return false
    }
    if (filters.to) {
      const toEnd = parseLocalEnd(filters.to)
      if (createdLocalDay > toEnd) return false
    }
    return true
  })
  
  // Aplicar filtro por estado
  const statusFilteredItems = filters.status
    ? dateFilteredItems.filter((r: any) => r.status === filters.status)
    : dateFilteredItems
  
  // Query para obtener estados de mandatos de TODOS los items filtrados
  const allPublicIds = statusFilteredItems.map((r: any) => r.publicId)
  const { data: mandateStatuses } = useQuery({
    queryKey: ['mandate-statuses', allPublicIds],
    queryFn: async () => {
      const statuses: Record<string, any> = {}
      await Promise.all(
        allPublicIds.map(async (publicId: string) => {
          try {
            const response = await fetch(
              `https://tedevuelvo-app-be.onrender.com/api/v1/refund-requests/${publicId}/experian/status`
            )
            if (response.ok) {
              statuses[publicId] = await response.json()
            }
          } catch (error) {
            // Silently fail for individual requests
          }
        })
      )
      return statuses
    },
    enabled: allPublicIds.length > 0,
  })
  
  // Aplicar filtro de mandato (ahora mandateStatuses ya está disponible)
  const mandateFilteredItems = mandateFilter === 'all' 
    ? statusFilteredItems
    : statusFilteredItems.filter((r: any) => {
        const status = mandateStatuses?.[r.publicId]
        const hasSigned = status?.hasSignedPdf === true
        return mandateFilter === 'signed' ? hasSigned : !hasSigned
      })
  
  // Aplicar filtro de origen
  const filteredItems = originFilter === 'all'
    ? mandateFilteredItems
    : originFilter === 'alianza'
      ? mandateFilteredItems.filter((r: any) => r.partnerId)
      : mandateFilteredItems.filter((r: any) => !r.partnerId)

  // Aplicar ordenamiento
  const sortedItems = [...filteredItems].sort((a: any, b: any) => {
    let aValue = a[sortField]
    let bValue = b[sortField]

    // Manejo especial para diferentes tipos de datos
    if (sortField === 'createdAt') {
      aValue = new Date(aValue).getTime()
      bValue = new Date(bValue).getTime()
    } else if (sortField === 'estimatedAmountCLP') {
      aValue = Number(aValue)
      bValue = Number(bValue)
    } else if (typeof aValue === 'string') {
      aValue = aValue.toLowerCase()
      bValue = bValue.toLowerCase()
    }

    if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1
    if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1
    return 0
  })

  const totalFiltered = sortedItems.length
  const totalPages = totalFiltered > 0 
    ? Math.ceil(totalFiltered / normalizedData.pageSize)
    : 0

  const currentPage = Math.min(filters.page || 1, Math.max(totalPages, 1))
  const startIndex = (currentPage - 1) * normalizedData.pageSize
  const paginatedItems = sortedItems.slice(startIndex, startIndex + normalizedData.pageSize)

  return (
    <div className="p-3 md:p-6 space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <h1 className="text-2xl md:text-3xl font-bold">{title}</h1>
        <div className="flex flex-wrap gap-2">
          {!isMobile && (
            <>
              <ExportToExcelDialog 
                refunds={sortedItems as RefundRequest[]} 
                totalCount={totalFiltered}
                partnerNameMap={partnerNameMap}
                gestorNameMap={gestorNameMap}
                mandateStatuses={mandateStatuses || {}}
              />
              <GenerateExcelDialog 
                selectedRefunds={getSelectedRefundsData()} 
                onClose={handleExcelGenerated}
              />
            </>
          )}
          <Button onClick={() => refetch()} variant="outline" size="sm">
            <RotateCw className="h-4 w-4 mr-2" />
            {!isMobile && 'Actualizar'}
          </Button>
        </div>
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
              value={mandateFilter}
              onValueChange={handleMandateFilterChange}
            >
              <SelectTrigger>
                <SelectValue placeholder="Mandato" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los mandatos</SelectItem>
                <SelectItem value="signed">Con mandato firmado</SelectItem>
                <SelectItem value="pending">Mandato pendiente</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={originFilter}
              onValueChange={handleOriginFilterChange}
            >
              <SelectTrigger>
                <SelectValue placeholder="Origen" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los orígenes</SelectItem>
                <SelectItem value="alianza">Alianza</SelectItem>
                <SelectItem value="directo">Directo</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
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

          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-muted-foreground">Fecha:</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const hoy = toLocalDateString(new Date())
                  handleDateRangeChange(hoy, hoy)
                }}
                className="h-7 text-xs px-2"
              >
                Hoy
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const ayer = new Date()
                  ayer.setDate(ayer.getDate() - 1)
                  const ayerStr = toLocalDateString(ayer)
                  handleDateRangeChange(ayerStr, ayerStr)
                }}
                className="h-7 text-xs px-2"
              >
                Ayer
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const hoy = new Date()
                  const semanaAtras = new Date()
                  semanaAtras.setDate(hoy.getDate() - 7)
                  handleDateRangeChange(toLocalDateString(semanaAtras), toLocalDateString(hoy))
                }}
                className="h-7 text-xs px-2"
              >
                Última semana
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const hoy = new Date()
                  const mesAtras = new Date()
                  mesAtras.setMonth(hoy.getMonth() - 1)
                  handleDateRangeChange(toLocalDateString(mesAtras), toLocalDateString(hoy))
                }}
                className="h-7 text-xs px-2"
              >
                Último mes
              </Button>
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
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            {listTitle}
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
              {/* Vista Desktop - Tabla */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <Checkbox
                          checked={selectAll}
                          onCheckedChange={handleSelectAll}
                          aria-label="Seleccionar todas"
                        />
                      </TableHead>
                      <TableHead 
                        className="cursor-pointer hover:bg-muted/50 select-none"
                        onClick={() => handleSort('publicId')}
                      >
                        <div className="flex items-center">
                          ID Público
                          <SortIcon field="publicId" />
                        </div>
                      </TableHead>
                      <TableHead 
                        className="cursor-pointer hover:bg-muted/50 select-none"
                        onClick={() => handleSort('fullName')}
                      >
                        <div className="flex items-center">
                          Nombre
                          <SortIcon field="fullName" />
                        </div>
                      </TableHead>
                      <TableHead 
                        className="cursor-pointer hover:bg-muted/50 select-none"
                        onClick={() => handleSort('rut')}
                      >
                        <div className="flex items-center">
                          RUT
                          <SortIcon field="rut" />
                        </div>
                      </TableHead>
                      <TableHead 
                        className="cursor-pointer hover:bg-muted/50 select-none"
                        onClick={() => handleSort('email')}
                      >
                        <div className="flex items-center">
                          Email
                          <SortIcon field="email" />
                        </div>
                      </TableHead>
                      <TableHead 
                        className="cursor-pointer hover:bg-muted/50 select-none"
                        onClick={() => handleSort('status')}
                      >
                        <div className="flex items-center">
                          Estado
                          <SortIcon field="status" />
                        </div>
                      </TableHead>
                      <TableHead>Mandato</TableHead>
                      <TableHead 
                        className="text-right cursor-pointer hover:bg-muted/50 select-none"
                        onClick={() => handleSort('estimatedAmountCLP')}
                      >
                        <div className="flex items-center justify-end">
                          Monto estimado
                          <SortIcon field="estimatedAmountCLP" />
                        </div>
                      </TableHead>
                      <TableHead className="text-right">Monto Real</TableHead>
                      <TableHead className="text-center">Pago</TableHead>
                      <TableHead 
                        className="cursor-pointer hover:bg-muted/50 select-none"
                        onClick={() => handleSort('institutionId')}
                      >
                        <div className="flex items-center">
                          Institución
                          <SortIcon field="institutionId" />
                        </div>
                      </TableHead>
                      <TableHead>Origen</TableHead>
                      <TableHead>Gestor</TableHead>
                      <TableHead 
                        className="cursor-pointer hover:bg-muted/50 select-none"
                        onClick={() => handleSort('createdAt')}
                      >
                        <div className="flex items-center">
                          Creación
                          <SortIcon field="createdAt" />
                        </div>
                      </TableHead>
                      <TableHead>Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedItems.map((refund) => (
                      <TableRow key={refund.id}>
                        <TableCell className="w-12">
                          <Checkbox
                            checked={selectedRefunds.has(refund.id)}
                            onCheckedChange={(checked) => handleSelectRefund(refund.id, checked as boolean)}
                            aria-label={`Seleccionar solicitud ${refund.publicId}`}
                          />
                        </TableCell>
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
                        <TableCell>
                          {mandateStatuses?.[refund.publicId] ? (
                            mandateStatuses[refund.publicId].hasSignedPdf ? (
                              <div className="flex items-center gap-1 text-green-600">
                                <CheckCircle className="h-4 w-4" />
                                <span className="text-xs">Firmado</span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <div className="flex items-center gap-1 text-orange-600">
                                  <AlertCircle className="h-4 w-4" />
                                  <span className="text-xs">Pendiente</span>
                                </div>
                                {mandateStatuses[refund.publicId].signUrl && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 px-2 text-xs"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleCopy(mandateStatuses[refund.publicId].signUrl!, `signUrl-${refund.publicId}`)
                                    }}
                                  >
                                    {copiedField === `signUrl-${refund.publicId}` ? (
                                      <Check className="h-3 w-3 text-green-600" />
                                    ) : (
                                      <Copy className="h-3 w-3" />
                                    )}
                                    <span className="ml-1">URL</span>
                                  </Button>
                                )}
                              </div>
                            )
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          ${refund.estimatedAmountCLP?.toLocaleString('es-CL') || '0'}
                        </TableCell>
                        <TableCell className="text-right">
                          {(refund.status === 'payment_scheduled' || refund.status === 'paid') ? (
                            (() => {
                              const realAmountEntry = refund.statusHistory?.slice().reverse().find(
                                (entry: any) => (entry.to === 'payment_scheduled' || entry.to === 'paid') && entry.realAmount
                              )
                              return realAmountEntry?.realAmount ? (
                                <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                                  ${realAmountEntry.realAmount.toLocaleString('es-CL')}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )
                            })()
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {(refund as any).bankInfo ? (
                            <div className="flex items-center justify-center">
                              <div className="relative group">
                                <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30">
                                  <Flag className="h-4 w-4 text-emerald-500 fill-emerald-500" />
                                  <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">Listo</span>
                                </div>
                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-popover text-popover-foreground text-xs rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 border">
                                  Datos bancarios registrados
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center justify-center">
                              <div className="relative group">
                                <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-amber-500/15 border border-amber-500/30">
                                  <Flag className="h-4 w-4 text-amber-500" />
                                  <span className="text-xs font-medium text-amber-600 dark:text-amber-400">Pendiente</span>
                                </div>
                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-popover text-popover-foreground text-xs rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 border">
                                  Sin datos bancarios
                                </div>
                              </div>
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">{refund.institutionId}</TableCell>
                        <TableCell>
                          {refund.partnerId ? (
                            <Badge 
                              variant="outline" 
                              className="bg-primary/10 text-primary border-primary/20 text-xs cursor-pointer hover:bg-primary/20 transition-colors"
                              onClick={(e) => {
                                e.stopPropagation()
                                navigate(`/alianzas/${refund.partnerId}`)
                              }}
                            >
                              {partnerNameMap[refund.partnerId] || 'Alianza'}
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">Directo</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">
                          {refund.partnerUserId && gestorNameMap[refund.partnerUserId] ? (
                            <span className="text-xs">{gestorNameMap[refund.partnerUserId]}</span>
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">
                          {refund.createdAt ? new Date(refund.createdAt).toLocaleString('es-CL', {
                            dateStyle: 'short',
                            timeStyle: 'short'
                          }) : 'N/A'}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => navigate(`${detailBasePath}/${refund.id}`)}
                          >
                            Ver detalle
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Vista Mobile - Cards */}
              <div className="md:hidden space-y-3">
                {paginatedItems.map((refund) => (
                  <MobileCard
                    key={refund.id}
                    onClick={() => navigate(`${detailBasePath}/${refund.id}`)}
                    header={
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs text-muted-foreground">
                          {refund.publicId}
                        </span>
                        <Checkbox
                          checked={selectedRefunds.has(refund.id)}
                          onCheckedChange={(checked) => handleSelectRefund(refund.id, checked as boolean)}
                          onClick={(e) => e.stopPropagation()}
                          aria-label={`Seleccionar ${refund.publicId}`}
                        />
                      </div>
                    }
                    fields={[
                      {
                        label: 'Nombre',
                        value: refund.fullName,
                        fullWidth: true
                      },
                      {
                        label: 'RUT',
                        value: refund.rut
                      },
                      {
                        label: 'Estado',
                        value: (
                          <Badge className={getStatusColors(refund.status)}>
                            {statusLabels[refund.status]}
                          </Badge>
                        )
                      },
                      {
                        label: 'Monto estimado',
                        value: `$${refund.estimatedAmountCLP?.toLocaleString('es-CL') || '0'}`
                      },
                      {
                        label: 'Monto Real',
                        value: (refund.status === 'payment_scheduled' || refund.status === 'paid') ? (
                          (() => {
                            const realAmountEntry = refund.statusHistory?.slice().reverse().find(
                              (entry: any) => (entry.to === 'payment_scheduled' || entry.to === 'paid') && entry.realAmount
                            )
                            return realAmountEntry?.realAmount ? (
                              <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                                ${realAmountEntry.realAmount.toLocaleString('es-CL')}
                              </span>
                            ) : '-'
                          })()
                        ) : '-'
                      },
                      {
                        label: 'Datos pago',
                        value: (refund as any).bankInfo ? (
                          <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30">
                            <Flag className="h-3 w-3 text-emerald-500 fill-emerald-500" />
                            <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">Listo</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30">
                            <Flag className="h-3 w-3 text-amber-500" />
                            <span className="text-xs font-medium text-amber-600 dark:text-amber-400">Pendiente</span>
                          </div>
                        )
                      },
                      {
                        label: 'Institución',
                        value: refund.institutionId
                      },
                      {
                        label: 'Origen',
                        value: refund.partnerId ? (
                          <Badge 
                            variant="outline" 
                            className="bg-primary/10 text-primary border-primary/20 text-xs cursor-pointer hover:bg-primary/20 transition-colors"
                            onClick={(e) => {
                              e.stopPropagation()
                              navigate(`/alianzas/${refund.partnerId}`)
                            }}
                          >
                            {partnerNameMap[refund.partnerId] || 'Alianza'}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">Directo</span>
                        )
                      },
                      {
                        label: 'Gestor',
                        value: refund.partnerUserId && gestorNameMap[refund.partnerUserId] ? (
                          <span className="text-xs">{gestorNameMap[refund.partnerUserId]}</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )
                      },
                      {
                        label: 'Mandato',
                        value: mandateStatuses?.[refund.publicId] ? (
                          mandateStatuses[refund.publicId].hasSignedPdf ? (
                            <div className="flex items-center gap-1 text-green-600">
                              <CheckCircle className="h-3 w-3" />
                              <span className="text-xs">Firmado</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <div className="flex items-center gap-1 text-orange-600">
                                <AlertCircle className="h-3 w-3" />
                                <span className="text-xs">Pendiente</span>
                              </div>
                              {mandateStatuses[refund.publicId].signUrl && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 px-2 text-xs"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleCopy(mandateStatuses[refund.publicId].signUrl!, `signUrl-${refund.publicId}`)
                                  }}
                                >
                                  {copiedField === `signUrl-${refund.publicId}` ? (
                                    <Check className="h-3 w-3 text-green-600" />
                                  ) : (
                                    <Copy className="h-3 w-3" />
                                  )}
                                  <span className="ml-1">URL</span>
                                </Button>
                              )}
                            </div>
                          )
                        ) : (
                          <span className="text-xs">-</span>
                        )
                      },
                      {
                        label: 'Fecha',
                        value: new Date(refund.createdAt).toLocaleDateString('es-CL')
                      }
                    ]}
                  />
                ))}
              </div>

              {totalPages > 1 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-4 pt-4 border-t">
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
