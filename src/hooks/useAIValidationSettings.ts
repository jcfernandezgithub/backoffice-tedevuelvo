import { useCallback, useEffect, useState } from 'react'

const CEDULA_KEY = 'tdv:ai-validation:docs-received'
const CREDITO_KEY = 'tdv:ai-validation:credito-docs'
const EVENT_NAME = 'tdv:ai-validation-settings-changed'

function read(key: string): boolean {
  try {
    const raw = localStorage.getItem(key)
    if (raw === null) return true // habilitado por defecto
    return raw === 'true'
  } catch {
    return true
  }
}

function write(key: string, value: boolean) {
  try {
    localStorage.setItem(key, value ? 'true' : 'false')
  } catch {
    /* noop */
  }
  window.dispatchEvent(new Event(EVENT_NAME))
}

/** Lectura síncrona fuera de componentes React. */
export function isAIValidationEnabled(): boolean {
  return read(CEDULA_KEY)
}

export function isCreditoDocsValidationEnabled(): boolean {
  return read(CREDITO_KEY)
}

function useFlag(key: string) {
  const [enabled, setEnabled] = useState<boolean>(() => read(key))

  useEffect(() => {
    const handler = () => setEnabled(read(key))
    window.addEventListener(EVENT_NAME, handler)
    window.addEventListener('storage', handler)
    return () => {
      window.removeEventListener(EVENT_NAME, handler)
      window.removeEventListener('storage', handler)
    }
  }, [key])

  const setEnabledPersist = useCallback(
    (value: boolean) => {
      write(key, value)
      setEnabled(value)
    },
    [key],
  )

  return { enabled, setEnabled: setEnabledPersist }
}

/**
 * Hook para leer/escribir el flag que habilita la validación con IA
 * de la cédula al cambiar a estado "Documentos recibidos".
 */
export function useAIValidationSettings() {
  return useFlag(CEDULA_KEY)
}

/**
 * Hook para leer/escribir el flag que habilita la validación con IA
 * de documentos de crédito (kind "otros").
 */
export function useCreditoDocsValidationSettings() {
  return useFlag(CREDITO_KEY)
}