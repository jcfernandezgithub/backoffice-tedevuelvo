import { authService } from '@/services/authService'

export function batchStatusNote(process: string): string {
  const user = authService.getCurrent()
  if (!user?.id || !user.email?.trim()) {
    throw new Error('No se pudo identificar al usuario ejecutor. Vuelve a iniciar sesión antes de procesar.')
  }
  const actor = user.nombre?.trim() || user.email
  return `Proceso masivo de cambio de estado — ${process}. Ejecutado por: ${actor} (${user.email}; ID: ${user.id}).`
}