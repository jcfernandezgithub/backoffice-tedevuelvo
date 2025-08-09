import { Solicitud } from "@/types/domain"

export const solicitudesMock: Solicitud[] = [
  {
    id: "sol-1001",
    cliente: {
      rut: "12.345.678-9",
      nombre: "Juan Pérez",
      email: "juan.perez@example.com",
      telefono: "+56 9 1111 1111",
      banco: "Banco Chile",
      edad: 34,
    },
    credito: {
      monto: 4500000,
      cuotasTotales: 48,
      cuotasPendientes: 30,
      tipoSeguro: "CESANTIA",
    },
    alianzaId: "al-rrhh-1",
    estado: "SIMULACION_CONFIRMADA",
    montoADevolverEstimado: 280000,
    timeline: [
      { fecha: new Date().toISOString(), evento: "SIMULACION_CONFIRMADA", detalle: "Docs ok" },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "sol-1002",
    cliente: {
      rut: "18.765.432-1",
      nombre: "María López",
      email: "maria.lopez@example.com",
      telefono: "+56 9 2222 2222",
      banco: "Banco Estado",
      edad: 41,
    },
    credito: {
      monto: 3200000,
      cuotasTotales: 36,
      cuotasPendientes: 18,
      tipoSeguro: "DESGRAVAMEN",
    },
    estado: "DEVOLUCION_CONFIRMADA_COMPANIA",
    montoADevolverEstimado: 150000,
    timeline: [
      { fecha: new Date().toISOString(), evento: "SIMULACION_CONFIRMADA" },
      { fecha: new Date().toISOString(), evento: "DEVOLUCION_CONFIRMADA_COMPANIA", detalle: "Ref 123" },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
]
