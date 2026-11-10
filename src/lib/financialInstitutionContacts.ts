import { z } from 'zod'

export function financialContactRolesFromBackend(user: {
  roles?: string[]
  role?: { normalizedName?: string; name?: string } | string
} | null | undefined): string[] | undefined {
  if (Array.isArray(user?.roles)) return user.roles
  if (typeof user?.role === 'string') return [user.role]
  const name = user?.role?.normalizedName ?? user?.role?.name
  return name ? [name] : undefined
}

export function canManageFinancialContacts(user: { roles?: string[]; email?: string } | null | undefined): boolean {
  return user?.email !== 'admin@callcenter.cl' && user?.roles?.includes('ADMIN') === true
}

export const financialContactSchema = z.object({
  name: z.string().transform(value => value.normalize('NFKC').trim().replace(/\s+/g, ' '))
    .pipe(z.string().min(1, 'Ingresa el nombre de la entidad.').max(160, 'El nombre admite hasta 160 caracteres.')),
  email: z.string().trim().max(254, 'El correo admite hasta 254 caracteres.').email('Ingresa un único correo válido.'),
}).strict()

export function pageAfterContactDeletion(page: number, itemsCount: number): number {
  return itemsCount === 1 && page > 1 ? page - 1 : page
}