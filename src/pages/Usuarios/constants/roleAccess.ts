import type { RoleV2 } from '../types/userTypesV2'

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

export interface RoleAccessDefinition {
  label: string
  shortLabel: string
  summary: string
  description: string
  scope: 'FULL' | 'LIMITED'
  allowedPages: readonly PlatformPage[]
  restrictedPages: readonly PlatformPage[]
}

const CALLCENTER_ALLOWED: PlatformPage[] = ['Call Center']

export const ROLE_ACCESS: Record<RoleV2, RoleAccessDefinition> = {
  ADMIN: {
    label: 'Administrador',
    shortLabel: 'Admin',
    scope: 'FULL',
    summary: 'Acceso completo a la plataforma',
    description:
      'Este usuario podrá visualizar y administrar todas las páginas y funcionalidades de la plataforma.',
    allowedPages: ALL_PLATFORM_PAGES,
    restrictedPages: [],
  },
  CALLCENTER: {
    label: 'Call Center',
    shortLabel: 'Call Center',
    scope: 'LIMITED',
    summary: 'Acceso exclusivo al módulo Call Center',
    description:
      'Este usuario solo podrá visualizar y utilizar la página Call Center.',
    allowedPages: CALLCENTER_ALLOWED,
    restrictedPages: ALL_PLATFORM_PAGES.filter(
      (p) => !CALLCENTER_ALLOWED.includes(p),
    ),
  },
}

export const STATE_LABELS: Record<'ACTIVE' | 'INACTIVE' | 'PENDING', string> = {
  ACTIVE: 'Activo',
  INACTIVE: 'Inactivo',
  PENDING: 'Invitación pendiente',
}

// Correo del usuario "autenticado" simulado.
// En la etapa real se debe reemplazar por el email del AuthContext.
export const CURRENT_USER_EMAIL = 'admin@tedevuelvo.cl'