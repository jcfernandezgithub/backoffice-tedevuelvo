import { useState, useCallback } from 'react'
import { refundAdminApi, SearchParams } from '@/services/refundAdminApi'
import { RefundRequest, AdminQueryParams } from '@/types/refund'

const BATCH_SIZE = 10 // Número de páginas a buscar en paralelo
const PAGE_LIMIT = 100 // Registros por página para exportación

interface ExportFilters {
  searchFilters?: SearchParams
  listFilters?: AdminQueryParams
  useSearchEndpoint: boolean
}

export function useExportAllRefunds() {
  const [isExporting, setIsExporting] = useState(false)
  const [progress, setProgress] = useState(0)

  const fetchAllRefunds = useCallback(async (filters: ExportFilters): Promise<RefundRequest[]> => {
    setIsExporting(true)
    setProgress(0)

    try {
      // Obtener primera página para saber el total
      let firstPageResult
      
      if (filters.useSearchEndpoint && filters.searchFilters) {
        firstPageResult = await refundAdminApi.search({
          ...filters.searchFilters,
          page: 1,
          limit: PAGE_LIMIT,
        })
      } else {
        firstPageResult = await refundAdminApi.list({
          ...filters.listFilters,
          page: 1,
          pageSize: PAGE_LIMIT,
        })
      }

      const total = firstPageResult.total
      const totalPages = Math.ceil(total / PAGE_LIMIT)
      
      console.log(`[ExportAll] Total: ${total}, Pages: ${totalPages}`)
      
      if (totalPages <= 1) {
        setProgress(100)
        setIsExporting(false)
        return firstPageResult.items
      }

      // Recolectar todos los items
      let allItems: RefundRequest[] = [...firstPageResult.items]
      setProgress(Math.round((1 / totalPages) * 100))

      // Fetch remaining pages in batches
      const remainingPages = Array.from({ length: totalPages - 1 }, (_, i) => i + 2)
      
      for (let i = 0; i < remainingPages.length; i += BATCH_SIZE) {
        const batch = remainingPages.slice(i, i + BATCH_SIZE)
        
        const batchResults = await Promise.all(
          batch.map(async (pageNum) => {
            try {
              if (filters.useSearchEndpoint && filters.searchFilters) {
                return await refundAdminApi.search({
                  ...filters.searchFilters,
                  page: pageNum,
                  limit: PAGE_LIMIT,
                })
              } else {
                return await refundAdminApi.list({
                  ...filters.listFilters,
                  page: pageNum,
                  pageSize: PAGE_LIMIT,
                })
              }
            } catch (error) {
              console.error(`[ExportAll] Error fetching page ${pageNum}:`, error)
              return { items: [] }
            }
          })
        )

        // Concatenar resultados
        batchResults.forEach((result) => {
          if (result.items) {
            allItems = [...allItems, ...result.items]
          }
        })

        // Actualizar progreso
        const completedPages = Math.min(i + BATCH_SIZE + 1, totalPages)
        setProgress(Math.round((completedPages / totalPages) * 100))
      }

      console.log(`[ExportAll] Fetched ${allItems.length} items`)
      setIsExporting(false)
      return allItems

    } catch (error) {
      console.error('[ExportAll] Error:', error)
      setIsExporting(false)
      throw error
    }
  }, [])

  return {
    fetchAllRefunds,
    isExporting,
    progress,
  }
}
