export interface Alianza {
  id: string;
  nombre: string;
  code: string;
  rut: string;
  contacto: { fono?: string; email?: string };
  direccion?: string;
  descripcion?: string;
  comisionDegravamen: number; // porcentaje 0..100
  comisionCesantia: number; // porcentaje 0..100
  activo: boolean;
  fechaInicio: string;
  fechaTermino: string;
  createdAt: string;
  updatedAt: string;
}

export interface AlianzaHistoryEntry {
  id: string;
  alianzaId: string;
  changedBy: {
    id: string;
    name: string;
    email: string;
  };
  changedAt: string;
  changes: {
    field: string;
    fieldLabel: string;
    oldValue: string;
    newValue: string;
  }[];
  changeType: 'created' | 'updated' | 'status_changed';
}
