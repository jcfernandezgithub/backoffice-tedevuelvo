import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  aiImageValidationService,
  type AiValidationConfiguration,
} from '@/services/aiImageValidationService'

export const AI_VALIDATION_CONFIG_KEY = ['ai-validation-config'] as const

const DEFAULT_CONFIG: AiValidationConfiguration = {
  imageValidationEnabled: false,
  docsValidationEnabled: false,
}

/**
 * Configuración global de las validaciones con IA (imágenes + documentos).
 *
 * Fuente de verdad: el servidor (GET/PATCH /ai-image-validation). Se comparte
 * entre Ajustes y los flujos operativos (cambio a "Documentos recibidos") a
 * través de React Query, por lo que un cambio en Ajustes se propaga al resto
 * de la plataforma como máximo en `staleTime` (60s).
 *
 * La actualización es optimista por campo: se envía solo el flag modificado,
 * se deshabilita ese switch mientras guarda y se revierte si el PATCH falla.
 */
export function useAiValidationConfig() {
  const qc = useQueryClient()

  const query = useQuery<AiValidationConfiguration>({
    queryKey: AI_VALIDATION_CONFIG_KEY,
    queryFn: aiImageValidationService.getConfig,
    staleTime: 60_000,
  })

  const mutation = useMutation({
    mutationFn: aiImageValidationService.updateConfig,
    onMutate: async (patch) => {
      await qc.cancelQueries({ queryKey: AI_VALIDATION_CONFIG_KEY })
      const previous =
        qc.getQueryData<AiValidationConfiguration>(AI_VALIDATION_CONFIG_KEY)
      qc.setQueryData<AiValidationConfiguration>(AI_VALIDATION_CONFIG_KEY, (old) => ({
        ...(old ?? DEFAULT_CONFIG),
        ...patch,
      }))
      return { previous }
    },
    onError: (err: Error, _patch, ctx) => {
      if (ctx?.previous !== undefined) {
        qc.setQueryData(AI_VALIDATION_CONFIG_KEY, ctx.previous)
      }
      toast.error('No se pudo guardar el cambio', { description: err.message })
    },
    onSuccess: (saved, patch) => {
      // El backend responde siempre con la configuración completa.
      qc.setQueryData(AI_VALIDATION_CONFIG_KEY, saved)
      const label =
        patch.imageValidationEnabled !== undefined
          ? 'Validación de imágenes con IA'
          : 'Validación de documentos con IA'
      const value = patch.imageValidationEnabled ?? patch.docsValidationEnabled
      toast.success(`${label} ${value ? 'habilitada' : 'deshabilitada'}`)
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: AI_VALIDATION_CONFIG_KEY })
    },
  })

  // Campo que se está guardando (permite deshabilitar solo ese switch).
  const savingField =
    mutation.isPending && mutation.variables
      ? (Object.keys(mutation.variables)[0] as keyof AiValidationConfiguration)
      : null

  return {
    ...query,
    config: query.data ?? DEFAULT_CONFIG,
    update: mutation.mutate,
    isSaving: mutation.isPending,
    savingField,
  }
}