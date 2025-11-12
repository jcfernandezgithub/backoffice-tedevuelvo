export interface Alianza {
  id: string;
  nombre: string;
  contacto: { fono?: string; email?: string };
  direccion?: string;
  comision: number; // porcentaje 0..30
  activo: boolean;
  vigencia: boolean;
  fechaInicio: string;
  fechaTermino: string;
  logo?: string;
  createdAt: string;
  updatedAt: string;
}
