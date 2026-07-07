## Contexto revisado

- **Página**: `src/pages/Conciliacion/index.tsx` lista los abonos del XML de la cartola. Cada fila abre `LinkRefundsDialog` (conciliación manual) mediante el botón **Conciliar / Ver·editar**.
- **Servicio**: `cartolaLinksService` (`/bank/reconciliation`) ya soporta:
  - `applyMatches(documentoNumero, [{ publicId, amountApplied }])`
  - `getByMovement(documentoNumero)` / `getBulk(...)` / `removeLink(id)`
- **Solicitudes**: se obtienen vía `refundAdminApi.search`. El "número de operación" del CSV corresponde a `calculationSnapshot.nroCredito` de cada solicitud (mismo campo usado en corte, cesantía, listados y wizard masivo). El backend expone `search` pero **no un lookup exacto por `nroCredito`**, por lo que la coincidencia se resolverá cargando el universo de solicitudes en estado *Pago programado* (misma estrategia que ya usa `usePendingRefunds`) e indexando por `nroCredito` en el cliente.
- **Modelo de link**: cada asociación guarda `refundId (publicId)` + `amountApplied`. No hay campos de "respaldo" (rut/nombre/póliza/monto CSV) hoy; los guardaremos como metadatos locales en el resultado del proceso y en un historial en `localStorage` (no hay endpoint aún — se deja preparado para migrar).

## Alcance de esta iteración (frontend)

No se modifica la conciliación manual existente. Se agrega el flujo CSV como una acción adicional por movimiento, reutilizando el mismo endpoint `POST /bank/reconciliation` (una llamada por movimiento con todos los matches válidos), lo que mantiene la operación atómica del lado servidor.

## Cambios

1. **Nueva acción por movimiento**
   - En la columna *Conciliación* de la tabla, además del botón actual, agregar un menú (`DropdownMenu`) con dos opciones:
     - *Conciliar manualmente* (comportamiento actual).
     - *Conciliar mediante CSV* → abre el nuevo diálogo.
   - Ícono `FileSpreadsheet` para diferenciar.

2. **Nuevo diálogo `CsvReconcileDialog`** (`src/pages/Conciliacion/components/CsvReconcileDialog.tsx`)
   - Header con datos del movimiento (fecha, descripción, doc., abono, saldo disponible).
   - **Paso 1 – Cargar archivo**
     - Zona *drag & drop* + input file (`.csv` únicamente).
     - Botón *Descargar plantilla* que genera `plantilla_conciliacion.csv` con headers `nombre_cliente,rut,numero_operacion,poliza,monto` y una fila de ejemplo.
     - Parser con PapaParse (`bun add papaparse`) forzando `numero_operacion` y `rut` como texto, `header: true`, `skipEmptyLines: 'greedy'`.
     - Validaciones estructurales antes de habilitar *Procesar*:
       - extensión `.csv`, tamaño ≤ 5 MB;
       - columnas obligatorias presentes;
       - máx. 5.000 filas;
       - por fila: `numero_operacion` no vacío, `monto` numérico > 0, fila no totalmente vacía;
       - duplicados de `numero_operacion` dentro del archivo → marcados como advertencia (se procesa solo el primero).
     - Mensajes de error específicos por tipo (columna faltante, fila X con monto inválido, etc.). Nunca "ocurrió un error".
   - **Paso 2 – Vista previa**
     - Tabla con las filas normalizadas + estado preliminar (Válida / Duplicada en CSV / Error de formato).
     - Contadores y botón *Procesar conciliación* con `ConfirmDialog` previo.
   - **Paso 3 – Resultado**
     - Barra de progreso durante la ejecución.
     - Resumen con los indicadores solicitados (procesadas, conciliadas, no encontradas, duplicadas CSV, coincidencias duplicadas en sistema, ya conciliadas, asociadas a otro movimiento, errores de formato).
     - Tabla con: fila, nombre, rut, nº operación, póliza, monto, estado, detalle.
     - Filtro por estado (tabs / select) + acciones: *Descargar CSV de resultados*, *Reintentar solo errores* (vuelve al paso 2 con esas filas), *Ver solicitudes conciliadas* (navega al listado filtrando por publicIds), *Cerrar*.

3. **Lógica de matching** (`src/pages/Conciliacion/services/csvReconcileService.ts`)
   - Cargar en paralelo:
     - Universo de solicitudes en `payment_scheduled` (reusa `usePendingRefunds` /`refundAdminApi.search` con paginación en paralelo — mismo patrón existente).
     - `cartolaLinksService.getBulk(todos los documento_numero visibles)` para saber qué publicIds ya están asociados y a qué movimiento.
   - Normalización: `nroCredito.trim().toUpperCase()` como key; RUT normalizado (sin puntos ni guión) solo para *display*, no para match.
   - Por cada fila:
     - Buscar coincidencias por `nroCredito` en el universo.
     - 0 → *Solicitud no encontrada*.
     - >1 → *Coincidencia duplicada en sistema* (no asocia).
     - 1:
       - Si su `publicId` está en links del mismo `documentoNumero` → *Ya conciliada*.
       - Si está en links de otro movimiento → *Asociada a otro movimiento*.
       - Si no → candidato válido con `amountApplied = monto CSV` (validado contra saldo restante del abono).
   - Al pulsar procesar: ejecutar **una sola** llamada `applyMatches(documentoNumero, candidatosValidos)` para mantener la transaccionalidad ya provista por el backend. Si el POST falla, ningún candidato queda asociado y se muestra el error del backend por fila (todas quedan en estado *Error* con detalle común).

4. **Historial por movimiento**
   - Nueva pestaña *Historial CSV* dentro del mismo diálogo (o link *Ver historial* en el menú del movimiento) que lee de `localStorage` bajo `cartola-csv-history:<documentoNumero>`.
   - Guarda: nombre archivo, fecha/hora, usuario (de `AuthContext`), totales por estado, estado global, tabla completa de filas procesadas.
   - Se deja un `TODO` documentado para migrar a un endpoint real cuando esté disponible.

5. **Dependencias**
   - `papaparse` + `@types/papaparse` (parser CSV robusto, maneja comillas y separadores).

6. **README + versión**
   - Nueva entrada `### Versión 4.1.2` en `README.md` describiendo la funcionalidad.
   - Actualizar `Versión 4.1.2` en el footer de `src/pages/auth/Login.tsx`.

## Detalles técnicos

- **Reuso**: `Dialog`, `Table`, `Badge`, `Button`, `ScrollArea`, `Tabs`, `ConfirmDialog`, `Progress` (shadcn) — sin nuevos estilos.
- **RUT**: normalización con `normalizeRut` existente si aplica; el campo del CSV es informativo, no bloqueante.
- **Sin cambios** en `LinkRefundsDialog`, `cartolaLinksService` (salvo posible export de un helper para invalidar cache).
- **Cache**: al terminar, `queryClient.invalidateQueries({ queryKey: ['cartola-reconciliation'] })` y `['conciliacion','pending-refunds']`.
- **Accesibilidad**: labels, roles y `aria-live` en el progreso.

## Fuera de alcance

- Endpoint backend nuevo para persistir historial CSV o metadatos de respaldo (rut/nombre/póliza) → se prepara el modelo local para migrar sin fricción.
- Soporte Excel (`.xlsx`) → arquitectura del parser aislada para agregarlo en una próxima versión.

## Archivos afectados

- `src/pages/Conciliacion/index.tsx` (menú de acciones en la tabla).
- `src/pages/Conciliacion/components/CsvReconcileDialog.tsx` (nuevo).
- `src/pages/Conciliacion/services/csvReconcileService.ts` (nuevo).
- `src/pages/Conciliacion/hooks/usePendingRefunds.ts` (reuso, expone `nroCredito`).
- `package.json` (papaparse).
- `README.md`, `src/pages/auth/Login.tsx` (versión 4.1.2).
