import { z } from 'zod';

const phoneRegex = /^(\+56\s?)?([2-9]\d{8}|9\d{8})$/;

export const allianceUserSchema = z.object({
  name: z
    .string()
    .min(1, 'Nombre es requerido')
    .refine(
      (val) => val.trim().split(' ').length >= 2,
      'Debe incluir nombre y apellido'
    ),
  email: z
    .string()
    .min(1, 'Email es requerido')
    .email('Email inválido'),
  phone: z
    .string()
    .min(1, 'Teléfono es requerido')
    .refine((val) => phoneRegex.test(val), 'Formato de teléfono chileno inválido'),
  role: z.enum(['ALIANZA_ADMIN', 'ALIANZA_OPERADOR'], {
    required_error: 'Rol es requerido',
  }),
  sendInvitation: z.boolean().default(true),
});

export const blockUserSchema = z.object({
  reason: z.string().optional(),
});

export type AllianceUserInput = z.infer<typeof allianceUserSchema>;
export type BlockUserInput = z.infer<typeof blockUserSchema>;