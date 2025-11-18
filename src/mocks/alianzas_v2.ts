import type { Alianza } from '../types/alianzas'

export const alianzasMock: Alianza[] = [
  {
    id: 'AL-001',
    nombre: 'Sindicato Financiero Andes',
    rut: '76.123.456-7',
    contacto: { fono: '+56 9 5555 1111', email: 'contacto@sindicatoandes.cl' },
    direccion: 'Av. Apoquindo 1234, Las Condes',
    descripcion: 'Alianza estratégica con sindicato para productos financieros',
    comisionDegravamen: 12.5,
    comisionCesantia: 8.0,
    activo: true,
    fechaInicio: '2025-01-01T00:00:00Z',
    fechaTermino: '2026-01-01T00:00:00Z',
    createdAt: '2025-06-10T10:00:00Z',
    updatedAt: '2025-06-10T10:00:00Z',
  },
  {
    id: 'AL-002',
    nombre: 'Broker Pacífico',
    rut: '76.987.654-3',
    contacto: { fono: '+56 2 2345 6789', email: 'ventas@brokerpacifico.cl' },
    direccion: 'Huérfanos 456, Santiago',
    descripcion: 'Convenio comercial para intermediación de seguros',
    comisionDegravamen: 8.0,
    comisionCesantia: 5.5,
    activo: true,
    fechaInicio: '2025-03-01T00:00:00Z',
    fechaTermino: '2026-03-01T00:00:00Z',
    createdAt: '2025-07-01T15:30:00Z',
    updatedAt: '2025-07-01T15:30:00Z',
  },
]
