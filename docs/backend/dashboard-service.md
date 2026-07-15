# Dashboard Service — Especificación para Backend

> **Objetivo:** hoy la página `/dashboard` del backoffice descarga **todas** las
> solicitudes de refunds del período (paginación paralela sobre
> `GET /refund-requests/admin/search`) y calcula KPIs, series temporales,
> distribuciones y sub‑métricas **en el cliente**. Esto es lento (segundos a
> decenas de segundos con volúmenes altos), consume ancho de banda innecesario
> y obliga al front a replicar reglas de negocio (transiciones, `realAmount`,
> firma de mandato, presencia de datos bancarios, etc.).
>
> Se solicita al equipo backend construir **endpoints agregados** que devuelvan
> únicamente los números que el dashboard necesita, calculados server‑side
> sobre Mongo. El front pasará a consumir estos endpoints en lugar de listar y
> reducir en memoria.

---

## 1. Convenciones generales

- **Base URL:** `/api/v1/dashboard`
- **Auth:** Bearer JWT (mismo esquema que el resto del admin).
- **Zona horaria:** todas las fechas se interpretan en `America/Santiago`.
  Los buckets diarios/semanales/mensuales se construyen en esa TZ.
- **Formato de fechas de entrada:** `YYYY-MM-DD` (día local Santiago,
  inclusivo en ambos extremos).
- **Formato de fechas de salida:** ISO 8601 en UTC (`...Z`) o `YYYY-MM-DD`
  cuando corresponda a un bucket de día.
- **Filtro por defecto:** todos los endpoints filtran por `createdAt` de la
  solicitud, salvo que se indique lo contrario (los agregados de Call Center
  filtran por **fecha de transición** a `docs_received`; los pagos filtran por
  la fecha de transición a `paid`/`payment_scheduled`).
- **Estados:** en la respuesta usar los mismos strings en **minúsculas** que
  hoy consume el front:
  `datos_sin_simulacion`, `simulated`, `requested`, `qualifying`,
  `docs_pending`, `docs_received`, `submitted`, `approved`,
  `payment_scheduled`, `paid`, `rejected`, `canceled`.
- **Query params comunes:**
  - `from` (`YYYY-MM-DD`, requerido en la mayoría) — inicio del rango.
  - `to`   (`YYYY-MM-DD`, requerido en la mayoría) — fin del rango, inclusivo.
  - `granularity` (`day` | `week` | `month`) — sólo en endpoints de series
    temporales. Semana ISO (lunes–domingo).
- **Caché sugerido:** `Cache-Control: private, max-age=30` (el front usa
  React Query con `staleTime` de 30 s).
- **Errores:** JSON `{ "error": { "code": "...", "message": "..." } }` con
  status HTTP estándar (400 params inválidos, 401 sin auth, 500 interno).

---

## 2. Endpoints requeridos

### 2.1 `GET /dashboard/summary`

Devuelve todos los KPIs de la fila superior + conteos granulares por estado.
**Reemplaza** el fetch completo actual para poblar las calugas de resumen y
las tarjetas del pipeline.

**Query:** `from`, `to`.

**Respuesta:**

```json
{
  "range": { "from": "2026-07-01", "to": "2026-07-15" },
  "totals": {
    "totalRequests": 1240,
    "inProgress": 812,
    "paid": 143,
    "conversionRate": 0.115,
    "totalPaidAmount": 92450123
  },
  "statusCounts": {
    "datos_sin_simulacion": 210,
    "simulated": 305,
    "requested": 0,
    "qualifying": 180,
    "docs_pending": 220,
    "docs_received": 45,
    "submitted": 120,
    "approved": 90,
    "payment_scheduled": 157,
    "paid": 143,
    "rejected": 40,
    "canceled": 30
  },
  "qualifying": {
    "total": 180,
    "mandateSigned": 96,
    "mandatePending": 84
  },
  "paymentScheduled": {
    "total": 157,
    "withBankInfo": 41,
    "withoutBankInfo": 116
  }
}
```

**Reglas de cálculo:**

- `totals.totalRequests` = suma de `statusCounts`.
- `totals.inProgress` = suma de:
  `qualifying + docs_pending + docs_received + submitted + approved + payment_scheduled`.
- `totals.paid` = `statusCounts.paid`.
- `totals.conversionRate` = `paid / (totalRequests - datos_sin_simulacion)`
  (0 si el denominador es 0). Devolver **decimal** (`0.115`), no porcentaje.
- `totals.totalPaidAmount` = **suma del `realAmount`** de las solicitudes en
  estado `paid` dentro del rango. `realAmount` se obtiene del último item de
  `statusHistory` cuyo `to` sea `payment_scheduled` o `paid` y que tenga
  `realAmount` definido. Si no existe, esa solicitud aporta 0 (**no** usar
  `estimatedAmountCLP` como fallback en este KPI).
- `qualifying.mandateSigned` = solicitudes en estado `qualifying` con
  `hasSignedPdf === true`.
- `qualifying.mandatePending` = el resto de las `qualifying`.
- `paymentScheduled.withBankInfo` = solicitudes en `payment_scheduled` con
  `bankInfo` presente (objeto no nulo).
- `paymentScheduled.withoutBankInfo` = el resto de las `payment_scheduled`.
- **Filtro de fecha:** por `createdAt` (día local Santiago), inclusivo.

---

### 2.2 `GET /dashboard/requests-timeseries`

Serie temporal de **solicitudes creadas** agrupadas por día/semana/mes.

**Query:** `from`, `to`, `granularity`.

**Respuesta:**

```json
{
  "range": { "from": "2026-07-01", "to": "2026-07-15" },
  "granularity": "day",
  "series": [
    { "bucket": "2026-07-01", "value": 42 },
    { "bucket": "2026-07-02", "value": 55 }
  ]
}
```

**Reglas:**

- Agrupar por `createdAt` en día local Santiago.
- Formato de `bucket`:
  - `day` → `YYYY-MM-DD`
  - `week` → `YYYY-Www` (semana ISO, ej. `2026-W28`)
  - `month` → `YYYY-MM`
- **Incluir buckets con `value = 0`** dentro del rango solicitado, para que el
  gráfico no tenga huecos.

> Nota: si ya existe `/dashboard/requests-timeseries`, validar que filtre por
> `createdAt` (no `updatedAt`) y que rellene los buckets vacíos.

---

### 2.3 `GET /dashboard/payments-timeseries`

Serie temporal del **monto real pagado** a clientes, agrupado por día/semana/mes.

**Query:** `from`, `to`, `granularity`.

**Respuesta:**

```json
{
  "range": { "from": "2026-07-01", "to": "2026-07-15" },
  "granularity": "day",
  "total": 92450123,
  "series": [
    { "bucket": "2026-07-01", "amount": 3120000 },
    { "bucket": "2026-07-02", "amount": 5480500 }
  ]
}
```

**Reglas:**

- Considerar únicamente solicitudes en estado `paid` dentro del rango.
- Fecha de agrupación: `updatedAt` de la solicitud (día local Santiago).
- Monto por solicitud: `realAmount` del último item de `statusHistory` cuyo
  `to` sea `payment_scheduled` o `paid` y tenga `realAmount`. Fallback a
  `estimatedAmountCLP` si no hay `realAmount`.
- `total` = suma de todos los `amount` de la serie.
- Rellenar buckets con `amount = 0`.

---

### 2.4 `GET /dashboard/status-distribution`

Distribución de solicitudes por estado (alimenta el gráfico de torta).

**Query:** `from`, `to`.

**Respuesta:**

```json
{
  "range": { "from": "2026-07-01", "to": "2026-07-15" },
  "total": 1240,
  "buckets": [
    { "status": "datos_sin_simulacion", "label": "Sin simulación", "count": 210, "pct": 16.9 },
    { "status": "simulated",            "label": "Simulado",       "count": 305, "pct": 24.6 }
  ]
}
```

**Reglas:**

- Un item por cada estado con `count > 0`.
- `pct` = `count / total * 100`, redondeado a 1 decimal.
- Filtro por `createdAt`.
- El `label` se puede omitir; si viene, usar los labels del front (ver §5).

---

### 2.5 `GET /dashboard/call-center-summary`

KPIs del bloque **Call Center** (solicitudes que transitaron a
`docs_received` dentro del rango, excluyendo canceladas).

**Query:** `from`, `to`.

**Respuesta:**

```json
{
  "range": { "from": "2026-07-01", "to": "2026-07-15" },
  "managedRequests": 87,
  "totalEstimatedPremiums": 45320100,
  "averageTicket": 520921
}
```

**Reglas de cálculo:**

- Universo: solicitudes con **al menos una transición** en `statusHistory`
  donde `to = docs_received`, `from != docs_received` y `at` (día local
  Santiago) esté dentro del rango. Excluir solicitudes cuyo estado actual sea
  `canceled`.
- `managedRequests` = cantidad de solicitudes del universo (una por
  solicitud, aunque tenga múltiples transiciones válidas).
- `totalEstimatedPremiums` = suma sobre el universo de
  `calculationSnapshot.newMonthlyPremium * calculationSnapshot.remainingInstallments`
  (tratar campos faltantes como 0).
- `averageTicket` = `totalEstimatedPremiums / managedRequests` redondeado
  (0 si no hay solicitudes).

---

### 2.6 `GET /dashboard/call-center-timeseries`

Serie temporal de solicitudes gestionadas por Call Center.

**Query:** `from`, `to`, `granularity`.

**Respuesta:** mismo shape que §2.2 (`bucket` + `value`).

**Reglas:**

- Contar **una vez por solicitud por bucket**, usando la fecha de la
  primera transición válida a `docs_received` dentro del bucket (misma regla
  de exclusión que §2.5).
- Rellenar buckets vacíos con `value = 0`.

---

## 3. Contrato de tipos (TypeScript, referencia para el front)

```ts
export type DashboardStatus =
  | 'datos_sin_simulacion' | 'simulated' | 'requested'
  | 'qualifying' | 'docs_pending' | 'docs_received'
  | 'submitted' | 'approved' | 'payment_scheduled' | 'paid'
  | 'rejected' | 'canceled'

export interface DashboardSummary {
  range: { from: string; to: string }
  totals: {
    totalRequests: number
    inProgress: number
    paid: number
    conversionRate: number   // 0..1
    totalPaidAmount: number  // CLP
  }
  statusCounts: Record<DashboardStatus, number>
  qualifying:       { total: number; mandateSigned: number; mandatePending: number }
  paymentScheduled: { total: number; withBankInfo: number; withoutBankInfo: number }
}

export interface TimeseriesResponse {
  range: { from: string; to: string }
  granularity: 'day' | 'week' | 'month'
  series: { bucket: string; value: number }[]
}

export interface PaymentsTimeseriesResponse extends Omit<TimeseriesResponse, 'series'> {
  total: number
  series: { bucket: string; amount: number }[]
}

export interface StatusDistributionResponse {
  range: { from: string; to: string }
  total: number
  buckets: { status: DashboardStatus; label?: string; count: number; pct: number }[]
}

export interface CallCenterSummary {
  range: { from: string; to: string }
  managedRequests: number
  totalEstimatedPremiums: number
  averageTicket: number
}
```

---

## 4. Reglas de negocio críticas (repetidas para evitar ambigüedad)

1. **TZ:** siempre `America/Santiago`. Convertir `createdAt`, `updatedAt` y
   `statusHistory[].at` a esa zona **antes** de recortar por día.
2. **`realAmount`:** buscar en `statusHistory` recorriendo **de más nuevo a
   más antiguo** el primer item con `to ∈ {payment_scheduled, paid}` y
   `realAmount` definido. No sumar `realAmount` de items intermedios ni
   duplicados.
3. **Transiciones válidas:** una transición es "válida" cuando
   `from !== to`. Ignorar re‑escrituras del mismo estado.
4. **Exclusiones:** los bloques de Call Center (§2.5 y §2.6) excluyen
   solicitudes cuyo **estado actual** sea `canceled`, aunque hayan pasado
   por `docs_received` antes.
5. **`mandateSigned`:** hoy el front lee `hasSignedPdf` a nivel de refund
   (viene en `listV2`). El backend debe exponer el mismo boolean o calcular
   internamente `hasSignedPdf` con la lógica actual del sistema de mandatos.
6. **`bankInfo`:** `withBankInfo` = `bankInfo != null` (objeto). Basta con
   verificar existencia, no validar cada campo.

---

## 5. Labels de estados (para respuestas y i18n)

| status                 | label ES              |
|------------------------|-----------------------|
| datos_sin_simulacion   | Sin simulación        |
| simulated              | Simulado              |
| requested              | Solicitado            |
| qualifying             | En calificación       |
| docs_pending           | Docs. pendientes      |
| docs_received          | Docs. recibidos       |
| submitted              | Ingresado             |
| approved               | Aprobado              |
| payment_scheduled      | Pago programado       |
| paid                   | Pagado                |
| rejected               | Rechazado             |
| canceled               | Cancelado             |

---

## 6. Consideraciones de performance

- Todos los endpoints deben resolverse con **queries agregadas de Mongo**
  (`$match` + `$group` / `$facet`), no cargando documentos completos a memoria.
- Índices recomendados:
  - `{ createdAt: 1, status: 1 }`
  - `{ status: 1, updatedAt: 1 }`
  - `{ "statusHistory.to": 1, "statusHistory.at": 1 }` (multikey)
- Se sugiere un **facet único interno** para `/dashboard/summary` que calcule
  en una sola pipeline: `statusCounts`, `qualifying`, `paymentScheduled` y
  `totalPaidAmount`.
- Objetivo de latencia: **< 500 ms p95** para rangos de hasta 90 días con
  ~50k solicitudes en la colección.

---

## 7. Roadmap de integración en el front

1. Publicar los 6 endpoints en un ambiente de pruebas.
2. El front creará `src/services/dashboardApi.ts` con un cliente por endpoint.
3. `src/pages/Dashboard.tsx` reemplazará el uso de `useAllRefunds` +
   reducers por 6 hooks `useQuery` independientes (uno por endpoint), lo que
   permitirá **cargar en paralelo** y mostrar skeletons por sección.
4. Se eliminará `src/services/dashboardService.ts` (caché manual y
   paginación paralela) una vez validado el nuevo flujo.
5. Se mantendrán los mismos filtros y presets de fecha; sólo cambia la fuente
   de datos.

---

**Contacto front:** equipo Backoffice Te Devuelvo.
**Versión de este documento:** 1.0 — 2026‑07‑15.
