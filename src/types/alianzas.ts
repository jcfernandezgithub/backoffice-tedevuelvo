export interface Alianza {
  id: string;
  nombre: string;
  contacto: { fono?: string; email?: string };
  direccion?: string;
  descripcion?: string;
  comisionDegravamen: number; // porcentaje 0..100
  comisionCesantia: number; // porcentaje 0..100
  activo: boolean;
  fechaInicio: string;
  fechaTermino: string;
  logo?: string;
  createdAt: string;
  updatedAt: string;
}
