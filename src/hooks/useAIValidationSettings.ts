import { useCallback, useEffect, useState } from 'react'

const STORAGE_KEY = 'tdv:ai-validation:docs-received'
const EVENT_NAME = 'tdv:ai-validation-settings-changed'

function read(): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw === null) return true // habilitado por defecto
    return raw === 'true'
  } catch {
    return true
  }
}

/** Lectura síncrona fuera de componentes React. */
export function isAIValidationEnabled(): boolean {
  return read()
}

/**
 * Hook para leer/escribir el flag que habilita la validación con IA
 * de la cédula al cambiar a estado "Documentos recibidos".
 */
export function useAIValidationSettings() {
  const [enabled, setEnabled] = useState<boolean>(read)

  useEffect(() => {
    const handler = () => setEnabled(read())
    window.addEventListener(EVENT_NAME, handler)
    window.addEventListener('storage', handler)
    return () => {
      window.removeEventListener(EVENT_NAME, handler)
      window.removeEventListener('storage', handler)
    }
  }, [])

  const setEnabledPersist = useCallback((value: boolean) => {
    try {
      localStorage.setItem(STORAGE_KEY, value ? 'true' : 'false')
    } catch {
      /* noop */
    }
    setEnabled(value)
    window.dispatchEvent(new Event(EVENT_NAME))
  }, [])

  return { enabled, setEnabled: setEnabledPersist }
}