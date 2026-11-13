import { useEffect, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/state/AuthContext'
import { weeklyDocumentFilters, type DocumentUploadFilters } from '@/lib/callCenterDocumentUploads'
import { loadDocumentUploads, DocumentUploadsError } from '@/services/callCenterDocumentUploadsApi'

export function useCallCenterDocumentUploads(enabled: boolean, active: boolean, filters: DocumentUploadFilters) {
  const { user } = useAuth()
  const client = useQueryClient()
  const scope = JSON.stringify(user)
  const prefix = useMemo(() => ['call-center-document-uploads', scope], [scope])
  const weekly = useQuery({ queryKey: [...prefix, weeklyDocumentFilters], queryFn: ({ signal }) => loadDocumentUploads(weeklyDocumentFilters, signal), enabled: enabled && Boolean(user), retry: false, staleTime: 0, refetchOnMount: 'always' })
  const weeklyDenied = weekly.error instanceof DocumentUploadsError && [401, 403].includes(weekly.error.status)
  const results = useQuery({ queryKey: [...prefix, filters], queryFn: ({ signal }) => loadDocumentUploads(filters, signal), enabled: enabled && active && Boolean(user) && !weeklyDenied, retry: false, staleTime: 0, refetchOnMount: 'always' })
  const denied = weeklyDenied || (results.error instanceof DocumentUploadsError && [401, 403].includes(results.error.status))
  useEffect(() => {
    if (!enabled) return
    void client.invalidateQueries({ queryKey: prefix })
    return () => { void client.cancelQueries({ queryKey: prefix }) }
  }, [enabled, active, client, prefix])
  return { weekly, results, denied, refresh: () => client.invalidateQueries({ queryKey: prefix }) }
}