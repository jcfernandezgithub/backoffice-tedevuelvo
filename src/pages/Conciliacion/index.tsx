import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Calendar as CalendarUI } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Loader2,
  RotateCw,
  AlertTriangle,
  Building2,
  Calendar,
  Link2,
  CheckCircle2,
  Search,
  X,
  FileSpreadsheet,
} from 'lucide-react'
import { downloadCartolaXml, type CartolaMovimiento } from './services/cartolaService'
import { cartolaLinksService } from './services/cartolaLinksService'
import {
  LinkRefundsDialog,
  type CartolaMovementRef,
} from './components/LinkRefundsDialog'
import {
  IndividualCsvReconcileDialog,
  type MovementCandidate,
} from './components/IndividualCsvReconcileDialog'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { toast } from '@/hooks/use-toast'

function toNumber(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  if (typeof v === 'number') return isNaN(v) ? null : v
  const s = String(v).trim().replace(/\./g, '').replace(',', '.')
  if (s === '') return null
  const n = Number(s)
  return isNaN(n) ? null : n
}

function fmtCLP(v: unknown, opts: { showZero?: boolean } = {}): string {
  const n = toNumber(v)
  if (n === null) return '—'
  if (n === 0 && !opts.showZero) return '—'
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(n)
}

function fmtDate(v: unknown): string {
  if (!v) return '—'
  const s = String(v)
  const dmy = s.match(/^(\d{2})-(\d{2})-(\d{4})/)
  if (dmy) return `${dmy[1]}/${dmy[2]}/${dmy[3]}`
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`
  return s
}

// Convierte DD-MM-YYYY (o ISO) a Date sin sesgo de zona horaria.
function parseMovDate(v: unknown): Date | null {
  if (!v) return null
  const s = String(v)
  const dmy = s.match(/^(\d{2})-(\d{2})-(\d{4})/)
  if (dmy) return new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]))
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]))
  return null
}

function sameDate(a?: Date, b?: Date): boolean {
  if (!a || !b) return false
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

const LAST_UPDATED_KEY = 'cartola-last-updated-at'

function formatLastUpdated(iso: string | null): string {
  if (!iso) return 'Sin actualizar'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return 'Sin actualizar'
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMins = Math.round(diffMs / 60_000)
  if (diffMins < 1) return 'Actualizado hace un momento'
  if (diffMins < 60) return `Actualizado hace ${diffMins} min${diffMins === 1 ? '' : 's'}`
  const diffHours = Math.round(diffMins / 60)
  if (diffHours < 24) return `Actualizado hace ${diffHours} hora${diffHours === 1 ? '' : 's'}`
  return `Actualizado el ${format(d, 'dd/MM/yyyy HH:mm', { locale: es })}`
}

export default function ConciliacionPage() {
  const qc = useQueryClient()
  const today = useMemo(() => new Date(), [])
  const monthStart = useMemo(
    () => new Date(today.getFullYear(), today.getMonth(), 1),
    [today],
  )
  const [draftFrom, setDraftFrom] = useState<Date | undefined>(monthStart)
  const [draftTo, setDraftTo] = useState<Date | undefined>(today)
  const [committedFrom, setCommittedFrom] = useState<Date | undefined>(monthStart)
  const [committedTo, setCommittedTo] = useState<Date | undefined>(today)

  const toIsoDate = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

  const rangeReady = !!committedFrom && !!committedTo
  const rangeFromIso = committedFrom ? toIsoDate(committedFrom) : ''
  const rangeToIso = committedTo ? toIsoDate(committedTo) : ''
  const datesChanged = !sameDate(draftFrom, committedFrom) || !sameDate(draftTo, committedTo)

  const query = useQuery({
    queryKey: ['cartola', 'xml', rangeFromIso, rangeToIso],
    queryFn: () => downloadCartolaXml({ from: rangeFromIso, to: rangeToIso }),
    enabled: rangeReady,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    retry: false,
  })

  const cartola = query.data?.data
  const movimientos: CartolaMovimiento[] = useMemo(() => {
    const raw = cartola?.movimientos?.movimiento
    if (!raw) return []
    return Array.isArray(raw) ? raw : [raw]
  }, [cartola])

  // Solo abonos (ignoramos cargos)
  const abonos = useMemo(
    () => movimientos.filter((m) => (toNumber(m.abono) ?? 0) > 0),
    [movimientos],
  )

  // Filtros
  const [search, setSearch] = useState('')
  const [dateFrom, setDateFrom] = useState<Date | undefined>()
  const [dateTo, setDateTo] = useState<Date | undefined>()
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(() => {
    try {
      return localStorage.getItem(LAST_UPDATED_KEY)
    } catch {
      return null
    }
  })

  const filteredAbonos = useMemo(() => {
    const q = search.trim().toLowerCase()
    const fromMs = dateFrom ? new Date(dateFrom.getFullYear(), dateFrom.getMonth(), dateFrom.getDate()).getTime() : null
    const toMs = dateTo ? new Date(dateTo.getFullYear(), dateTo.getMonth(), dateTo.getDate(), 23, 59, 59).getTime() : null
    return abonos.filter((m) => {
      if (q) {
        const desc = String(m.descripcion ?? '').toLowerCase()
        const doc = String(m.documento_numero ?? '').toLowerCase()
        if (!desc.includes(q) && !doc.includes(q)) return false
      }
      if (fromMs || toMs) {
        const d = parseMovDate(m.fecha_movimiento)
        if (!d) return false
        const t = d.getTime()
        if (fromMs && t < fromMs) return false
        if (toMs && t > toMs) return false
      }
      return true
    })
  }, [abonos, search, dateFrom, dateTo])

  const hasFilters = !!search || !!dateFrom || !!dateTo
  const clearFilters = () => {
    setSearch('')
    setDateFrom(undefined)
    setDateTo(undefined)
  }

  const errorMsg = query.error instanceof Error ? query.error.message : null

  useEffect(() => {
    if (query.isSuccess && query.data?.data) {
      const now = new Date().toISOString()
      try {
        localStorage.setItem(LAST_UPDATED_KEY, now)
      } catch {
        /* noop */
      }
      setLastUpdatedAt(now)
    }
  }, [query.isSuccess, query.data])

  // Bulk: estado de conciliación de todos los documentos visibles.
  const documentoNumeros = useMemo(
    () =>
      abonos
        .map((m) => String(m.documento_numero ?? '').trim())
        .filter((d) => d.length > 0),
    [abonos],
  )

  const bulkQuery = useQuery({
    queryKey: ['cartola-reconciliation', 'bulk', documentoNumeros],
    queryFn: () => cartolaLinksService.getBulk(documentoNumeros),
    enabled: documentoNumeros.length > 0,
    staleTime: 30_000,
  })
  const bulkMap = bulkQuery.data ?? {}

  const refreshReconciliation = () => {
    qc.invalidateQueries({ queryKey: ['cartola-reconciliation'] })
  }

  const handleUpdateCartola = () => {
    if (!draftFrom || !draftTo) return
    if (datesChanged) {
      setCommittedFrom(draftFrom)
      setCommittedTo(draftTo)
    } else {
      query.refetch()
    }
  }

  const [dialogOpen, setDialogOpen] = useState(false)
  const [selected, setSelected] = useState<CartolaMovementRef | null>(null)

  const buildMovementRef = (m: CartolaMovimiento): CartolaMovementRef | null => {
    const doc = String(m.documento_numero ?? '').trim()
    if (!doc) return null
    return {
      documentoNumero: doc,
      descripcion: String(m.descripcion ?? ''),
      abono: toNumber(m.abono) ?? 0,
      fecha: fmtDate(m.fecha_movimiento),
    }
  }

  const openLinkDialog = (m: CartolaMovimiento) => {
    const ref = buildMovementRef(m)
    if (!ref) return
    setSelected(ref)
    setDialogOpen(true)
  }

  // CSV para abonos individuales
  const [individualCsvOpen, setIndividualCsvOpen] = useState(false)
  const movementCandidates: MovementCandidate[] = useMemo(() => {
    return abonos
      .filter((m) => (toNumber(m.abono) ?? 0) > 0)
      .map((m) => {
        const doc = String(m.documento_numero ?? '').trim()
        const abono = toNumber(m.abono) ?? 0
        const summary = doc ? bulkMap[doc] : undefined
        const applied = summary?.totalApplied ?? 0
        return {
          documentoNumero: doc,
          descripcion: String(m.descripcion ?? ''),
          abono,
          fecha: fmtDate(m.fecha_movimiento),
          remaining: Math.max(0, abono - applied),
        }
      })
      .filter((c) => c.documentoNumero)
  }, [abonos, bulkMap])

  const openIndividualCsvDialog = () => {
    if (movementCandidates.length === 0) {
      toast({
        title: 'Sin abonos disponibles',
        description: 'No hay abonos en el período seleccionado para conciliar por CSV.',
        variant: 'destructive',
      })
      return
    }
    setIndividualCsvOpen(true)
  }

  // KPI global de conciliación de abonos
  const abonoStats = useMemo(() => {
    let totalAbonos = 0
    let abonosCount = 0
    let conciliado = 0
    let movsConciliados = 0
    for (const m of abonos) {
      const abono = toNumber(m.abono) ?? 0
      if (abono > 0) {
        totalAbonos += abono
        abonosCount += 1
        const doc = String(m.documento_numero ?? '')
        const summary = bulkMap[doc]
        const applied = summary?.totalApplied ?? 0
        // El monto que se muestra al usuario como "conciliado" es la devolución real.
        const real = summary?.totalRealAmount
        conciliado +=
          real !== undefined && real !== null ? real : applied
        if (applied > 0) movsConciliados += 1
      }
    }
    return { totalAbonos, abonosCount, conciliado, movsConciliados }
  }, [abonos, bulkMap])


  return (
    <div className="container max-w-7xl mx-auto p-4 md:p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">Conciliación bancaria</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Cartola descargada automáticamente desde el portal bancario.
          </p>
        </div>
        <div className="flex flex-col items-start md:items-end gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  disabled={query.isFetching}
                  className={cn(
                    'justify-start text-left font-normal w-[150px]',
                    !draftFrom && 'text-muted-foreground',
                    query.isFetching && 'opacity-60 cursor-not-allowed',
                  )}
                >
                  <Calendar className="h-4 w-4 mr-2" />
                  {draftFrom ? format(draftFrom, 'dd/MM/yyyy', { locale: es }) : 'Desde'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <CalendarUI
                  mode="single"
                  selected={draftFrom}
                  onSelect={setDraftFrom}
                  initialFocus
                  locale={es}
                  className="p-3 pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  disabled={query.isFetching}
                  className={cn(
                    'justify-start text-left font-normal w-[150px]',
                    !draftTo && 'text-muted-foreground',
                    query.isFetching && 'opacity-60 cursor-not-allowed',
                  )}
                >
                  <Calendar className="h-4 w-4 mr-2" />
                  {draftTo ? format(draftTo, 'dd/MM/yyyy', { locale: es }) : 'Hasta'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <CalendarUI
                  mode="single"
                  selected={draftTo}
                  onSelect={setDraftTo}
                  initialFocus
                  locale={es}
                  className="p-3 pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
            <Button
              onClick={handleUpdateCartola}
              variant={datesChanged ? 'default' : 'outline'}
              disabled={query.isFetching || !draftFrom || !draftTo}
            >
              {query.isFetching ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Actualizando…
                </>
              ) : (
                <>
                  <RotateCw className="h-4 w-4 mr-2" />
                  {datesChanged ? 'Aplicar rango' : 'Actualizar cartola'}
                </>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={openIndividualCsvDialog}
              disabled={query.isFetching || movementCandidates.length === 0}
              title="Conciliar múltiples abonos individuales mediante un archivo CSV"
            >
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Conciliación CSV para Abonos Individuales
            </Button>
          </div>
          <span className="text-xs text-muted-foreground">
            {formatLastUpdated(lastUpdatedAt)}
          </span>
        </div>
      </div>

      {/* Resumen de cuenta */}
      {cartola && !query.isFetching && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 rounded-md border p-4 bg-muted/20">
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground uppercase tracking-wide">
              <Building2 className="h-3.5 w-3.5" /> Empresa
            </div>
            <div className="font-medium text-sm">{cartola.empresa_nombre ?? '—'}</div>
          </div>
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground uppercase tracking-wide">Cuenta</div>
            <div className="font-medium text-sm">
              {cartola.cuenta_numero ?? '—'}
              {cartola.moneda && <span className="text-muted-foreground ml-1">({cartola.moneda})</span>}
            </div>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground uppercase tracking-wide">
              <Calendar className="h-3.5 w-3.5" /> Período
            </div>
            <div className="font-medium text-sm">
              {fmtDate(cartola.fecha_desde)} — {fmtDate(cartola.fecha_hasta)}
            </div>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground uppercase tracking-wide">
              <Link2 className="h-3.5 w-3.5" /> Conciliado
            </div>
            <div className="font-semibold text-base text-emerald-700">
              {fmtCLP(abonoStats.conciliado, { showZero: true })}
            </div>
            <div className="text-[11px] text-muted-foreground">
              {abonoStats.movsConciliados} de {abonoStats.abonosCount} abonos
            </div>
          </div>
        </div>
      )}


      <Card>
        <CardHeader>
          <CardTitle>Movimientos bancarios</CardTitle>
          <CardDescription>
            Abonos obtenidos desde el XML de la cartola. Cada abono puede
            asociarse a una o varias solicitudes en estado Ingresada.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {query.isLoading || query.isFetching ? (
            <div className="flex flex-col items-center justify-center gap-5 py-16 px-6 rounded-lg border border-dashed bg-muted/20">
              <div className="relative h-16 w-16">
                <div className="absolute inset-0 rounded-full bg-primary/10 animate-ping" />
                <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              </div>
              <div className="text-center max-w-md space-y-2">
                <h3 className="text-lg font-semibold">Conectando con el portal bancario</h3>
                <p className="text-sm text-muted-foreground">
                  Estamos consultando y extrayendo los movimientos de la cartola. Este proceso puede tardar unos segundos; por favor, no cierres ni cambies el rango de fechas mientras termina.
                </p>
              </div>
              <div className="w-full max-w-xs space-y-2">
                <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                  <div className="h-full w-2/3 rounded-full bg-primary animate-pulse" />
                </div>
                <p className="text-xs text-center text-muted-foreground">Tiempo estimado: hasta 30 segundos</p>
              </div>
            </div>
          ) : errorMsg ? (
            <div className="flex items-start gap-3 rounded-md border border-destructive/40 bg-destructive/5 p-4">
              <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
              <div className="text-sm">
                <div className="font-medium text-destructive">No se pudo obtener la cartola</div>
                <div className="text-muted-foreground mt-1">{errorMsg}</div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Barra de filtros */}
              <div className="flex flex-col md:flex-row md:items-center gap-2">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Buscar por descripción o documento…"
                    className="pl-9"
                  />
                </div>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        'justify-start text-left font-normal md:w-[180px]',
                        !dateFrom && 'text-muted-foreground',
                      )}
                    >
                      <Calendar className="h-4 w-4 mr-2" />
                      {dateFrom ? format(dateFrom, 'dd/MM/yyyy', { locale: es }) : 'Desde'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarUI
                      mode="single"
                      selected={dateFrom}
                      onSelect={setDateFrom}
                      initialFocus
                      locale={es}
                      className="p-3 pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        'justify-start text-left font-normal md:w-[180px]',
                        !dateTo && 'text-muted-foreground',
                      )}
                    >
                      <Calendar className="h-4 w-4 mr-2" />
                      {dateTo ? format(dateTo, 'dd/MM/yyyy', { locale: es }) : 'Hasta'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarUI
                      mode="single"
                      selected={dateTo}
                      onSelect={setDateTo}
                      initialFocus
                      locale={es}
                      className="p-3 pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
                {hasFilters && (
                  <Button variant="ghost" size="sm" onClick={clearFilters}>
                    <X className="h-4 w-4 mr-1" /> Limpiar
                  </Button>
                )}
                <div className="text-xs text-muted-foreground md:ml-auto">
                  {filteredAbonos.length} de {abonos.length} abonos
                </div>
              </div>

              <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="whitespace-nowrap">Fecha</TableHead>
                    <TableHead>Descripción</TableHead>
                    <TableHead className="text-right whitespace-nowrap">Abono</TableHead>
                    <TableHead className="whitespace-nowrap">Conciliación</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAbonos.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-8">
                        {abonos.length === 0
                          ? 'La cartola no contiene abonos.'
                          : 'No hay abonos que coincidan con los filtros.'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredAbonos.map((m, i) => {
                      const doc = String(m.documento_numero ?? '').trim()
                      const abono = toNumber(m.abono) ?? 0
                      const summary = doc ? bulkMap[doc] : undefined
                      const applied = summary?.totalApplied ?? 0
                      const count = summary?.count ?? 0
                      const remaining = Math.max(0, abono - applied)
                      const canLink = abono > 0 && !!doc
                      const isFull = canLink && remaining <= 0.5 && applied > 0
                      const isPartial = canLink && applied > 0 && !isFull
                      return (
                      <TableRow key={doc || i} className={isFull ? 'bg-emerald-50/40' : isPartial ? 'bg-amber-50/40' : undefined}>
                        <TableCell className="whitespace-nowrap text-sm">{fmtDate(m.fecha_movimiento)}</TableCell>
                        <TableCell className="text-sm">
                          <div>{m.descripcion || '—'}</div>
                          {m.documento_numero && (
                            <div className="text-xs text-muted-foreground font-mono">Doc. {m.documento_numero}</div>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-medium text-emerald-600 tabular-nums">
                          {fmtCLP(m.abono)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {!canLink ? (
                            <span className="text-xs text-muted-foreground">—</span>
                          ) : (
                            <div className="flex items-center gap-2">
                              {isFull ? (
                                <Badge className="bg-emerald-600 hover:bg-emerald-600 gap-1">
                                  <CheckCircle2 className="h-3 w-3" />
                                  {count} solicitud{count === 1 ? '' : 'es'}
                                </Badge>
                              ) : isPartial ? (
                                <Badge variant="outline" className="border-amber-400 bg-amber-50 text-amber-800 gap-1">
                                  Parcial · {count}
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-muted-foreground">
                                  Sin conciliar
                                </Badge>
                              )}
                              <Button
                                size="sm"
                                variant={applied > 0 ? 'outline' : 'default'}
                                className="h-7 px-2 text-xs"
                                onClick={() => openLinkDialog(m)}
                              >
                                <Link2 className="h-3.5 w-3.5 mr-1" />
                                {applied > 0 ? 'Ver / editar' : 'Conciliar'}
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    )})}
                  )}
                </TableBody>
              </Table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <LinkRefundsDialog
        movement={selected}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onApplied={refreshReconciliation}
      />
      <IndividualCsvReconcileDialog
        open={individualCsvOpen}
        onOpenChange={setIndividualCsvOpen}
        movements={movementCandidates}
        onApplied={refreshReconciliation}
      />
    </div>
  )
}
