import type { PlatformPage } from '@/pages/Usuarios/constants/roleAccess'
import { ALL_PLATFORM_PAGES } from '@/pages/Usuarios/constants/roleAccess'

export type RoleScope = 'FULL' | 'LIMITED'

export interface RoleDefinition {
  id: string
  label: string
  shortLabel: string
  summary: string
  description: string
  scope: RoleScope
  allowedPages: PlatformPage[]
  restrictedPages: PlatformPage[]
  isSystem: boolean
  createdAt: string
  updatedAt: string
}

const now = () => new Date().toISOString()

function build(
  id: string,
  data: Omit<RoleDefinition, 'id' | 'restrictedPages' | 'createdAt' | 'updatedAt'>,
): RoleDefinition {
  return {
    id,
    ...data,
    restrictedPages: ALL_PLATFORM_PAGES.filter((p) => !data.allowedPages.includes(p)),
    createdAt: now(),
    updatedAt: now(),
  }
}

let STORE: RoleDefinition[] = [
  build('ADMIN', {
    label: 'Administrador',
    shortLabel: 'Admin',
    scope: 'FULL',
    summary: 'Acceso completo a la plataforma',
    description:
      'Este usuario podrá visualizar y administrar todas las páginas y funcionalidades de la plataforma.',
    allowedPages: [...ALL_PLATFORM_PAGES],
    isSystem: true,
  }),
  build('CALLCENTER', {
    label: 'Call Center',
    shortLabel: 'Call Center',
    scope: 'LIMITED',
    summary: 'Acceso exclusivo al módulo Call Center',
    description:
      'Este usuario solo podrá visualizar y utilizar la página Call Center.',
    allowedPages: ['Call Center'],
    isSystem: true,
  }),
]

const listeners = new Set<() => void>()
const notify = () => listeners.forEach((l) => l())

export const rolesStore = {
  subscribe(fn: () => void) {
    listeners.add(fn)
    return () => listeners.delete(fn)
  },
  list(): RoleDefinition[] {
    return STORE
  },
  get(id: string): RoleDefinition | undefined {
    return STORE.find((r) => r.id === id)
  },
  create(data: {
    label: string
    description: string
    allowedPages: PlatformPage[]
  }): RoleDefinition {
    const scope: RoleScope =
      data.allowedPages.length === ALL_PLATFORM_PAGES.length ? 'FULL' : 'LIMITED'
    const role: RoleDefinition = {
      id: `role-${Math.random().toString(36).slice(2, 8)}`,
      label: data.label.trim(),
      shortLabel: data.label.trim(),
      description: data.description.trim(),
      summary:
        scope === 'FULL'
          ? 'Acceso completo a la plataforma'
          : `Acceso limitado (${data.allowedPages.length} páginas)`,
      scope,
      allowedPages: [...data.allowedPages],
      restrictedPages: ALL_PLATFORM_PAGES.filter((p) => !data.allowedPages.includes(p)),
      isSystem: false,
      createdAt: now(),
      updatedAt: now(),
    }
    STORE = [...STORE, role]
    notify()
    return role
  },
  update(
    id: string,
    data: Partial<{
      label: string
      description: string
      allowedPages: PlatformPage[]
    }>,
  ) {
    STORE = STORE.map((r) => {
      if (r.id !== id) return r
      // System roles: sólo permitir editar descripción.
      const nextLabel = r.isSystem ? r.label : data.label?.trim() ?? r.label
      const nextPages = r.isSystem ? r.allowedPages : data.allowedPages ?? r.allowedPages
      const scope: RoleScope =
        nextPages.length === ALL_PLATFORM_PAGES.length ? 'FULL' : 'LIMITED'
      return {
        ...r,
        label: nextLabel,
        shortLabel: nextLabel,
        description: data.description?.trim() ?? r.description,
        allowedPages: nextPages,
        restrictedPages: ALL_PLATFORM_PAGES.filter((p) => !nextPages.includes(p)),
        scope,
        summary: r.isSystem
          ? r.summary
          : scope === 'FULL'
            ? 'Acceso completo a la plataforma'
            : `Acceso limitado (${nextPages.length} páginas)`,
        updatedAt: now(),
      }
    })
    notify()
  },
  remove(id: string) {
    STORE = STORE.filter((r) => r.id !== id)
    notify()
  },
}