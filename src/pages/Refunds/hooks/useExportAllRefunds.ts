import { useState, useCallback } from 'react'
import { refundAdminApi, SearchParams } from '@/services/refundAdminApi'
import { RefundRequest, AdminQueryParams, AdminListResponse } from '@/types/refund'

const BATCH_SIZE = 6 // Páginas en paralelo por lote (gentil con el backend)
const PAGE_LIMIT = 100 // Registros por página para exportación
const MAX_RETRIES = 3 // Reintentos por página antes de declararla fallida
const REQUEST_TIMEOUT_MS = 45_000 // Timeout por request (Render corta conexiones colgadas)

interface ExportFilters {
  searchFilters?: SearchParams
  listFilters?: AdminQueryParams
  useSearchEndpoint: boolean
}

export interface ExportAllResult {
  items: RefundRequest[]
  expectedTotal: number
  failedPages: number[]
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function dedupeById(items: RefundRequest[]): RefundRequest[] {
  const seen = new Set<string>()
  return items.filter((r) => {
    if (!r?.id || seen.has(r.id)) return false
    seen.add(r.id)
    return true
  })
}

// Errores que no tiene sentido reintentar: fallan siempre (determinísticos).
// Ej: "Sort exceeded memory limit" de Mongo (falta índice/allowDiskUse en backend).
function isNonRetryableError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error)
  return /sort exceeded memory limit|allowDiskUse|unauthorized/i.test(msg)
}

export function useExportAllRefunds() {
  const [isExporting, setIsExporting] = useState(false)
  const [progress, setProgress] = useState(0)

  // Fetch de una página con timeout: si el servidor cuelga la conexión,
  // abortamos a los 45s para poder reintentar en vez de esperar indefinidamente.
  const fetchPage = useCallback(
    async (filters: ExportFilters, pageNum: number, pageSize: number): Promise<AdminListResponse> => {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
      try {
        if (filters.useSearchEndpoint && filters.searchFilters) {
          return await refundAdminApi.searchByUpdatedAt(
            { ...filters.searchFilters, page: pageNum, limit: pageSize },
            controller.signal,
          )
        }
        return await refundAdminApi.list(
          { ...filters.listFilters, page: pageNum, pageSize },
          controller.signal,
        )
      } finally {
        clearTimeout(timeout)
      }
    },
    [],
  )

  // Reintenta una página con backoff exponencial (600ms, 1.2s, 2.4s).
  // Devuelve null solo si agotó todos los intentos.
  const fetchPageWithRetry = useCallback(
    async (filters: ExportFilters, pageNum: number, pageSize: number): Promise<AdminListResponse | null> => {
      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
          return await fetchPage(filters, pageNum, pageSize)
        } catch (error) {
          if (isNonRetryableError(error)) {
            throw error
          }
          if (attempt < MAX_RETRIES) {
            await sleep(600 * 2 ** attempt)
          } else {
            console.error(`[ExportAll] Página ${pageNum} falló tras ${MAX_RETRIES + 1} intentos:`, error)
            return null
          }
        }
      }
      return null
    },
    [fetchPage],
  )

  const fetchAllRefunds = useCallback(async (filters: ExportFilters): Promise<ExportAllResult> => {
    setIsExporting(true)
    setProgress(0)

    try {
      // Obtener primera página para saber el total
      // El listado de Solicitudes usa search-by-updated-at cuando hay filtros
      // aplicados (status/fecha). La exportación debe usar el mismo endpoint
      // para que el total del botón y el dataset exportado coincidan.
      const firstPageResult = await fetchPage(filters, 1, PAGE_LIMIT)

      const total = firstPageResult.total
      // Usar el pageSize REAL devuelto por el backend (por si aplica un cap
      // menor al solicitado, ej. 20). De lo contrario se calcularían menos
      // páginas de las necesarias y la exportación quedaría incompleta.
      const effectivePageSize = firstPageResult.pageSize && firstPageResult.pageSize > 0
        ? firstPageResult.pageSize
        : (firstPageResult.items?.length || PAGE_LIMIT)
      const totalPages = Math.max(1, Math.ceil(total / effectivePageSize))

      console.log(`[ExportAll] Total: ${total}, PageSize: ${effectivePageSize}, Pages: ${totalPages}`)

      let allItems: RefundRequest[] = [...(firstPageResult.items ?? [])]
      const failedPages: number[] = []

      if (totalPages <= 1) {
        setProgress(100)
        return { items: dedupeById(allItems), expectedTotal: total, failedPages }
      }

      setProgress(Math.round((1 / totalPages) * 100))

      // Primera pasada: lotes en paralelo, cada página con reintentos
      const remainingPages = Array.from({ length: totalPages - 1 }, (_, i) => i + 2)

      for (let i = 0; i < remainingPages.length; i += BATCH_SIZE) {
        const batch = remainingPages.slice(i, i + BATCH_SIZE)

        const results = await Promise.all(
          batch.map(async (pageNum) => ({
            pageNum,
            result: await fetchPageWithRetry(filters, pageNum, effectivePageSize),
          })),
        )

        results.forEach(({ pageNum, result }) => {
          if (result?.items) allItems = allItems.concat(result.items)
          else failedPages.push(pageNum)
        })

        // Actualizar progreso (reservamos el tramo 95-100% para la segunda pasada)
        const completedPages = Math.min(i + BATCH_SIZE + 1, totalPages)
        setProgress(Math.min(95, Math.round((completedPages / totalPages) * 95)))
      }

      // Segunda pasada: páginas que fallaron en paralelo se reintentan
      // una a una (secuencial) para no saturar el backend.
      if (failedPages.length > 0) {
        console.warn(`[ExportAll] Reintentando ${failedPages.length} páginas fallidas en secuencial…`)
        const stillFailed: number[] = []
        for (const pageNum of failedPages) {
          const result = await fetchPageWithRetry(filters, pageNum, effectivePageSize)
          if (result?.items) allItems = allItems.concat(result.items)
          else stillFailed.push(pageNum)
        }
        failedPages.length = 0
        failedPages.push(...stillFailed)
      }

      // Dedupe por id por si el backend repite registros entre páginas
      const deduped = dedupeById(allItems)
      console.log(`[ExportAll] Fetched ${allItems.length} items (${deduped.length} únicos de ${total})`)
      if (failedPages.length > 0) {
        console.warn(`[ExportAll] Exportación incompleta: ${failedPages.length} páginas no respondieron`, failedPages)
      }
      setProgress(100)
      return { items: deduped, expectedTotal: total, failedPages }
    } catch (error) {
      console.error('[ExportAll] Error:', error)
      throw error
    } finally {
      setIsExporting(false)
    }
  }, [fetchPage, fetchPageWithRetry])

  return {
    fetchAllRefunds,
    isExporting,
    progress,
  }
}
