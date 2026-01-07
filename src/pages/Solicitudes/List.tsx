import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { solicitudesService } from '@/services/solicitudesService'
import { refundAdminApi } from '@/services/refundAdminApi'
import { authenticatedFetch } from '@/services/apiClient'

import { DataGrid, Column } from '@/components/datagrid/DataGrid'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Money } from '@/components/common/Money'
import { useToast } from '@/hooks/use-toast'
import { exportCSV, exportXLSX } from '@/services/reportesService'
import { useMemo, useState } from 'react'
import { getInstitutionDisplayName } from '@/lib/institutionHomologation'
import { RefundStatus } from '@/types/refund'
import { CheckCircle, AlertCircle, Flag, Copy, CalendarIcon, X } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { cn } from '@/lib/utils'

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

export default function SolicitudesList() {
  const [searchParams] = useSearchParams()
  const alianzaIdFilter = searchParams.get('alianzaId')
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { toast } = useToast()

  // Estados para filtros
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [firmaFilter, setFirmaFilter] = useState<string>('all')
  const [dateFrom, setDateFrom] = useState<Date | undefined>()
  const [dateTo, setDateTo] = useState<Date | undefined>()

  // Si hay partnerId, usar el endpoint real, sino usar mock local
  const { data: partnerData = [], isLoading: isLoadingPartner } = useQuery({
    queryKey: ['partner-solicitudes', alianzaIdFilter],
    queryFn: () => refundAdminApi.listByPartner(alianzaIdFilter!),
    enabled: !!alianzaIdFilter,
  })

  const { data: mockData = [], isLoading: isLoadingMock } = useQuery({
    queryKey: ['solicitudes'],
    queryFn: () => solicitudesService.list(),
    enabled: !alianzaIdFilter,
  })

  const rawData = alianzaIdFilter ? partnerData : mockData
  const isLoading = alianzaIdFilter ? isLoadingPartner : isLoadingMock

  // Query para obtener nombre de la alianza
  const { data: alianzaData } = useQuery({
    queryKey: ['alianza-detail', alianzaIdFilter],
    queryFn: async () => {
      const response = await authenticatedFetch(`/partners/${alianzaIdFilter}`)
      if (response.ok) {
        const data = await response.json()
        return { nombre: data.name || data.nombre }
      }
      return null
    },
    enabled: !!alianzaIdFilter,
  })

  // Helper para copiar al portapapeles
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast({ title: 'Copiado', description: 'ID copiado al portapapeles' })
  }

  // Render genérico para campos copiables
  const renderCopyable = (value: string, truncate?: number) => {
    if (!value) return <span className="text-muted-foreground">-</span>
    const displayValue = truncate && value.length > truncate ? `${value.slice(0, truncate)}...` : value
    return (
      <button
        onClick={(e) => {
          e.stopPropagation()
          copyToClipboard(value)
        }}
        className="flex items-center gap-1 text-xs hover:text-primary transition-colors group text-left"
        title={`Copiar: ${value}`}
      >
        <span className="truncate max-w-[150px]">{displayValue}</span>
        <Copy className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
      </button>
    )
  }

  // Renders específicos usando el helper genérico
  const renderCopyableId = (r: any) => renderCopyable(r.publicId || r.id, 8)
  const renderCopyableCliente = (r: any) => renderCopyable(r.fullName || '')
  const renderCopyableRut = (r: any) => renderCopyable(r.rut || '')
  const renderCopyableEmail = (r: any) => renderCopyable(r.email || '')

  // Query para obtener estados de mandatos (firma) cuando hay filtro de alianza
  const publicIds = useMemo(() => {
    if (!alianzaIdFilter || !partnerData.length) return []
    return partnerData.map((r: any) => r.publicId)
  }, [alianzaIdFilter, partnerData])

  const { data: mandateStatuses } = useQuery({
    queryKey: ['mandate-statuses-alianza', publicIds],
    queryFn: async () => {
      const statuses: Record<string, any> = {}
      await Promise.all(
        publicIds.map(async (publicId: string) => {
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
    enabled: publicIds.length > 0,
  })

  // Filtrar datos según los filtros aplicados
  const data = useMemo(() => {
    let filtered = [...rawData]

    // Filtro por estado
    if (statusFilter !== 'all') {
      filtered = filtered.filter((r: any) => r.status === statusFilter)
    }

    // Filtro por firma (solo si hay mandateStatuses)
    if (firmaFilter !== 'all' && mandateStatuses) {
      filtered = filtered.filter((r: any) => {
        const hasSigned = mandateStatuses[r.publicId]?.hasSignedPdf === true
        return firmaFilter === 'firmado' ? hasSigned : !hasSigned
      })
    }

    // Filtro por fecha desde
    if (dateFrom) {
      filtered = filtered.filter((r: any) => {
        const itemDate = new Date(r.updatedAt || r.createdAt)
        return itemDate >= dateFrom
      })
    }

    // Filtro por fecha hasta
    if (dateTo) {
      const endOfDay = new Date(dateTo)
      endOfDay.setHours(23, 59, 59, 999)
      filtered = filtered.filter((r: any) => {
        const itemDate = new Date(r.updatedAt || r.createdAt)
        return itemDate <= endOfDay
      })
    }

    return filtered
  }, [rawData, statusFilter, firmaFilter, dateFrom, dateTo, mandateStatuses])

  // Limpiar filtros
  const clearFilters = () => {
    setStatusFilter('all')
    setFirmaFilter('all')
    setDateFrom(undefined)
    setDateTo(undefined)
  }

  const hasActiveFilters = statusFilter !== 'all' || firmaFilter !== 'all' || dateFrom || dateTo

  // Query para obtener nombres de gestores cuando hay filtro de alianza
  const { data: gestorNameMap = {} } = useQuery({
    queryKey: ['gestor-names-alianza', alianzaIdFilter],
    queryFn: async () => {
      const allUsers: Record<string, string> = {}
      try {
        const response = await authenticatedFetch(
          `/partner-users?partnerId=${alianzaIdFilter}&limit=100`
        )
        if (response.ok) {
          const data = await response.json()
          // Mapear tanto _id como publicId para cubrir diferentes formatos
          ;(data.items || []).forEach((user: any) => {
            if (user._id) allUsers[user._id] = user.name
            if (user.publicId) allUsers[user.publicId] = user.name
            if (user.id) allUsers[user.id] = user.name
          })
        }
      } catch (error) {
        // Silently fail
      }
      return allUsers
    },
    enabled: !!alianzaIdFilter,
    staleTime: 30 * 60 * 1000,
  })

  // Render del estado con Badge
  const renderStatus = (r: any) => {
    const status = r.status as RefundStatus
    const label = statusLabels[status] || status
    return (
      <Badge className={getStatusColors(status)}>
        {label}
      </Badge>
    )
  }

  // Render del indicador de firma
  const renderFirma = (r: any) => {
    const status = mandateStatuses?.[r.publicId]
    const hasSigned = status?.hasSignedPdf === true
    return hasSigned ? (
      <span className="inline-flex items-center gap-1 text-green-600" title="Mandato firmado">
        <CheckCircle className="h-4 w-4" />
        <span className="text-xs">Firmado</span>
      </span>
    ) : (
      <span className="inline-flex items-center gap-1 text-muted-foreground" title="Pendiente de firma">
        <AlertCircle className="h-4 w-4" />
        <span className="text-xs">Pendiente</span>
      </span>
    )
  }

  // Render de datos bancarios (Pago)
  const renderPago = (r: any) => {
    const hasBankInfo = !!(r as any).bankInfo
    return hasBankInfo ? (
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
    )
  }

  // Render del gestor
  const renderGestor = (r: any) => {
    if (r.partnerUserId && gestorNameMap[r.partnerUserId]) {
      return <span className="text-xs">{gestorNameMap[r.partnerUserId]}</span>
    }
    return <span className="text-xs text-muted-foreground">-</span>
  }

  const columns: Column<any>[] = useMemo(() => {
    if (alianzaIdFilter) {
      // Columnas para datos del API real (partner refunds)
      return [
        { key: 'publicId', header: 'ID', render: renderCopyableId, sortable: true },
        { key: 'fullName', header: 'Cliente', render: renderCopyableCliente, sortable: true },
        { key: 'rut', header: 'RUT', render: renderCopyableRut, sortable: true },
        { key: 'email', header: 'Email', render: renderCopyableEmail, sortable: true },
        { key: 'status', header: 'Estado', render: renderStatus, sortable: true },
        { key: 'firma', header: 'Firma', render: renderFirma },
        { key: 'pago', header: 'Pago', render: renderPago },
        { key: 'gestor', header: 'Gestor', render: renderGestor },
        { key: 'institutionId', header: 'Institución', render: (r: any) => getInstitutionDisplayName(r.institutionId), sortable: true },
        { key: 'estimatedAmountCLP', header: 'Estimado', render: (r: any) => <Money value={r.estimatedAmountCLP} />, sortable: true },
        { key: 'updatedAt', header: 'Actualizado', render: (r: any) => new Date(r.updatedAt).toLocaleDateString('es-CL'), sortable: true },
        { key: 'acciones', header: 'Acciones', render: (r: any) => <Button size="sm" variant="outline" onClick={() => navigate(`/refunds/${r._id || r.id || r.publicId}`, { state: { backUrl: `/solicitudes?alianzaId=${alianzaIdFilter}` } })}>Abrir</Button> },
      ]
    } else {
      // Columnas para datos mock locales
      return [
        { key: 'id', header: 'ID', sortable: true },
        { key: 'cliente', header: 'Cliente', render: (r: any) => r.cliente?.nombre, sortable: true },
        { key: 'estado', header: 'Estado', sortable: true },
        { key: 'alianzaId', header: 'Alianza', sortable: true },
        { key: 'montoADevolverEstimado', header: 'Estimado', render: (r: any) => <Money value={r.montoADevolverEstimado} />, sortable: true },
        { key: 'updatedAt', header: 'Actualizado', render: (r: any) => new Date(r.updatedAt).toLocaleDateString('es-CL'), sortable: true },
        { key: 'origen', header: 'Origen', render: (r: any) => r.partnerId ? (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">Alianza</span>
        ) : (
          <span className="text-muted-foreground text-xs">Directo</span>
        )},
        { key: 'acciones', header: 'Acciones', render: (r: any) => <Button size="sm" variant="outline" onClick={() => navigate(`/solicitudes/${r.id}`)}>Abrir</Button> },
      ]
    }
  }, [alianzaIdFilter, navigate, mandateStatuses, gestorNameMap])

  const crear = async () => {
    const base = {
      cliente: { rut: '11.111.111-1', nombre: 'Nuevo Cliente', email: 'nc@example.com', banco: 'Banco B', edad: 30 },
      credito: { monto: 1000000, cuotasTotales: 24, cuotasPendientes: 20, tipoSeguro: 'CESANTIA' as const },
      estado: 'SIMULACION_CONFIRMADA' as const,
      montoADevolverEstimado: 50000,
    }
    await solicitudesService.create(base as any)
    toast({ title: 'Solicitud creada' })
    qc.invalidateQueries({ queryKey: ['solicitudes'] })
  }

  // Preparar datos para exportación con campos adicionales (usa datos filtrados)
  const prepareExportData = () => {
    return data.map((item: any) => {
      const calc = item.calculationSnapshot || {}
      const primaMensualActual = calc.currentMonthlyPremium || 0
      const nuevaPrimaMensual = calc.newMonthlyPremium || 0
      const cuotasRestantes = calc.remainingInstallments || 0
      const hasSigned = mandateStatuses?.[item.publicId]?.hasSignedPdf === true
      const hasBankInfo = !!(item as any).bankInfo
      
      return {
        ID: item.publicId || item.id,
        Cliente: item.fullName || item.cliente?.nombre || '',
        RUT: item.rut || item.cliente?.rut || '',
        Email: item.email || item.cliente?.email || '',
        Estado: statusLabels[item.status as RefundStatus] || item.status || item.estado || '',
        Firma: hasSigned ? 'Firmado' : 'Pendiente',
        Pago: hasBankInfo ? 'Listo' : 'Pendiente',
        Gestor: gestorNameMap[item.partnerUserId] || '-',
        Institucion: getInstitutionDisplayName(item.institutionId || item.cliente?.banco),
        'Prima Mensual Entidad Financiera': primaMensualActual,
        'Monto Estimado Devolucion': item.estimatedAmountCLP || item.montoADevolverEstimado || 0,
        'Saldo Asegurado Promedio': nuevaPrimaMensual * cuotasRestantes,
        'Costo Nuevo Seguro TDV': nuevaPrimaMensual,
        'Cuotas Restantes': cuotasRestantes,
        'Fecha Creacion': item.createdAt ? new Date(item.createdAt).toLocaleDateString('es-CL') : '',
        'Fecha Actualizacion': item.updatedAt ? new Date(item.updatedAt).toLocaleDateString('es-CL') : '',
      }
    })
  }

  const getExportFileName = (ext: string) => {
    const base = alianzaIdFilter ? `solicitudes_alianza` : 'solicitudes'
    const suffix = hasActiveFilters ? '_filtrado' : ''
    return `${base}${suffix}.${ext}`
  }

  const exportarCSV = () => exportCSV(prepareExportData(), getExportFileName('csv'))
  const exportarXLSX = () => exportXLSX(prepareExportData(), getExportFileName('xlsx'))

  return (
    <main className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Solicitudes</h1>
        {alianzaIdFilter && (
          <Button variant="outline" size="sm" onClick={() => navigate('/solicitudes')}>
            Ver todas
          </Button>
        )}
      </div>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            {alianzaIdFilter ? (
              <>
                <span>Solicitudes de {alianzaData?.nombre || 'alianza'}</span>
                <button
                  onClick={() => copyToClipboard(alianzaIdFilter)}
                  className="flex items-center gap-1 text-xs font-mono text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded bg-muted/50"
                  title={`Copiar ID: ${alianzaIdFilter}`}
                >
                  <span>{alianzaIdFilter.slice(0, 8)}...</span>
                  <Copy className="h-3 w-3" />
                </button>
              </>
            ) : 'Listado maestro'}
          </CardTitle>
          <div className="flex gap-2">
            <Button variant="soft" onClick={exportarCSV}>Exportar CSV</Button>
            <Button variant="soft" onClick={exportarXLSX}>Exportar XLSX</Button>
            <Button variant="hero" onClick={crear}>Nueva solicitud</Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filtros - solo mostrar cuando hay filtro de alianza */}
          {alianzaIdFilter && (
            <div className="flex flex-wrap items-center gap-3 p-3 bg-muted/30 rounded-lg">
              {/* Filtro de Estado */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Estado:</span>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[180px] h-9">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {Object.entries(statusLabels).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Filtro de Firma */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Firma:</span>
                <Select value={firmaFilter} onValueChange={setFirmaFilter}>
                  <SelectTrigger className="w-[140px] h-9">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="firmado">Firmado</SelectItem>
                    <SelectItem value="pendiente">Pendiente</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Filtro Fecha Desde */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Desde:</span>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-[140px] h-9 justify-start text-left font-normal",
                        !dateFrom && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dateFrom ? format(dateFrom, "dd/MM/yyyy") : "Fecha"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dateFrom}
                      onSelect={setDateFrom}
                      initialFocus
                      locale={es}
                      className="p-3 pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Filtro Fecha Hasta */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Hasta:</span>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-[140px] h-9 justify-start text-left font-normal",
                        !dateTo && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dateTo ? format(dateTo, "dd/MM/yyyy") : "Fecha"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dateTo}
                      onSelect={setDateTo}
                      initialFocus
                      locale={es}
                      className="p-3 pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Botón limpiar filtros */}
              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearFilters}
                  className="h-9 px-2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4 mr-1" />
                  Limpiar
                </Button>
              )}

              {/* Contador de resultados */}
              <span className="text-sm text-muted-foreground ml-auto">
                {data.length} de {rawData.length} solicitudes
              </span>
            </div>
          )}

          {isLoading ? 'Cargando...' : <DataGrid data={data} columns={columns} />}
        </CardContent>
      </Card>
    </main>
  )
}
