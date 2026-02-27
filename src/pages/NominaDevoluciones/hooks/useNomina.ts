import { useState, useCallback, useEffect, useRef } from 'react'
import { load, save } from '@/services/storage'
import {
  NominaHeaderInput,
  NominaRowInput,
  ValidationError,
  DEFAULT_NOMINA_CATALOGS,
  validateNominaInput,
  generateAndDownloadNominaTxt,
  MOCK_NOMINA_INPUT,
} from '../logic/nomina_logic_complete'

const DRAFT_KEY = 'nomina_devoluciones_draft_v1'

interface NominaDraft {
  header: NominaHeaderInput
  rows: NominaRowInput[]
  lastModified: string
}

const emptyHeader: NominaHeaderInput = {
  nombreEmpresa: '',
  rutEmpresa: '',
  convenio: '',
  fechaProceso: new Date().toISOString().slice(0, 10),
}

const emptyRow: NominaRowInput = {
  rutProveedor: '',
  nombreProveedor: '',
  bancoProveedor: '',
  cuentaProveedor: '',
  tipoDocumento: '',
  numeroDocumento: '',
  monto: 0,
  formaPago: '',
  codigoSucursal: '000',
  emailAviso: '',
  mensajeAviso: '',
}

export function useNomina() {
  const [header, setHeader] = useState<NominaHeaderInput>(emptyHeader)
  const [rows, setRows] = useState<NominaRowInput[]>([])
  const [errors, setErrors] = useState<ValidationError[]>([])
  const [draftFound, setDraftFound] = useState(false)
  const [lastModified, setLastModified] = useState<string | null>(null)
  const [lastExportResult, setLastExportResult] = useState<{ fileName: string; lineCount: number; totalAmount: number; mode: string } | null>(null)
  const initialized = useRef(false)

  // Check for draft on mount
  useEffect(() => {
    if (initialized.current) return
    initialized.current = true
    const draft = load<NominaDraft | null>(DRAFT_KEY, null)
    if (draft && (draft.rows.length > 0 || draft.header.nombreEmpresa)) {
      setDraftFound(true)
    }
  }, [])

  // Auto-save
  const autoSave = useCallback((h: NominaHeaderInput, r: NominaRowInput[]) => {
    const now = new Date().toISOString()
    setLastModified(now)
    save(DRAFT_KEY, { header: h, rows: r, lastModified: now } as NominaDraft)
  }, [])

  const updateHeader = useCallback((partial: Partial<NominaHeaderInput>) => {
    setHeader(prev => {
      const next = { ...prev, ...partial }
      autoSave(next, rows)
      return next
    })
  }, [rows, autoSave])

  const updateRow = useCallback((index: number, partial: Partial<NominaRowInput>) => {
    setRows(prev => {
      const next = [...prev]
      next[index] = { ...next[index], ...partial }
      autoSave(header, next)
      return next
    })
  }, [header, autoSave])

  const addRow = useCallback(() => {
    setRows(prev => {
      const next = [...prev, { ...emptyRow }]
      autoSave(header, next)
      return next
    })
  }, [header, autoSave])

  const duplicateRow = useCallback((index: number) => {
    setRows(prev => {
      const next = [...prev]
      next.splice(index + 1, 0, { ...prev[index] })
      autoSave(header, next)
      return next
    })
  }, [header, autoSave])

  const removeRow = useCallback((index: number) => {
    setRows(prev => {
      const next = prev.filter((_, i) => i !== index)
      autoSave(header, next)
      return next
    })
  }, [header, autoSave])

  const importRows = useCallback((imported: NominaRowInput[]) => {
    setRows(prev => {
      const next = [...prev, ...imported]
      autoSave(header, next)
      return next
    })
  }, [header, autoSave])

  const validate = useCallback(() => {
    const result = validateNominaInput({
      header,
      rows,
      catalogs: DEFAULT_NOMINA_CATALOGS,
    })
    setErrors(result.errors)
    return result
  }, [header, rows])

  const generate = useCallback((grouped: boolean) => {
    const result = validateNominaInput({ header, rows, catalogs: DEFAULT_NOMINA_CATALOGS })
    setErrors(result.errors)
    if (!result.valid) return null
    try {
      const res = generateAndDownloadNominaTxt({ header, rows, catalogs: DEFAULT_NOMINA_CATALOGS, grouped })
      setLastExportResult({ fileName: res.fileName, lineCount: res.lineCount, totalAmount: res.totalAmount, mode: res.mode })
      return res
    } catch (e: any) {
      setErrors([{ scope: 'system', field: 'generation', message: e.message }])
      return null
    }
  }, [header, rows])

  const restoreDraft = useCallback(() => {
    const draft = load<NominaDraft | null>(DRAFT_KEY, null)
    if (draft) {
      setHeader(draft.header)
      setRows(draft.rows)
      setLastModified(draft.lastModified)
    }
    setDraftFound(false)
  }, [])

  const discardDraft = useCallback(() => {
    save(DRAFT_KEY, null)
    setDraftFound(false)
  }, [])

  const clearAll = useCallback(() => {
    setHeader({ ...emptyHeader, fechaProceso: new Date().toISOString().slice(0, 10) })
    setRows([])
    setErrors([])
    setLastExportResult(null)
    save(DRAFT_KEY, null)
    setLastModified(null)
  }, [])

  const loadExample = useCallback(() => {
    setHeader(MOCK_NOMINA_INPUT.header)
    setRows([...MOCK_NOMINA_INPUT.rows])
    setErrors([])
    autoSave(MOCK_NOMINA_INPUT.header, MOCK_NOMINA_INPUT.rows)
  }, [autoSave])

  return {
    header, rows, errors, draftFound, lastModified, lastExportResult,
    updateHeader, updateRow, addRow, duplicateRow, removeRow, importRows,
    validate, generate, restoreDraft, discardDraft, clearAll, loadExample,
    setRows, // for CSV bulk replace scenario
  }
}
