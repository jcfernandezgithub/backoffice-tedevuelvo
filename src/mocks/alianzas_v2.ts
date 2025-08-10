import type { Alianza } from '../types/alianzas'

export const alianzasMock: Alianza[] = [
  {
    id: 'AL-001',
    nombre: 'Sindicato Financiero Andes',
    contacto: { fono: '+56 9 5555 1111', email: 'contacto@sindicatoandes.cl' },
    direccion: 'Av. Apoquindo 1234, Las Condes',
    comision: 12.5,
    activo: true,
    createdAt: '2025-06-10T10:00:00Z',
    updatedAt: '2025-06-10T10:00:00Z',
  },
  {
    id: 'AL-002',
    nombre: 'Broker Pacífico',
    contacto: { fono: '+56 2 2345 6789', email: 'ventas@brokerpacifico.cl' },
    direccion: 'Huérfanos 456, Santiago',
    comision: 8.0,
    activo: true,
    createdAt: '2025-07-01T15:30:00Z',
    updatedAt: '2025-07-01T15:30:00Z',
  },
]
