import { useState, useEffect, useMemo, useCallback } from 'react'
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
import { Switch } from '@/components/ui/switch'
import { Search, Filter, RotateCw, X, Copy, Check, ArrowUpDown, ArrowUp, ArrowDown, CheckCircle, AlertCircle, Flag, Clock, Info, ArrowRightLeft } from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { GenerateExcelDialog } from './components/GenerateExcelDialog'
import { ExportToExcelDialog } from './components/ExportToExcelDialog'
import { MobileCard } from '@/components/common/MobileCard'
import { useIsMobile } from '@/hooks/use-mobile'
import { getInstitutionDisplayName } from '@/lib/institutionHomologation'
import { AllianceCombobox } from './components/AllianceCombobox'

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

// Obtener el estado que tenía una solicitud en una fecha específica
const getStatusAtDate = (refund: any, dateStr: string): RefundStatus | null => {
  if (!refund.statusHistory || !Array.isArray(refund.statusHistory) || refund.statusHistory.length === 0) {
    return refund.status // fallback al estado actual
  }

  // Convertir la fecha límite al final del día
  const limitDate = new Date(dateStr + 'T23:59:59.999Z')

  // Filtrar entradas hasta la fecha indicada y tomar la última
  const entriesBeforeDate = refund.statusHistory
    .filter((entry: any) => new Date(entry.at) <= limitDate)
    .sort((a: any, b: any) => new Date(a.at).getTime() - new Date(b.at).getTime())

  if (entriesBeforeDate.length === 0) return null // no existía aún

  const lastEntry = entriesBeforeDate[entriesBeforeDate.length - 1]
  return (lastEntry.to?.toLowerCase() || refund.status) as RefundStatus
}

// Verificar si una solicitud estuvo en un estado dado durante un rango de fechas
// Recorre el statusHistory y determina si el estado objetivo se mantuvo activo
// en algún momento dentro de [fromStr, toStr]
const wasInStatusDuringRange = (refund: any, targetStatus: RefundStatus, fromStr: string, toStr: string): boolean => {
  if (!refund.statusHistory || !Array.isArray(refund.statusHistory) || refund.statusHistory.length === 0) {
    // Sin historial: comparar con el estado actual
    return refund.status === targetStatus
  }

  const rangeStart = new Date(fromStr + 'T00:00:00.000Z').getTime()
  const rangeEnd = new Date(toStr + 'T23:59:59.999Z').getTime()

  // Ordenar historial cronológicamente
  const sorted = [...refund.statusHistory]
    .sort((a: any, b: any) => new Date(a.at).getTime() - new Date(b.at).getTime())

  // Construir intervalos: cada entrada define un período en el estado "to"
  // desde entry.at hasta la siguiente entrada (o hasta ahora si es la última)
  for (let i = 0; i < sorted.length; i++) {
    const entry = sorted[i]
    const entryStatus = (entry.to?.toLowerCase() || '') as string
    if (entryStatus !== targetStatus) continue

    const statusStart = new Date(entry.at).getTime()
    const statusEnd = i < sorted.length - 1
      ? new Date(sorted[i + 1].at).getTime()
      : Date.now() // sigue en ese estado

    // Verificar si el intervalo [statusStart, statusEnd] se solapa con [rangeStart, rangeEnd]
    if (statusStart <= rangeEnd && statusEnd >= rangeStart) {
      return true
    }
  }

  return false
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
  const isCallCenter = detailBasePath === '/gestion-callcenter'
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
  const [allianceFilter, setAllianceFilter] = useState<string>(searchParams.get('alliance') || 'all')

  // Filtros locales "aplicados" - solo se actualizan al presionar Buscar
  const [appliedLocalFilters, setAppliedLocalFilters] = useState({
    origin: searchParams.get('origin') || 'all',
    bank: searchParams.get('bank') || 'all',
    insuranceType: searchParams.get('insuranceType') || 'all',
    alliance: searchParams.get('alliance') || 'all',
  })

  const [copiedField, setCopiedField] = useState<string | null>(null)
  const [historicalStatusMode, setHistoricalStatusMode] = useState(false)
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
    queryFn: async () => {
      // En modo histórico, paginar para obtener todos los resultados (max 100 por página)
      if (searchFilters.limit === 100 && historicalStatusMode) {
        // Primera petición para obtener el total
        const firstPage = await refundAdminApi.search({ ...searchFilters, page: 1, limit: 100 })
        if (firstPage.total <= 100) return firstPage
        
        // Calcular páginas restantes y obtener en paralelo (lotes de 5)
        const totalPages = Math.ceil(firstPage.total / 100)
        const remainingPages = Array.from({ length: totalPages - 1 }, (_, i) => i + 2)
        let allItems = [...firstPage.items]
        
        const BATCH_SIZE = 5
        for (let i = 0; i < remainingPages.length; i += BATCH_SIZE) {
          const batch = remainingPages.slice(i, i + BATCH_SIZE)
          const results = await Promise.all(
            batch.map(page => refundAdminApi.search({ ...searchFilters, page, limit: 100 }))
          )
          results.forEach(r => allItems = allItems.concat(r.items))
        }
        
        return { ...firstPage, items: allItems, total: firstPage.total, page: 1, pageSize: allItems.length, totalPages: 1, hasNext: false, hasPrev: false }
      }
      return refundAdminApi.search(searchFilters)
    },
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
    // isPartner: 0 = directo (sin partnerId), 1 = alianza (con partnerId)
    let isPartnerValue: 0 | 1 | undefined = undefined
    if (allianceFilter !== 'all') {
      // Si se seleccionó una alianza específica, forzar isPartner=1
      isPartnerValue = 1
    } else if (originFilter === 'directo') {
      isPartnerValue = 0
    } else if (originFilter === 'alianza') {
      isPartnerValue = 1
    }
    
    // hasBankInfo: 1 = con datos bancarios (Listo), 0 = sin datos bancarios (Pendiente)
    let hasBankInfoValue: 0 | 1 | undefined = undefined
    if (bankFilter === 'ready') {
      hasBankInfoValue = 1
    } else if (bankFilter === 'pending') {
      hasBankInfoValue = 0
    }
    
    const newSearchFilters: SearchParams = {
      q: localFilters.search || undefined,
      // En modo histórico, NO enviamos el status al servidor para traer todas las solicitudes
      // y filtrar localmente por el estado que tenían en la fecha seleccionada
      status: historicalStatusMode ? undefined : (localFilters.status || undefined),
      sort: 'recent', // Por defecto más recientes
      from: localFilters.from || undefined,
      to: localFilters.to || undefined,
      page: 1,
      // En modo histórico pedimos más resultados ya que filtraremos localmente
      limit: historicalStatusMode ? 100 : (filters.pageSize || 20),
      signatureStatus: signatureStatusValue,
      insuranceToEvaluate: insuranceTypeFilter !== 'all' ? insuranceTypeFilter.toUpperCase() : undefined,
      isPartner: isPartnerValue,
      hasBankInfo: hasBankInfoValue,
      partnerId: allianceFilter !== 'all' ? allianceFilter : undefined,
    }
    
    setSearchFilters(newSearchFilters)
    setUseSearchEndpoint(true)
    
    // Guardar filtros locales aplicados (los que no soporta el servidor)
    setAppliedLocalFilters({
      origin: originFilter,
      bank: bankFilter,
      insuranceType: insuranceTypeFilter,
      alliance: allianceFilter,
    })
    
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
    if (allianceFilter !== 'all') params.set('alliance', allianceFilter)
    params.set('page', '1')
    setSearchParams(params)
  }

  const handlePageChange = (newPage: number) => {
    if (historicalStatusMode) {
      // En modo histórico, paginación local
      setHistoricalPage(newPage)
      return
    }
    
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
    setAllianceFilter('all')
    setHistoricalStatusMode(false)
    setAppliedLocalFilters({
      origin: 'all',
      bank: 'all',
      insuranceType: 'all',
      alliance: 'all',
    })
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

  // Auto-ejecutar búsqueda si viene con autoSearch=true desde Operación
  useEffect(() => {
    const autoSearch = searchParams.get('autoSearch')
    if (autoSearch === 'true') {
      // Pequeño delay para asegurar que los estados locales estén sincronizados
      const timer = setTimeout(() => {
        handleSearch()
        // Remover autoSearch de la URL para evitar re-ejecuciones
        const newParams = new URLSearchParams(searchParams)
        newParams.delete('autoSearch')
        setSearchParams(newParams, { replace: true })
      }, 100)
      return () => clearTimeout(timer)
    }
  }, []) // Solo al montar

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
  
  // Aplicar filtros locales que el servidor no soporta (usando valores aplicados al presionar Buscar)
  const locallyFilteredItems = useMemo(() => {
    let result = preSortedItems
    
    // Filtro de banco (no soportado por servidor)
    if (appliedLocalFilters.bank !== 'all') {
      result = appliedLocalFilters.bank === 'ready'
        ? result.filter((r: any) => r.bankInfo)
        : result.filter((r: any) => !r.bankInfo)
    }
    
    // Filtro de alianza específica (backend no soporta partnerId, solo isPartner)
    if (appliedLocalFilters.alliance !== 'all') {
      result = result.filter((r: any) => r.partnerId === appliedLocalFilters.alliance)
    }
    
    // En modo histórico, filtrar por solicitudes que estuvieron en el estado seleccionado
    // durante el rango de fechas [from, to]
    if (historicalStatusMode && localFilters.status) {
      const fromDate = localFilters.from || '2000-01-01'
      const toDate = localFilters.to || toLocalDateString(new Date())
      result = result.filter((r: any) => wasInStatusDuringRange(r, localFilters.status!, fromDate, toDate))
    }
    
    return result
  }, [preSortedItems, appliedLocalFilters, historicalStatusMode, localFilters.to, localFilters.status])
  
  // Estado para paginación local en modo histórico
  const [historicalPage, setHistoricalPage] = useState(1)
  const historicalPageSize = filters.pageSize || 20

  // Reset página histórica cuando cambian los filtros
  useEffect(() => {
    setHistoricalPage(1)
  }, [locallyFilteredItems.length])

  // En modo histórico, paginar localmente; en modo normal, usar datos del servidor
  const paginatedItems = useMemo(() => {
    if (historicalStatusMode) {
      const start = (historicalPage - 1) * historicalPageSize
      return locallyFilteredItems.slice(start, start + historicalPageSize)
    }
    return locallyFilteredItems
  }, [locallyFilteredItems, historicalStatusMode, historicalPage, historicalPageSize])
  
  // sortedItems para exportar - en modo histórico contiene TODOS los items filtrados (no paginados)
  const sortedItems = historicalStatusMode ? locallyFilteredItems : locallyFilteredItems

  // Usar paginación del servidor, pero en modo histórico el total es local
  const totalFiltered = historicalStatusMode ? locallyFilteredItems.length : normalizedData.total
  const totalPages = historicalStatusMode 
    ? Math.max(1, Math.ceil(locallyFilteredItems.length / historicalPageSize))
    : (normalizedData.totalPages || Math.max(1, Math.ceil(normalizedData.total / normalizedData.pageSize)))
  const hasNextPage = historicalStatusMode ? historicalPage < totalPages : normalizedData.hasNext
  const hasPrevPage = historicalStatusMode ? historicalPage > 1 : normalizedData.hasPrev

  const currentPage = historicalStatusMode ? historicalPage : normalizedData.page
  const startIndex = (currentPage - 1) * (historicalStatusMode ? historicalPageSize : normalizedData.pageSize)

  // Helper: obtener el estado a mostrar según el modo (actual o histórico)
  const getDisplayStatus = useCallback((refund: any): RefundStatus => {
    if (!historicalStatusMode || !localFilters.to) return refund.status
    const historical = getStatusAtDate(refund, localFilters.to)
    return historical || refund.status
  }, [historicalStatusMode, localFilters.to])

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
                selectedRefunds={selectedRefunds}
                searchFilters={useSearchEndpoint ? searchFilters : undefined}
                listFilters={!useSearchEndpoint ? filters : undefined}
                useSearchEndpoint={useSearchEndpoint}
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

            <AllianceCombobox
              value={allianceFilter}
              onChange={setAllianceFilter}
              partners={partnersData?.items || []}
            />
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
            {/* Toggle Estado en fecha */}
            <div className="flex items-center gap-3 pt-1">
              <div className="flex items-center gap-2">
                <Switch
                  id="historical-status"
                  checked={historicalStatusMode}
                  onCheckedChange={setHistoricalStatusMode}
                  disabled={!localFilters.to}
                />
                <label
                  htmlFor="historical-status"
                  className={`flex items-center gap-1.5 text-sm cursor-pointer select-none ${
                    historicalStatusMode ? 'text-foreground font-medium' : 'text-muted-foreground'
                  }`}
                >
                  <Clock className="h-3.5 w-3.5" />
                  Estado en fecha
                </label>
              </div>
              {historicalStatusMode && (
                <span className="text-xs text-muted-foreground">
                  Mostrando el estado que tenían las solicitudes en la fecha seleccionada
                </span>
              )}
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

      {/* Banner modo histórico */}
      {historicalStatusMode && (
        <div className="flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/40 px-4 py-3 animate-fade-in">
          <div className="flex items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900 p-1.5">
            <Clock className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-blue-900 dark:text-blue-200">
              Modo histórico activo
            </p>
            <p className="text-xs text-blue-700 dark:text-blue-400">
              La columna "Estado" muestra el estado que tenía cada solicitud al {localFilters.to ? new Date(localFilters.to + 'T12:00:00').toLocaleDateString('es-CL') : 'la fecha seleccionada'}. 
              Si difiere del actual, verás un ícono <ArrowRightLeft className="inline h-3 w-3" />.
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200 shrink-0"
            onClick={() => setHistoricalStatusMode(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

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
                      {isCallCenter && (
                        <TableHead>Fecha Docs Pendientes</TableHead>
                      )}
                      {isCallCenter && (
                        <TableHead>Fecha Docs Recibidos</TableHead>
                      )}
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
                          {(() => {
                            const displayStatus = getDisplayStatus(refund)
                            return (
                              <div className="flex items-center gap-1.5">
                                <Badge className={getStatusColors(displayStatus)}>
                                  {statusLabels[displayStatus] || displayStatus}
                                </Badge>
                                {historicalStatusMode && localFilters.status && refund.status !== localFilters.status && (
                                  <span title={`Estado actual: ${statusLabels[refund.status]}`}>
                                    <ArrowRightLeft className="h-3.5 w-3.5 text-muted-foreground" />
                                  </span>
                                )}
                              </div>
                            )
                          })()}
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
                        {isCallCenter && (
                          <TableCell className="text-sm">
                            {(() => {
                              const docsPendingEntry = refund.statusHistory
                                ?.filter((entry: any) => (entry.to || '').toLowerCase() === 'docs_pending' || (entry.status || '').toLowerCase() === 'docs_pending')
                                .sort((a: any, b: any) => new Date(b.at).getTime() - new Date(a.at).getTime())[0]
                              if (!docsPendingEntry) return <span className="text-muted-foreground">-</span>
                              return new Date(docsPendingEntry.at).toLocaleString('es-CL', {
                                dateStyle: 'short',
                                timeStyle: 'short'
                              })
                            })()}
                          </TableCell>
                        )}
                        {isCallCenter && (
                          <TableCell className="text-sm">
                            {(() => {
                              const docsReceivedEntry = refund.statusHistory
                                ?.filter((entry: any) => (entry.to || '').toLowerCase() === 'docs_received' || (entry.status || '').toLowerCase() === 'docs_received')
                                .sort((a: any, b: any) => new Date(b.at).getTime() - new Date(a.at).getTime())[0]
                              if (!docsReceivedEntry) return <span className="text-muted-foreground">-</span>
                              return new Date(docsReceivedEntry.at).toLocaleString('es-CL', {
                                dateStyle: 'short',
                                timeStyle: 'short'
                              })
                            })()}
                          </TableCell>
                        )}
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
                        value: (() => {
                          const displayStatus = getDisplayStatus(refund)
                          return (
                            <div className="flex items-center gap-1.5">
                              <Badge className={getStatusColors(displayStatus)}>
                                {statusLabels[displayStatus] || displayStatus}
                              </Badge>
                              {historicalStatusMode && localFilters.status && refund.status !== localFilters.status && (
                                <ArrowRightLeft className="h-3 w-3 text-muted-foreground" />
                              )}
                            </div>
                          )
                        })()
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
