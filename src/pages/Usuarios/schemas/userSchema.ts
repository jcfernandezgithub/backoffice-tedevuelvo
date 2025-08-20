import { z } from 'zod';
import type { Role } from '../types/userTypes';

export const userSchema = z.object({
  name: z.string()
    .min(1, 'El nombre es obligatorio')
    .refine((val) => val.trim().split(' ').length >= 2, {
      message: 'Debe incluir nombre y apellido'
    }),
  email: z.string()
    .min(1, 'El correo es obligatorio')
    .email('Formato de correo inválido'),
  phone: z.string()
    .min(1, 'El teléfono es obligatorio')
    .regex(/^(\+56|56)?[0-9\s\-()]{8,15}$/, 'Formato de teléfono chileno inválido'),
  role: z.enum(['ADMIN', 'CONSULTANT'] as const, {
    required_error: 'Debe seleccionar un perfil'
  }),
  sendInvitation: z.boolean().default(true)
});

export const passwordSchema = z.object({
  password: z.string()
    .min(8, 'Mínimo 8 caracteres')
    .regex(/[A-Z]/, 'Debe contener al menos una mayúscula')
    .regex(/[a-z]/, 'Debe contener al menos una minúscula')
    .regex(/[0-9]/, 'Debe contener al menos un número')
    .regex(/[^A-Za-z0-9]/, 'Debe contener al menos un carácter especial'),
  confirmPassword: z.string()
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Las contraseñas no coinciden',
  path: ['confirmPassword']
});

export const blockUserSchema = z.object({
  reason: z.string().optional()
});

export type UserFormData = z.infer<typeof userSchema>;
export type PasswordFormData = z.infer<typeof passwordSchema>;
export type BlockUserFormData = z.infer<typeof blockUserSchema>;