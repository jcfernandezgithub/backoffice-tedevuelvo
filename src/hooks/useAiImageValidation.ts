import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { aiImageValidationService } from '@/services/aiImageValidationService';
import { toast } from 'sonner';

export const AI_IMAGE_VALIDATION_KEY = ['ai-image-validation'] as const;

/**
 * Estado global del interruptor "Validación de imágenes con IA".
 * La actualización es optimista: se aplica de inmediato, se deshabilita
 * el switch mientras guarda y se revierte si el PATCH falla.
 */
export function useAiImageValidation() {
  const qc = useQueryClient();

  const query = useQuery<boolean>({
    queryKey: AI_IMAGE_VALIDATION_KEY,
    queryFn: aiImageValidationService.getEnabled,
    staleTime: 60_000,
  });

  const mutation = useMutation({
    mutationFn: aiImageValidationService.setEnabled,
    onMutate: async (next) => {
      await qc.cancelQueries({ queryKey: AI_IMAGE_VALIDATION_KEY });
      const previous = qc.getQueryData<boolean>(AI_IMAGE_VALIDATION_KEY);
      qc.setQueryData(AI_IMAGE_VALIDATION_KEY, next);
      return { previous };
    },
    onError: (err: Error, _next, ctx) => {
      if (ctx?.previous !== undefined) {
        qc.setQueryData(AI_IMAGE_VALIDATION_KEY, ctx.previous);
      }
      toast.error('No se pudo guardar el cambio', { description: err.message });
    },
    onSuccess: (saved) => {
      qc.setQueryData(AI_IMAGE_VALIDATION_KEY, saved);
      toast.success(
        saved
          ? 'Validación de imágenes con IA habilitada'
          : 'Validación de imágenes con IA deshabilitada',
      );
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: AI_IMAGE_VALIDATION_KEY });
    },
  });

  return {
    ...query,
    toggle: mutation.mutate,
    isSaving: mutation.isPending,
  };
}