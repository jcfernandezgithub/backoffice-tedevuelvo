import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/state/AuthContext'
import { alertsAccess, alertsScope } from '@/lib/operationalAlerts'
import { AlertsApiError, operationalAlertsApi as api, type AlertFilters, type OperationalAlert } from '@/services/operationalAlertsApi'

export function useOperationalAlerts(filters:AlertFilters,page:number) {
  const {user} = useAuth()
  const client = useQueryClient()
  const scope = alertsScope(user)
  const access = alertsAccess(user)
  const [epoch,setEpoch] = useState(0)
  const [denied,setDenied] = useState<string|null>(null)
  const {status,sort,...common} = filters
  const allowed = access.allowed && denied !== scope
  const summary = useQuery({queryKey:['operational-alerts',scope,'summary',common,epoch],queryFn:({signal}) => api.summary(common,signal),enabled:allowed,staleTime:Infinity,gcTime:0,retry:false,refetchOnWindowFocus:false})
  const token = summary.data?.meta.snapshotToken
  const list = useQuery({queryKey:['operational-alerts',scope,'list',filters,token,page],queryFn:({signal}) => api.page<OperationalAlert>('/alerts',token ?? '',page,filters,signal),enabled:allowed && Boolean(token),staleTime:Infinity,gcTime:0,retry:false,refetchOnWindowFocus:false})
  const error = summary.error ?? list.error
  const refresh = async () => {
    await client.cancelQueries({queryKey:['operational-alerts',scope]})
    client.removeQueries({queryKey:['operational-alerts',scope]})
    setEpoch(v => v+1)
  }
  useEffect(() => {
    if (!(error instanceof AlertsApiError)) return
    if (error.code === 'SNAPSHOT_EXPIRED') refresh()
    if ([401,403].includes(error.status)) {
      setDenied(scope)
      void client.cancelQueries({queryKey:['operational-alerts',scope]})
      client.removeQueries({queryKey:['operational-alerts',scope]})
    }
  },[error,scope])
  return {summary,list,token,refresh,scope,allowed,admin:access.admin,error,deny:() => setDenied(scope)}
}