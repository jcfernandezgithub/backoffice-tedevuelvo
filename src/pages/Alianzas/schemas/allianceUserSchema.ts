import { z } from 'zod';

const phoneRegex = /^(\+56\s?)?([2-9]\d{8}|9\d{8})$/;
// RUT puede ser con puntos (12.345.678-9) o sin puntos (12345678-9)
const rutRegex = /^(\d{1,2}\.?\d{3}\.?\d{3}-[\dkK])$/;

// Función para validar dígito verificador del RUT chileno
function validateRutDigit(rut: string): boolean {
  // Limpiar el RUT (quitar puntos y guión)
  const cleanRut = rut.replace(/\./g, '').replace(/-/g, '');
  
  if (cleanRut.length < 2) return false;
  
  const rutNumber = cleanRut.slice(0, -1);
  const digit = cleanRut.slice(-1).toUpperCase();
  
  // Validar que la parte numérica solo contenga dígitos
  if (!/^\d+$/.test(rutNumber)) return false;
  
  // Calcular dígito verificador
  let sum = 0;
  let multiplier = 2;
  
  for (let i = rutNumber.length - 1; i >= 0; i--) {
    sum += parseInt(rutNumber[i]) * multiplier;
    multiplier = multiplier === 7 ? 2 : multiplier + 1;
  }
  
  const remainder = sum % 11;
  const calculatedDigit = remainder === 0 ? '0' : remainder === 1 ? 'K' : String(11 - remainder);
  
  return digit === calculatedDigit;
}

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
    .refine((val) => rutRegex.test(val), 'Formato de RUT inválido. Use: 12345678-9 o 12.345.678-9')
    .refine((val) => validateRutDigit(val), 'Dígito verificador del RUT es inválido'),
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