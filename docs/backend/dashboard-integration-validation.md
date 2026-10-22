# Integración Dashboard — contrato y validación

## Configuración

`VITE_API_BASE_URL=https://tedevuelvo-app-be.onrender.com/api/v1`

La configuración compartida normaliza la base para incluir `/api/v1` una sola vez. Login y renovación mantienen el mecanismo vigente; el dashboard usa `authenticatedFetch`, Bearer de la sesión actual y AbortSignal. No contiene credenciales, mocks de ejecución ni recuperación por listV2.

## Archivos

- `src/pages/Dashboard.tsx`: adaptadores de presentación y consultas agregadas en lugar de procesar solicitudes completas; pestañas y navegación existentes.
- `src/services/backofficeDashboardApi.ts`: contrato tipado, validación de campos imprescindibles, errores y referencias de diagnóstico.
- `src/hooks/useBackofficeDashboard.ts`: seis consultas independientes; resúmenes paralelos y gráficos bajo demanda; claves por alcance de sesión, endpoint, fechas y agrupación.
- `src/components/DashboardBlock.tsx`: carga, vacío, error, reintento controlado, datos anteriores del mismo rango y hora de consulta por bloque.
- `src/components/CallCenterInsuranceBreakdown.tsx`: tickets y porcentajes recibidos, sin recálculos.
- `src/state/AuthContext.tsx`: cancelación y eliminación del caché específico del dashboard al cerrar sesión o cambiar identidad/permisos.
- `src/services/apiConfig.ts`, `apiClient.ts`, `authService.ts`, `src/vite-env.d.ts`, `.env`, `.env.example`: URL por ambiente y reutilización del cliente autenticado.
- `tests/backofficeDashboardApi.test.ts`: pruebas aisladas del contrato y adaptadores; no sustituyen datos reales de la aplicación.
- `AGENTS.md`, `roadmap.md`: reglas de integración y pendientes.

## Corrección requerida al backend

El usuario confirmó que **la Prima total calculada debe mantenerse**. El PDF entregado documenta una fórmula mensual anterior. Corregir `/call-center-summary` para seleccionar `calculationSnapshot.newTotalPremium` cuando sea numérico, finito y mayor que cero; solo si no hay valor válido, usar `newMonthlyPremium × remainingInstallments`. Aplicar la misma selección al total y al desglose; calcular tickets en backend. Mantener primeras gestiones, fechas, conteos, grupos exclusivos y porcentajes. Actualizar contrato, documentación, pruebas y `meta.metricVersion`.

Caso de aceptación: `newTotalPremium=608013`, `newMonthlyPremium=18111`, `remainingInstallments=34` debe aportar **608013**, no **615774**. El frontend no descarga solicitudes para corregir una respuesta agregada incompatible con esta regla. El contrato 1.0 no ofrece un campo que certifique la fuente de prima; por tanto la fórmula real necesita confirmación y prueba del backend, no puede inferirse del total agregado.

## Comprobaciones

Pruebas locales: fechas sin conversión, limpiar/abrir rangos, granularidad solo en series, aislamiento de caché, valores de prima/ticket/share entregados, orden semanal heredado, buckets de pagos fuera del rango, error en respuestas incompletas, vacío válido, ruta/Accept/signal, errores no JSON, requestId, Retry-After y ausencia de URL. Las pruebas existentes de primeras gestiones y prima total permanecen intactas.

No se modificó `useAllRefunds`, `dashboardService`, `callCenterMetrics`, ni los archivos de Operación. Dashboard ya no los consume ni realiza lecturas de mandatos por registro.

## Validación real y límites

El 22 de octubre de 2026 UTC, una consulta pública a las seis rutas respondió **404** en la URL indicada. Esto no acredita su disponibilidad con una sesión autorizada. La renovación de la sesión de prueba previamente disponible respondió **401**; no se inventaron credenciales ni se reusó una contraseña.

Pendiente del ambiente real: GET autenticado de los seis endpoints, confirmación de fórmula de prima total desplegada, conciliación sobre un universo fijo, comportamiento real de token vencido/rol revocado/usuario inactivo, errores de cálculo/base y rendimiento con datos productivos. Operación debe comprobarse también con sesión válida; su fuente y endpoints se conservaron.

No publicar como integración productiva verificada hasta que backend confirme el despliegue y la corrección de prima total.