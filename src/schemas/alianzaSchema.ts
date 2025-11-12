import { z } from 'zod'

export const alianzaSchema = z.object({
  nombre: z.string().min(3, 'Mínimo 3 caracteres').max(120, 'Máximo 120 caracteres'),
  contacto: z.object({
    fono: z.string().optional(),
    email: z.string().email('Email inválido').optional(),
  }),
  direccion: z.string().optional(),
  comision: z
    .number({ invalid_type_error: 'Debe ser un número' })
    .min(0, 'Debe ser ≥ 0')
    .max(30, 'Debe ser ≤ 30'),
  activo: z.boolean().default(true),
  logo: z.string().optional(),
})

export type NuevaAlianzaInput = z.infer<typeof alianzaSchema>
