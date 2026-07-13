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

// Mapeo entre etiqueta visible (UI) y clave enum del backend.
export const PAGE_LABEL_TO_KEY: Record<PlatformPage, string> = {
  'Dashboard': 'DASHBOARD',
  'Solicitudes': 'SOLICITUDES',
  'Call Center': 'GESTION_CALLCENTER',
  'Alianzas': 'ALIANZAS',
  'Usuarios': 'USUARIOS',
  'Operación': 'OPERACION',
  'Calculadora': 'CALCULADORA',
  'Nómina': 'NOMINA',
  'Conciliación': 'CONCILIACION',
  'Procesos Masivos': 'PROCESOS_MASIVOS',
  'Ajustes': 'AJUSTES',
}

export const PAGE_KEY_TO_LABEL: Record<string, PlatformPage> = Object.entries(
  PAGE_LABEL_TO_KEY,
).reduce((acc, [label, key]) => {
  acc[key] = label as PlatformPage
  return acc
}, {} as Record<string, PlatformPage>)

export function pageLabelsToKeys(labels: PlatformPage[]): string[] {
  return labels.map((l) => PAGE_LABEL_TO_KEY[l] ?? String(l).toUpperCase())
}

export function pageKeysToLabels(keys: string[]): PlatformPage[] {
  return keys
    .map((k) => PAGE_KEY_TO_LABEL[k] ?? (ALL_PLATFORM_PAGES as readonly string[]).find((l) => l === k))
    .filter((v): v is PlatformPage => !!v)
}

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