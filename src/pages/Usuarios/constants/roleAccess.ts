export const ALL_PLATFORM_PAGES = [
  'Dashboard',
  'Solicitudes',
  'Call Center',
  'Alianzas',
  'Usuarios',
  'Operación',
  'Calculadora',
  'Nómina',
  'Conciliación',
  'Procesos Masivos',
  'Ajustes',
] as const

export type PlatformPage = (typeof ALL_PLATFORM_PAGES)[number]

export const STATE_LABELS: Record<'ACTIVE' | 'INACTIVE' | 'PENDING', string> = {
  ACTIVE: 'Activo',
  INACTIVE: 'Inactivo',
  PENDING: 'Invitación pendiente',
}

// Correo del usuario "autenticado" simulado.
// En la etapa real se debe reemplazar por el email del AuthContext.
export const CURRENT_USER_EMAIL = 'admin@tedevuelvo.cl'

// IDs de roles del sistema — no eliminables.
export const SYSTEM_ROLE_IDS = {
  ADMIN: 'ADMIN',
  CALLCENTER: 'CALLCENTER',
} as const

// Helper para consumidores fuera del contexto React (activity log, etc.)
export function getRoleLabel(roleId: string): string {
  // Import diferido para evitar ciclo.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { rolesStore } = require('@/pages/Ajustes/services/rolesStore')
  return rolesStore.get(roleId)?.label ?? roleId
}