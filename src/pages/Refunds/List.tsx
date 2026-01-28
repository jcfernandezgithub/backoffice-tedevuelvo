import { useState, useEffect, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { refundAdminApi, SearchParams } from '@/services/refundAdminApi'
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
import { getInstitutionDisplayName } from '@/lib/institutionHomologation'

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

  // Filtros que se envían al servidor (solo se actualizan al hacer clic en "Buscar")
  const [filters, setFilters] = useState<AdminQueryParams>({
    search: searchParams.get('search') || '',
    status: (searchParams.get('status') as RefundStatus) || undefined,
    from: searchParams.get('from') || '',
    to: searchParams.get('to') || '',
    page: Number(searchParams.get('page')) || 1,
    pageSize: Number(searchParams.get('pageSize')) || 20,
    sort: (searchParams.get('sort') as any) || 'createdAt:desc',
  })
  
  // Estado local para los inputs de filtros (antes de aplicar)
  const [localFilters, setLocalFilters] = useState<AdminQueryParams>({
    search: searchParams.get('search') || '',
    status: (searchParams.get('status') as RefundStatus) || undefined,
    from: searchParams.get('from') || '',
    to: searchParams.get('to') || '',
    sort: (searchParams.get('sort') as any) || 'createdAt:desc',
  })
  
  const [mandateFilter, setMandateFilter] = useState<string>(searchParams.get('mandate') || 'all')
  const [originFilter, setOriginFilter] = useState<string>(searchParams.get('origin') || 'all')
  const [bankFilter, setBankFilter] = useState<string>(searchParams.get('bank') || 'all')
  const [insuranceTypeFilter, setInsuranceTypeFilter] = useState<string>(searchParams.get('insuranceType') || 'all')

  const [copiedField, setCopiedField] = useState<string | null>(null)
  const [sortField, setSortField] = useState<string>('createdAt')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')
  
  // Estado para selección de solicitudes
  const [selectedRefunds, setSelectedRefunds] = useState<Set<string>>(new Set())
  const [selectAll, setSelectAll] = useState(false)
  
  // Estado para parámetros de búsqueda (nuevo endpoint search)
  const [searchFilters, setSearchFilters] = useState<SearchParams>({
    page: 1,
    limit: 20,
  })
  const [useSearchEndpoint, setUseSearchEndpoint] = useState(false)

  // Query para listado inicial (listV2)
  const { data: listData, isLoading: isListLoading, error: listError, refetch: refetchList } = useQuery({
    queryKey: ['refunds-list', filters],
    queryFn: () => refundAdminApi.list(filters),
    retry: false,
    staleTime: 30 * 1000,
    enabled: !useSearchEndpoint,
  })
  
  // Query para búsqueda (search endpoint)
  const { data: searchData, isLoading: isSearchLoading, error: searchError, refetch: refetchSearch } = useQuery({
    queryKey: ['refunds-search', searchFilters],
    queryFn: () => refundAdminApi.search(searchFilters),
    retry: false,
    staleTime: 30 * 1000,
    enabled: useSearchEndpoint,
  })
  
  // Unificar datos según el endpoint usado
  const data = useSearchEndpoint ? searchData : listData
  const isLoading = useSearchEndpoint ? isSearchLoading : isListLoading
  const error = useSearchEndpoint ? searchError : listError
  const refetch = useSearchEndpoint ? refetchSearch : refetchList

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

  // Actualiza solo el estado local de filtros (no dispara búsqueda)
  const handleLocalFilterChange = (key: keyof AdminQueryParams, value: any) => {
    setLocalFilters(prev => ({ ...prev, [key]: value }))
  }

  // Actualiza rango de fechas en estado local
  const handleLocalDateRangeChange = (from: string, to: string) => {
    setLocalFilters(prev => ({ ...prev, from, to }))
  }

  // Ejecuta la búsqueda con los filtros locales actuales usando el endpoint search
  const handleSearch = () => {
    // Determinar valor de signatureStatus para el servidor
    let signatureStatusValue: 'signed' | null | undefined = undefined
    if (mandateFilter === 'signed') {
      signatureStatusValue = 'signed'
    } else if (mandateFilter === 'pending') {
      signatureStatusValue = null
    }
    
    // Construir parámetros para el nuevo endpoint search
    const newSearchFilters: SearchParams = {
      q: localFilters.search || undefined,
      status: localFilters.status || undefined,
      origin: originFilter !== 'all' ? originFilter : undefined,
      sort: 'recent', // Por defecto más recientes
      from: localFilters.from || undefined,
      to: localFilters.to || undefined,
      page: 1,
      limit: filters.pageSize || 20,
      signatureStatus: signatureStatusValue,
    }
    
    setSearchFilters(newSearchFilters)
    setUseSearchEndpoint(true)
    
    // Actualizar URL params
    const params = new URLSearchParams()
    if (newSearchFilters.q) params.set('q', newSearchFilters.q)
    if (newSearchFilters.status) params.set('status', newSearchFilters.status)
    if (newSearchFilters.origin) params.set('origin', newSearchFilters.origin)
    if (newSearchFilters.from) params.set('from', newSearchFilters.from)
    if (newSearchFilters.to) params.set('to', newSearchFilters.to)
    if (mandateFilter !== 'all') params.set('mandate', mandateFilter)
    if (bankFilter !== 'all') params.set('bank', bankFilter)
    if (insuranceTypeFilter !== 'all') params.set('insuranceType', insuranceTypeFilter)
    params.set('page', '1')
    setSearchParams(params)
  }

  const handlePageChange = (newPage: number) => {
    if (useSearchEndpoint) {
      const newSearchFilters = { ...searchFilters, page: newPage }
      setSearchFilters(newSearchFilters)
    } else {
      const newFilters = { ...filters, page: newPage }
      setFilters(newFilters)
    }
    
    const params = new URLSearchParams(searchParams)
    params.set('page', String(newPage))
    setSearchParams(params)
  }

  // Limpia todos los filtros y carga listado inicial con listV2
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
    setLocalFilters({
      search: '',
      status: undefined,
      from: '',
      to: '',
      sort: 'createdAt:desc',
    })
    setFilters(clearedFilters)
    setSearchFilters({ page: 1, limit: 20 })
    setUseSearchEndpoint(false) // Volver a usar listV2
    setMandateFilter('all')
    setOriginFilter('all')
    setBankFilter('all')
    setInsuranceTypeFilter('all')
    setSearchParams(new URLSearchParams())
  }
  
  const handleOriginFilterChange = (value: string) => {
    setOriginFilter(value)
  }
  
  const handleMandateFilterChange = (value: string) => {
    setMandateFilter(value)
  }
  
  const handleBankFilterChange = (value: string) => {
    setBankFilter(value)
  }
  
  const handleInsuranceTypeFilterChange = (value: string) => {
    setInsuranceTypeFilter(value)
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
    // Con paginación server-side, enviamos el ordenamiento al servidor
    const newDirection = sortField === field && sortDirection === 'asc' ? 'desc' : 'asc'
    setSortField(field)
    setSortDirection(newDirection)
    
    // Solo enviamos ordenamiento de campos soportados por el backend
    const supportedSortFields = ['createdAt', 'status']
    if (supportedSortFields.includes(field)) {
      const sortValue = `${field}:${newDirection}` as any
      setLocalFilters(prev => ({ ...prev, sort: sortValue }))
      // Aplicar ordenamiento inmediatamente
      const newFilters = { ...filters, sort: sortValue }
      setFilters(newFilters)
      const params = new URLSearchParams()
      Object.entries(newFilters).forEach(([k, v]) => {
        if (v) params.set(k, String(v))
      })
      setSearchParams(params)
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

  // Mostrar error en useEffect para evitar llamar toast durante el render
  useEffect(() => {
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
  }, [error])

  // Normalizar respuesta de la API - ahora viene del endpoint listV2 con paginación server-side
  const normalizedData = useMemo(() => {
    if (!data) {
      return { total: 0, page: 1, pageSize: 20, totalPages: 1, hasNext: false, hasPrev: false, items: [] }
    }
    
    // El servicio ya devuelve el formato correcto desde listV2
    return {
      total: data.total || 0,
      page: data.page || filters.page || 1,
      pageSize: data.pageSize || filters.pageSize || 20,
      totalPages: data.totalPages || 1,
      hasNext: data.hasNext || false,
      hasPrev: data.hasPrev || false,
      items: data.items || []
    }
  }, [data, filters.page, filters.pageSize])

  // Con paginación server-side, los filtros principales (search, status, from, to) se envían al servidor
  // Solo aplicamos filtros adicionales locales (origen, banco, tipo seguro) sobre los items recibidos
  const statusFilteredItems = useMemo(() => {
    return normalizedData.items
  }, [normalizedData.items])
  
  // Con paginación server-side, el ordenamiento ya viene del servidor
  // Solo aplicamos ordenamiento local si el usuario lo cambia en la UI
  const preSortedItems = useMemo(() => {
    // Los items ya vienen ordenados del servidor según filters.sort
    return statusFilteredItems
  }, [statusFilteredItems])
  
  // IDs para consultar mandatos - solo de la página actual (ya paginada por el servidor)
  const idsToFetch = useMemo(() => {
    return preSortedItems.map((r: any) => r.publicId).filter(Boolean)
  }, [preSortedItems])
  
  const { data: mandateStatuses, isLoading: isMandateLoading } = useQuery({
    queryKey: ['mandate-statuses-page', idsToFetch],
    queryFn: async () => {
      const statuses: Record<string, any> = {}
      // Ejecutar en lotes de 10 para no saturar
      const batchSize = 10
      for (let i = 0; i < idsToFetch.length; i += batchSize) {
        const batch = idsToFetch.slice(i, i + batchSize)
        await Promise.all(
          batch.map(async (publicId: string) => {
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
      }
      return statuses
    },
    enabled: idsToFetch.length > 0,
    staleTime: 2 * 60 * 1000, // Cache por 2 minutos
  })
  
  // Los filtros locales ya NO se aplican automáticamente
  // Solo se envían al servidor cuando se presiona "Buscar"
  // Los items vienen ya filtrados del servidor
  const paginatedItems = preSortedItems
  
  // sortedItems se usa para exportar - contiene los items de la página actual
  const sortedItems = preSortedItems

  // Usar paginación del servidor
  const totalFiltered = normalizedData.total
  const totalPages = normalizedData.totalPages || Math.max(1, Math.ceil(normalizedData.total / normalizedData.pageSize))
  const hasNextPage = normalizedData.hasNext
  const hasPrevPage = normalizedData.hasPrev

  const currentPage = normalizedData.page
  const startIndex = (currentPage - 1) * normalizedData.pageSize

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
                value={localFilters.search || ''}
                onChange={(e) => handleLocalFilterChange('search', e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="pl-9"
              />
            </div>

            <Select
              value={localFilters.status || 'all'}
              onValueChange={(v) => handleLocalFilterChange('status', v === 'all' ? undefined : v)}
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

            <Select
              value={bankFilter}
              onValueChange={handleBankFilterChange}
            >
              <SelectTrigger>
                <SelectValue placeholder="Datos pago" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="ready">Listo para pago</SelectItem>
                <SelectItem value="pending">Sin datos bancarios</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={insuranceTypeFilter}
              onValueChange={handleInsuranceTypeFilterChange}
            >
              <SelectTrigger>
                <SelectValue placeholder="Tipo Seguro" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los tipos</SelectItem>
                <SelectItem value="desgravamen">Desgravamen</SelectItem>
                <SelectItem value="cesantia">Cesantía</SelectItem>
                <SelectItem value="ambos">Ambos</SelectItem>
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
                  handleLocalDateRangeChange(hoy, hoy)
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
                  handleLocalDateRangeChange(ayerStr, ayerStr)
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
                  handleLocalDateRangeChange(toLocalDateString(semanaAtras), toLocalDateString(hoy))
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
                  handleLocalDateRangeChange(toLocalDateString(mesAtras), toLocalDateString(hoy))
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
                  value={localFilters.from || ''}
                  onChange={(e) => handleLocalFilterChange('from', e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Hasta</label>
                <Input
                  type="date"
                  value={localFilters.to || ''}
                  onChange={(e) => handleLocalFilterChange('to', e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Botones de acción */}
          <div className="flex items-center gap-2 pt-2">
            <Button onClick={handleSearch}>
              <Search className="h-4 w-4 mr-2" />
              Buscar
            </Button>
            <Button variant="outline" onClick={handleClearFilters}>
              <X className="h-4 w-4 mr-2" />
              Limpiar Filtros
            </Button>
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
                      <TableHead>Tipo Seguro</TableHead>
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
                      <TableHead className="text-right">Valor Nueva Prima</TableHead>
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
                      <TableRow key={refund.publicId || refund.id}>
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
                          {(() => {
                            const snapshot = (refund as any).calculationSnapshot
                            const insuranceToEvaluate = snapshot?.insuranceToEvaluate?.toUpperCase() || ''
                            
                            // Detectar cesantía: por insuranceToEvaluate o campos específicos
                            const isCesantia = insuranceToEvaluate === 'CESANTIA' || 
                              insuranceToEvaluate.includes('CESANT') ||
                              snapshot?.tipoSeguro?.toLowerCase() === 'cesantia'
                            
                            // Detectar desgravamen: por insuranceToEvaluate o campos específicos
                            const isDesgravamen = insuranceToEvaluate === 'DESGRAVAMEN' || 
                              insuranceToEvaluate.includes('DESGRAV') ||
                              snapshot?.tipoSeguro?.toLowerCase() === 'desgravamen'
                            
                            // Detectar ambos
                            const isBoth = insuranceToEvaluate === 'AMBOS' || 
                              insuranceToEvaluate.includes('BOTH') ||
                              (isCesantia && isDesgravamen)
                            
                            if (isBoth) {
                              return (
                                <div className="flex flex-col gap-1">
                                  <Badge variant="outline" className="bg-violet-500/15 text-violet-600 dark:text-violet-400 border-violet-500/30 text-xs">
                                    Desgravamen
                                  </Badge>
                                  <Badge variant="outline" className="bg-teal-500/15 text-teal-600 dark:text-teal-400 border-teal-500/30 text-xs">
                                    Cesantía
                                  </Badge>
                                </div>
                              )
                            } else if (isCesantia) {
                              return (
                                <Badge variant="outline" className="bg-teal-500/15 text-teal-600 dark:text-teal-400 border-teal-500/30 text-xs">
                                  Cesantía
                                </Badge>
                              )
                            } else {
                              return (
                                <Badge variant="outline" className="bg-violet-500/15 text-violet-600 dark:text-violet-400 border-violet-500/30 text-xs">
                                  Desgravamen
                                </Badge>
                              )
                            }
                          })()}
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
                                (entry: any) => {
                                  const toStatus = entry.to?.toLowerCase()
                                  return (toStatus === 'payment_scheduled' || toStatus === 'paid') && entry.realAmount
                                }
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
                        <TableCell className="text-right">
                          {(() => {
                            const snapshot = (refund as any).calculationSnapshot
                            const newMonthlyPremium = snapshot?.newMonthlyPremium || 0
                            const remainingInstallments = snapshot?.remainingInstallments || 0
                            const valorNuevaPrima = newMonthlyPremium * remainingInstallments
                            return valorNuevaPrima > 0 ? (
                              <span className="font-medium text-primary">
                                ${valorNuevaPrima.toLocaleString('es-CL')}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )
                          })()}
                        </TableCell>
                        <TableCell className="text-center">
                          {(refund as any).bankInfo ? (
                            <div className="flex items-center justify-center">
                              <div className="relative group">
                                <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 animate-pulse">
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
                        <TableCell className="text-sm">{getInstitutionDisplayName(refund.institutionId)}</TableCell>
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
                            onClick={() => navigate(`${detailBasePath}/${refund.publicId}`)}
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
                    key={refund.publicId || refund.id}
                    onClick={() => navigate(`${detailBasePath}/${refund.publicId}`)}
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
                        label: 'Tipo Seguro',
                        value: (() => {
                          const snapshot = (refund as any).calculationSnapshot
                          const insuranceToEvaluate = snapshot?.insuranceToEvaluate?.toUpperCase() || ''
                          
                          const isCesantia = insuranceToEvaluate === 'CESANTIA' || 
                            insuranceToEvaluate.includes('CESANT') ||
                            snapshot?.tipoSeguro?.toLowerCase() === 'cesantia'
                          
                          const isDesgravamen = insuranceToEvaluate === 'DESGRAVAMEN' || 
                            insuranceToEvaluate.includes('DESGRAV') ||
                            snapshot?.tipoSeguro?.toLowerCase() === 'desgravamen'
                          
                          const isBoth = insuranceToEvaluate === 'AMBOS' || 
                            insuranceToEvaluate.includes('BOTH') ||
                            (isCesantia && isDesgravamen)
                          
                          if (isBoth) {
                            return (
                              <div className="flex flex-wrap gap-1">
                                <Badge variant="outline" className="bg-violet-500/15 text-violet-600 dark:text-violet-400 border-violet-500/30 text-xs">
                                  Desgravamen
                                </Badge>
                                <Badge variant="outline" className="bg-teal-500/15 text-teal-600 dark:text-teal-400 border-teal-500/30 text-xs">
                                  Cesantía
                                </Badge>
                              </div>
                            )
                          } else if (isCesantia) {
                            return (
                              <Badge variant="outline" className="bg-teal-500/15 text-teal-600 dark:text-teal-400 border-teal-500/30 text-xs">
                                Cesantía
                              </Badge>
                            )
                          } else {
                            return (
                              <Badge variant="outline" className="bg-violet-500/15 text-violet-600 dark:text-violet-400 border-violet-500/30 text-xs">
                                Desgravamen
                              </Badge>
                            )
                          }
                        })()
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
                              (entry: any) => {
                                const toStatus = entry.to?.toLowerCase()
                                return (toStatus === 'payment_scheduled' || toStatus === 'paid') && entry.realAmount
                              }
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
                        label: 'Valor Nueva Prima',
                        value: (() => {
                          const snapshot = (refund as any).calculationSnapshot
                          const newMonthlyPremium = snapshot?.newMonthlyPremium || 0
                          const remainingInstallments = snapshot?.remainingInstallments || 0
                          const valorNuevaPrima = newMonthlyPremium * remainingInstallments
                          return valorNuevaPrima > 0 ? (
                            <span className="font-medium text-primary">
                              ${valorNuevaPrima.toLocaleString('es-CL')}
                            </span>
                          ) : '-'
                        })()
                      },
                      {
                        label: 'Datos pago',
                        value: (refund as any).bankInfo ? (
                          <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 animate-pulse">
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
                        value: getInstitutionDisplayName(refund.institutionId)
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
                    Página {currentPage} de {totalPages} ({totalFiltered} solicitudes)
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!hasPrevPage}
                      onClick={() => handlePageChange(currentPage - 1)}
                    >
                      Anterior
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!hasNextPage}
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
