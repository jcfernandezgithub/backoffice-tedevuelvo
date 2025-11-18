import { z } from 'zod'

export const alianzaSchema = z.object({
  nombre: z.string().min(3, 'Mínimo 3 caracteres').max(120, 'Máximo 120 caracteres'),
  code: z.string().min(1, 'Código es requerido'),
  rut: z.string().min(8, 'RUT inválido').max(12, 'RUT inválido'),
  contacto: z.object({
    fono: z.string().optional(),
    email: z.string().email('Email inválido').optional(),
  }),
  direccion: z.string().optional(),
  descripcion: z.string().optional(),
  comisionDegravamen: z
    .number({ invalid_type_error: 'Debe ser un número', required_error: 'Comisión de degravamen es requerida' })
    .min(0.01, 'Debe ser mayor a 0')
    .max(100, 'Debe ser ≤ 100'),
  comisionCesantia: z
    .number({ invalid_type_error: 'Debe ser un número', required_error: 'Comisión de cesantía es requerida' })
    .min(0.01, 'Debe ser mayor a 0')
    .max(100, 'Debe ser ≤ 100'),
  activo: z.boolean().default(true),
  fechaInicio: z.date({ required_error: 'Fecha de inicio es requerida' }),
  fechaTermino: z.date({ required_error: 'Fecha de término es requerida' }),
  logo: z.string().optional(),
}).refine((data) => data.fechaTermino > data.fechaInicio, {
  message: 'La fecha de término debe ser posterior a la fecha de inicio',
  path: ['fechaTermino'],
})

export type NuevaAlianzaInput = z.infer<typeof alianzaSchema>
