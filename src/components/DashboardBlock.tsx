import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { AlertCircle, RefreshCw } from 'lucide-react'
import { DashboardApiError, type DashboardMeta } from '@/services/backofficeDashboardApi'

export interface DashboardBlockQuery {
  isPending: boolean; isFetching: boolean; error: Error | null
  data?: { meta: DashboardMeta }; refetch: () => unknown
}
const errorMessage = (error: Error) => {
  if (!(error instanceof DashboardApiError)) return 'No se pudo cargar este bloque. Revisa la conexión e inténtalo nuevamente.'
  if (error.code === 'USER_INACTIVE') return 'Tu cuenta está inactiva y no tiene acceso al dashboard.'
  if (error.status === 403) return 'No tienes permiso para consultar el dashboard.'
  if (error.status === 401) return 'Tu sesión no está disponible. Vuelve a iniciar sesión.'
  if (error.status === 404) return 'Este servicio del dashboard no está disponible en el ambiente configurado.'
  if (error.status === 429) return 'Se alcanzó el límite temporal de consultas. Espera antes de actualizar.'
  if (error.status === 503) return 'El dashboard no está disponible temporalmente.'
  return error.message
}
export function DashboardBlock({ query, children, className = '', empty = false }: { query: DashboardBlockQuery; children: ReactNode; className?: string; empty?: boolean }) {
  const [now, setNow] = useState(Date.now())
  const [retryAt, setRetryAt] = useState(0)
  useEffect(() => {
    const delay = query.error instanceof DashboardApiError ? query.error.retryAfterMs : undefined
    setRetryAt(delay && Number.isFinite(delay) ? Date.now() + delay : 0)
  }, [query.error])
  useEffect(() => {
    if (!retryAt) return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [retryAt])
  const terminal = query.error instanceof DashboardApiError && [400, 401, 403].includes(query.error.status)
  return <div className={className}>
    {query.error && <div role="alert" className="flex flex-wrap items-center gap-2 border border-destructive/40 rounded-md p-3 mb-3 text-sm">
      <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
      <span>{errorMessage(query.error)}</span>
      {query.error instanceof DashboardApiError && query.error.requestId && <span className="text-xs text-muted-foreground break-all">Referencia: {query.error.requestId}</span>}
      {!terminal && <Button variant="outline" size="sm" disabled={query.isFetching || now < retryAt} onClick={() => query.refetch()}><RefreshCw className="h-3 w-3 mr-1" />Reintentar</Button>}
      {query.data && <span className="text-xs text-muted-foreground">Se muestran los últimos datos disponibles de este rango.</span>}
    </div>}
    {!query.data && query.isPending && !query.error ? <Skeleton className="h-32 w-full" /> : query.data ? <>
      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
        <span title={`Referencia: ${query.data.meta.requestId}`}>Consulta actualizada: {new Date(query.data.meta.generatedAt).toLocaleString('es-CL')}</span>
        {query.isFetching && <RefreshCw className="h-3 w-3 animate-spin" aria-label="Actualizando" />}
      </div>
      {empty && <p className="text-sm text-muted-foreground mb-3">Sin datos para el rango seleccionado</p>}
      {children}
    </> : null}
  </div>
}