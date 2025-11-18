import { z } from 'zod';

const phoneRegex = /^(\+56\s?)?([2-9]\d{8}|9\d{8})$/;
const rutRegex = /^[0-9]{1,2}\.[0-9]{3}\.[0-9]{3}-[0-9kK]$/;

export const allianceUserSchema = z.object({
  name: z
    .string()
    .min(1, 'Nombre es requerido')
    .refine(
      (val) => val.trim().split(' ').length >= 2,
      'Debe incluir nombre y apellido'
    ),
  rut: z
    .string()
    .min(1, 'RUT es requerido')
    .refine((val) => rutRegex.test(val), 'Formato de RUT chileno inválido (XX.XXX.XXX-X)'),
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
});

export const blockUserSchema = z.object({
  reason: z.string().optional(),
});

export type AllianceUserInput = z.infer<typeof allianceUserSchema>;
export type BlockUserInput = z.infer<typeof blockUserSchema>;