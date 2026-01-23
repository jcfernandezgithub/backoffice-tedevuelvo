import tasasSeguro from "../data/tasas_formateadas_te_devuelvo.json";
import tasasCesantiaBanco from "../data/tasas_cesantia_banco.json";
import tasasCesantiaTeDevuelvo from "../data/tasas_cesantia_te_devuelvo.json";
import { formatCurrency } from "./formatters";

// Constantes de tasas preferenciales por tramo de edad
const TASA_PREFERENCIAL_HASTA_55 = 0.0003; // 0.03% mensual
const TASA_PREFERENCIAL_DESDE_56 = 0.00039; // 0.039% mensual
const TASA_PREFERENCIAL_HASTA_55_ALTO = 0.000344; // 0.0344% mensual
const TASA_PREFERENCIAL_DESDE_56_ALTO = 0.000343; // 0.0343% mensual
const UMBRAL_MONTO_ALTO = 20000000; // 20 millones
const REFUND_MARGIN_PERCENTAGE = 10; // 10% margen

// Mapeo de instituciones
const MAPEO_INSTITUCIONES: { [key: string]: string } = {
  Santander: "BANCO SANTANDER",
  BCI: "BANCO BCI",
  "Lider BCI": "LIDER-BCI",
  Scotiabank: "SCOTIABANK",
  Chile: "BANCO CHILE",
  Security: "BANCO SECURITY",
  "Itaú - Corpbanca": "BANCO ITAU-CORPBANCA",
  BICE: "BANCO BICE",
  Estado: "BANCO ESTADO",
  "Banco Ripley": "BANCO RIPLEY",
  Falabella: "BANCO FALABELLA",
  Consorcio: "BANCO CONSORCIO",
  Condell: "BANCO CONSORCIO",
  Internacional: "BANCO CONSORCIO",
  Cencosud: "BANCO CENCOSUD",
  Coopeuch: "COOPEUCH",
  Cooperativas: "COOPERATIVAS",
  Financoop: "COOPEUCH",
  Ahorrocoop: "COOPEUCH",
  Libercoop: "COOPEUCH",
  Capual: "COOPEUCH",
  Bancrece: "COOPEUCH",
  Islacoop: "COOPEUCH",
  Forum: "FORUM",
  Tanner: "TANNER",
};

export interface CalculationResult {
  primaBanco: number;
  primaPreferencial: number;
  montoDevolucion: number;
  ahorroMensual: number;
  primaTotalBanco: number;
  primaTotalPreferencial: number;
  ahorroTotal: number;
  tasaAplicada: number;
  tramoUsado: string;
  tipoSeguro: string;
  desgravamen?: {
    primaBanco: number;
    primaPreferencial: number;
    montoDevolucion: number;
    tasaBanco: number;
    tasaPreferencial: number;
    cuotasUtilizadas?: number;
    montoRedondeado?: number;
    montoRestanteCredito?: number;
    // Montos intermedios del cálculo
    primaUnicaBanco?: number;
    seguroTotalBanco?: number;
    seguroTotalPreferencial?: number;
    primaMensualBanco?: number;
    primaMensualPreferencial?: number;
    seguroRestanteBanco?: number;
    seguroRestantePreferencial?: number;
  };
  cesantia?: {
    primaBanco: number;
    primaPreferencial: number;
    montoDevolucion: number;
    tramoUsado: string;
    tasaBanco: number;
    tasaPreferencial: number;
    // Montos intermedios del cálculo
    primaRestanteBanco?: number;
    primaRestantePreferencial?: number;
  };
  error?: string;
}

const obtenerTramo = (monto: number): string => {
  if (monto >= 500000 && monto <= 1000000) return "tramo_1";
  if (monto >= 1000001 && monto <= 3000000) return "tramo_2";
  if (monto >= 3000001 && monto <= 5000000) return "tramo_3";
  if (monto >= 5000001 && monto <= 7000000) return "tramo_4";
  if (monto >= 7000001) return "tramo_5";
  return "tramo_1";
};

const obtenerRangoTramo = (tramo: string): { desde: number; hasta: number | null } | null => {
  const rangos = {
    tramo_1: { desde: 500000, hasta: 1000000 },
    tramo_2: { desde: 1000001, hasta: 3000000 },
    tramo_3: { desde: 3000001, hasta: 5000000 },
    tramo_4: { desde: 5000001, hasta: 7000000 },
    tramo_5: { desde: 7000001, hasta: null },
  };
  return rangos[tramo as keyof typeof rangos] || null;
};

const obtenerTasaCesantiaBanco = (banco: string, monto: number): number | null => {
  try {
    const tramo = obtenerTramo(monto);
    if (!tasasCesantiaBanco[banco as keyof typeof tasasCesantiaBanco]) {
      return null;
    }
    const datosBanco = tasasCesantiaBanco[banco as keyof typeof tasasCesantiaBanco];
    const datosTramo = datosBanco[tramo as keyof typeof datosBanco];
    if (!datosTramo || typeof datosTramo !== "object") {
      return null;
    }
    return (datosTramo as { tasa_mensual: number }).tasa_mensual;
  } catch (error) {
    console.error("Error obteniendo tasa de cesantía del banco:", error);
    return null;
  }
};

const obtenerTasaCesantiaPreferencial = (monto: number): number => {
  const tramo = obtenerTramo(monto);
  const datos = tasasCesantiaTeDevuelvo.TE_DEVUELVO_CESANTIA;
  const datosTramo = datos[tramo as keyof typeof datos];
  return datosTramo.tasa_mensual;
};

const obtenerTasaBanco = (
  banco: string,
  edad: number,
  monto: number,
  cuotas: number,
): { tasa: number; cuotasUtilizadas: number; montoRedondeado: number } | null => {
  try {
    const tramo = edad <= 55 ? "hasta_55" : "desde_56";
    const montoRedondeado = Math.round(monto / 1000000) * 1000000;
    const montoFinal = Math.min(Math.max(montoRedondeado, 2000000), 60000000);

    if (!tasasSeguro[banco as keyof typeof tasasSeguro]) {
      console.warn(`Banco no encontrado: ${banco}`);
      return null;
    }

    const datosBanco = tasasSeguro[banco as keyof typeof tasasSeguro] as Record<string, Record<string, Record<string, number>>>;
    const datosTramo = datosBanco[tramo];
    const datosMonto = datosTramo?.[montoFinal.toString()];

    if (!datosMonto || typeof datosMonto !== "object") {
      console.warn(`No hay datos para monto ${montoFinal} en banco ${banco}`);
      return null;
    }

    let tasa = datosMonto[cuotas.toString()];
    let cuotasUtilizadas = cuotas;

    if (typeof tasa !== "number" || isNaN(tasa)) {
      const cuotasDisponibles = Object.keys(datosMonto)
        .map(Number)
        .filter((n) => !isNaN(n))
        .sort((a, b) => a - b);

      if (cuotasDisponibles.length === 0) {
        return null;
      }

      let cuotaCercana = cuotasDisponibles[0];
      let menorDiferencia = Math.abs(cuotas - cuotaCercana);

      for (const cuotaDisponible of cuotasDisponibles) {
        const diferencia = Math.abs(cuotas - cuotaDisponible);
        if (diferencia < menorDiferencia) {
          menorDiferencia = diferencia;
          cuotaCercana = cuotaDisponible;
        } else if (diferencia === menorDiferencia && cuotaDisponible > cuotaCercana) {
          cuotaCercana = cuotaDisponible;
        }
      }

      tasa = datosMonto[cuotaCercana.toString()];
      cuotasUtilizadas = cuotaCercana;
    }

    if (typeof tasa !== "number" || isNaN(tasa)) {
      return null;
    }

    return { tasa, cuotasUtilizadas, montoRedondeado: montoFinal };
  } catch (error) {
    console.error("Error obteniendo tasa del banco:", error);
    return null;
  }
};

const aplicarMargenDevolucion = (montoDevolucion: number): number => {
  const factor = 1 - (REFUND_MARGIN_PERCENTAGE / 100);
  return Math.round(montoDevolucion * factor);
};

const calcularCesantia = (banco: string, montoCredito: number, cuotasPendientes: number) => {
  const bancoMapeado = MAPEO_INSTITUCIONES[banco] || banco.toUpperCase();
  const tramo = obtenerTramo(montoCredito);
  const tasaBanco = obtenerTasaCesantiaBanco(bancoMapeado, montoCredito);
  const tasaPreferencial = obtenerTasaCesantiaPreferencial(montoCredito);

  if (tasaBanco === null) {
    throw new Error(`No hay datos de cesantía para ${banco}`);
  }

  const primaRestanteBanco = montoCredito * tasaBanco * cuotasPendientes;
  const primaRestantePreferencial = montoCredito * tasaPreferencial * cuotasPendientes;
  const montoDevolucion = primaRestanteBanco - primaRestantePreferencial;

  return {
    primaBanco: Math.round(primaRestanteBanco),
    primaPreferencial: Math.round(primaRestantePreferencial),
    montoDevolucion: Math.max(0, Math.round(montoDevolucion)),
    tramoUsado: tramo,
    tasaBanco,
    tasaPreferencial,
    primaRestanteBanco: Math.round(primaRestanteBanco),
    primaRestantePreferencial: Math.round(primaRestantePreferencial),
  };
};

export const calcularDevolucion = (
  banco: string,
  edad: number,
  montoCredito: number,
  cuotasTotales: number,
  cuotasPendientes: number,
  tipoSeguro: "desgravamen" | "cesantia" | "ambos" = "desgravamen",
): CalculationResult => {
  try {
    if (tipoSeguro === "cesantia") {
      const cesantia = calcularCesantia(banco, montoCredito, cuotasPendientes);
      const montoConMargen = aplicarMargenDevolucion(cesantia.montoDevolucion);

      return {
        primaBanco: 0,
        primaPreferencial: 0,
        montoDevolucion: montoConMargen,
        ahorroMensual: 0,
        primaTotalBanco: cesantia.primaBanco,
        primaTotalPreferencial: cesantia.primaPreferencial,
        ahorroTotal: montoConMargen,
        tasaAplicada: cesantia.tasaBanco,
        tramoUsado: cesantia.tramoUsado,
        tipoSeguro,
        cesantia,
      };
    } 
    
    if (tipoSeguro === "ambos") {
      const tramo = edad <= 55 ? "hasta_55" : "desde_56";
      const bancoMapeado = MAPEO_INSTITUCIONES[banco] || banco.toUpperCase();
      const resultadoTasa = obtenerTasaBanco(bancoMapeado, edad, montoCredito, cuotasTotales);

      if (resultadoTasa === null) {
        return {
          primaBanco: 0,
          primaPreferencial: 0,
          montoDevolucion: 0,
          ahorroMensual: 0,
          primaTotalBanco: 0,
          primaTotalPreferencial: 0,
          ahorroTotal: 0,
          tasaAplicada: 0,
          tramoUsado: tramo,
          tipoSeguro,
          error: `No hay datos disponibles para ${banco} con ${cuotasTotales} cuotas.`,
        };
      }

      const { tasa: tasaActual, cuotasUtilizadas, montoRedondeado } = resultadoTasa;
      const tasaPreferencial = montoCredito > UMBRAL_MONTO_ALTO
        ? (edad <= 55 ? TASA_PREFERENCIAL_HASTA_55_ALTO : TASA_PREFERENCIAL_DESDE_56_ALTO)
        : (edad <= 55 ? TASA_PREFERENCIAL_HASTA_55 : TASA_PREFERENCIAL_DESDE_56);

      const primaUnicaActual = montoCredito * tasaActual;
      const seguroTotalActual = (primaUnicaActual / cuotasUtilizadas) * cuotasTotales;
      const primaMensualActual = seguroTotalActual / cuotasTotales;
      const seguroRestanteActual = primaMensualActual * cuotasPendientes;
      const montoRestanteCredito = Math.round((montoCredito * (cuotasPendientes / cuotasTotales)));
      const seguroTotalPreferencial = montoRestanteCredito * tasaPreferencial * cuotasPendientes;
      const primaMensualPreferencial = seguroTotalPreferencial / cuotasPendientes;
      const seguroRestantePreferencial = primaMensualPreferencial * cuotasPendientes;
      const devolucionDesgravamen = seguroRestanteActual - seguroRestantePreferencial;

      const desgravamen = {
        primaBanco: Math.round(seguroRestanteActual),
        primaPreferencial: Math.round(seguroRestantePreferencial),
        montoDevolucion: Math.max(0, Math.round(devolucionDesgravamen)),
        tasaBanco: tasaActual,
        tasaPreferencial,
        cuotasUtilizadas,
        montoRedondeado,
        montoRestanteCredito,
        primaUnicaBanco: Math.round(primaUnicaActual),
        seguroTotalBanco: Math.round(seguroTotalActual),
        seguroTotalPreferencial: Math.round(seguroTotalPreferencial),
        primaMensualBanco: Math.round(primaMensualActual),
        primaMensualPreferencial: Math.round(primaMensualPreferencial),
        seguroRestanteBanco: Math.round(seguroRestanteActual),
        seguroRestantePreferencial: Math.round(seguroRestantePreferencial),
      };

      const cesantia = calcularCesantia(banco, montoCredito, cuotasPendientes);
      const montoDevolucionTotal = desgravamen.montoDevolucion + cesantia.montoDevolucion;
      const montoConMargen = aplicarMargenDevolucion(montoDevolucionTotal);

      return {
        primaBanco: Math.round(primaMensualActual),
        primaPreferencial: Math.round(primaMensualPreferencial),
        montoDevolucion: montoConMargen,
        ahorroMensual: Math.round(primaMensualActual - primaMensualPreferencial),
        primaTotalBanco: desgravamen.primaBanco + cesantia.primaBanco,
        primaTotalPreferencial: desgravamen.primaPreferencial + cesantia.primaPreferencial,
        ahorroTotal: montoConMargen,
        tasaAplicada: tasaActual,
        tramoUsado: tramo,
        tipoSeguro,
        desgravamen,
        cesantia,
      };
    }
    
    // Solo desgravamen
    const tramo = edad <= 55 ? "hasta_55" : "desde_56";
    const bancoMapeado = MAPEO_INSTITUCIONES[banco] || banco.toUpperCase();
    const resultadoTasa = obtenerTasaBanco(bancoMapeado, edad, montoCredito, cuotasTotales);

    if (resultadoTasa === null) {
      return {
        primaBanco: 0,
        primaPreferencial: 0,
        montoDevolucion: 0,
        ahorroMensual: 0,
        primaTotalBanco: 0,
        primaTotalPreferencial: 0,
        ahorroTotal: 0,
        tasaAplicada: 0,
        tramoUsado: tramo,
        tipoSeguro,
        error: `No hay datos disponibles para ${banco} con ${cuotasTotales} cuotas.`,
      };
    }

    const { tasa: tasaActual, cuotasUtilizadas, montoRedondeado } = resultadoTasa;
    const tasaPreferencial = montoCredito > UMBRAL_MONTO_ALTO
      ? (edad <= 55 ? TASA_PREFERENCIAL_HASTA_55_ALTO : TASA_PREFERENCIAL_DESDE_56_ALTO)
      : (edad <= 55 ? TASA_PREFERENCIAL_HASTA_55 : TASA_PREFERENCIAL_DESDE_56);

    const primaUnicaActual = montoCredito * tasaActual;
    const seguroTotalActual = (primaUnicaActual / cuotasUtilizadas) * cuotasTotales;
    const primaMensualActual = seguroTotalActual / cuotasTotales;
    const seguroRestanteActual = primaMensualActual * cuotasPendientes;
    const montoRestanteCredito = Math.round((montoCredito * (cuotasPendientes / cuotasTotales)));
    const seguroTotalPreferencial = montoRestanteCredito * tasaPreferencial * cuotasPendientes;
    const primaMensualPreferencial = seguroTotalPreferencial / cuotasPendientes;
    const seguroRestantePreferencial = primaMensualPreferencial * cuotasPendientes;
    const devolucion = seguroRestanteActual - seguroRestantePreferencial;
    const devolucionConMargen = aplicarMargenDevolucion(devolucion);

    const desgravamen = {
      primaBanco: Math.round(seguroRestanteActual),
      primaPreferencial: Math.round(seguroRestantePreferencial),
      montoDevolucion: Math.max(0, Math.round(devolucionConMargen)),
      tasaBanco: tasaActual,
      tasaPreferencial,
      cuotasUtilizadas,
      montoRedondeado,
      montoRestanteCredito,
      primaUnicaBanco: Math.round(primaUnicaActual),
      seguroTotalBanco: Math.round(seguroTotalActual),
      seguroTotalPreferencial: Math.round(seguroTotalPreferencial),
      primaMensualBanco: Math.round(primaMensualActual),
      primaMensualPreferencial: Math.round(primaMensualPreferencial),
      seguroRestanteBanco: Math.round(seguroRestanteActual),
      seguroRestantePreferencial: Math.round(seguroRestantePreferencial),
    };

    return {
      primaBanco: Math.round(primaMensualActual),
      primaPreferencial: Math.round(primaMensualPreferencial),
      montoDevolucion: Math.max(0, Math.round(devolucionConMargen)),
      ahorroMensual: Math.round(primaMensualActual - primaMensualPreferencial),
      primaTotalBanco: Math.round(seguroRestanteActual),
      primaTotalPreferencial: Math.round(seguroRestantePreferencial),
      ahorroTotal: Math.max(0, Math.round(devolucionConMargen)),
      tasaAplicada: tasaActual,
      tramoUsado: tramo,
      tipoSeguro,
      desgravamen,
    };
  } catch (error) {
    console.error("Error en el cálculo:", error);
    return {
      primaBanco: 0,
      primaPreferencial: 0,
      montoDevolucion: 0,
      ahorroMensual: 0,
      primaTotalBanco: 0,
      primaTotalPreferencial: 0,
      ahorroTotal: 0,
      tasaAplicada: 0,
      tramoUsado: "",
      tipoSeguro,
      error: error instanceof Error ? error.message : "Error interno en el cálculo.",
    };
  }
};

// Lista de instituciones disponibles
export const INSTITUCIONES_DISPONIBLES = [
  "Santander",
  "BCI",
  "Lider BCI",
  "Scotiabank",
  "Chile",
  "Security",
  "Itaú - Corpbanca",
  "BICE",
  "Estado",
  "Banco Ripley",
  "Falabella",
  "Consorcio",
  "Coopeuch",
  "Cencosud",
  "Forum",
  "Tanner",
  "Cooperativas",
];
