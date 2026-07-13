import { z } from 'zod'

export const userSchemaV2 = z.object({
  firstName: z.string().trim().min(1, 'Nombre obligatorio').max(80),
  lastName: z.string().trim().min(1, 'Apellido obligatorio').max(80),
  email: z.string().trim().min(1, 'Correo obligatorio').email('Formato de correo inválido').max(160),
  phone: z.string().trim().max(30).optional().or(z.literal('')),
  role: z.string().min(1, 'Rol obligatorio'),
  state: z.enum(['ACTIVE', 'INACTIVE', 'PENDING'], { required_error: 'Estado obligatorio' }),
  password: z
    .string()
    .optional()
    .or(z.literal(''))
    .refine(
      (v) => !v || (v.length >= 8 && /[a-z]/.test(v) && /[A-Z]/.test(v) && /\d/.test(v) && /[^A-Za-z0-9]/.test(v)),
      'Mínimo 8 caracteres, con mayúscula, minúscula, número y símbolo',
    ),
})

export type UserFormValuesV2 = z.infer<typeof userSchemaV2>