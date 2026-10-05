import { useQuery } from '@tanstack/react-query'
import { bankInfoChangesApi } from '@/services/bankInfoChangesApi'
import {
  DEFAULT_NOMINA_CATALOGS,
  type BancoCatalogItem,
  type NominaCatalogs,
} from '../logic/nomina_logic_complete'

const pick = (o: any, keys: string[]) => {
  for (const k of keys) {
    const v = o?.[k]
    if (v !== undefined && v !== null && String(v).trim() !== '') return String(v).trim()
  }
  return ''
}

/** Normaliza la respuesta del catálogo (strings u objetos con nombre + código SBIF). */
export function parseBankCatalog(raw: any): BancoCatalogItem[] {
  const list: any[] = Array.isArray(raw)
    ? raw
    : raw?.banks ?? raw?.bancos ?? raw?.data?.banks ?? raw?.data ?? []
  const out: BancoCatalogItem[] = []
  const seen = new Set<string>()
  for (const b of Array.isArray(list) ? list : []) {
    const name = typeof b === 'string' ? b.trim() : pick(b, ['name', 'nombre', 'label', 'bank', 'banco'])
    const sbifCode = typeof b === 'string'
      ? ''
      : pick(b, ['sbifCode', 'sbif', 'codigoSbif', 'codSbif', 'sbif_code', 'code', 'codigo'])
    if (!name || !sbifCode) {
      if (name) console.warn('[Nómina] Banco sin código SBIF en el catálogo, se omite:', name)
      continue
    }
    const key = name.toUpperCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ name, sbifCode: sbifCode.replace(/\D/g, '').padStart(3, '0') })
  }
  return out
}

export function useNominaBankCatalog() {
  const q = useQuery({
    queryKey: ['bank-info-catalog-raw'],
    queryFn: async () => {
      const raw = await bankInfoChangesApi.catalog()
      // Log para verificar en vivo el formato de la respuesta
      console.info('[Nómina] Respuesta del catálogo de bancos:', raw)
      return raw
    },
    staleTime: 10 * 60 * 1000,
    retry: 1,
  })

  const bancos = q.data ? parseBankCatalog(q.data) : []
  const catalogs: NominaCatalogs | null =
    bancos.length > 0 ? { ...DEFAULT_NOMINA_CATALOGS, bancos } : null

  return { catalogs, bancos, isLoading: q.isLoading, error: q.error as Error | null, raw: q.data }
}
