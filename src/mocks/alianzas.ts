import { Alianza } from "@/types/domain"

export const alianzasMock: Alianza[] = [
  {
    id: "al-rrhh-1",
    nombre: "Alianza RRHH Corp",
    tipo: "RRHH",
    rut: "76.123.456-7",
    emailContacto: "contacto@rrhhcorp.cl",
    telefonoContacto: "+56 9 5555 5555",
    porcentajeComision: 8,
    activo: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    notas: "Convenio marco 2024",
  },
  {
    id: "al-sind-1",
    nombre: "Sindicato ABC",
    tipo: "SINDICATO",
    porcentajeComision: 5,
    activo: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
]
