# Welcome to your Lovable project

## Versión 3.7.0

## Changelog

### Versión 3.7.0 - 2026-05-05

#### Certificados Póliza 347 (Desgravamen)
- **Reemplazo de Pólizas 342/344**: se sustituyó la generación de certificados antiguos por la nueva **Póliza 347**, en sus dos variantes: genérica (`Pol347_GENERICO`) y Banco de Chile (`Pol347_BCO_CHILE`).
- **Copia literal de los PDFs de referencia**: 10 páginas redibujadas con jsPDF, respetando textos legales, tablas de Plan 1/2/3, casillas, márgenes y bloques de firmas.
- **Nueva matriz de Planes**:
  - Plan 1 → ≤ $20.000.000
  - Plan 2 → $20.000.001 – $60.000.000
  - Plan 3 → $60.000.001 – $100.000.000
- **Tasas TBM** por plan y tramo de edad aplicadas al cálculo de Prima Única.
- **Diferenciación literal**: ajustes de etiquetas (`Tasa Bruta Mensual` vs `Tasa Comercial Bruta Mensual`) y bloque de beneficiario (Banco de Chile como beneficiario irrevocable vs texto genérico del acreedor).
- **Layout de firmas corregido**: las firmas TDV / AuguStar van inline (dos columnas) tras la "Autorización para el Tratamiento de Datos Personales", sin página adicional, replicando el documento original.
- **Nombre de archivo**: `Cert_Cobertura_Desgravamen_Pol347_<RUT>_<Folio>.pdf`.
- **Backups**: se mantienen `bancoChilePdfGenerator.backup.ts` y `GenerateCertificateDialog.backup.tsx` para rollback rápido.

### Versión 3.6.0 - 2026-04-29

#### Operación: Desglose por institución en "Solicitudes ingresadas"
- **Nuevo Sheet de desglose** (`InstitutionBreakdownSheet`): al hacer clic en la caluga "Solicitudes ingresadas" del Resumen de Operación, se abre un panel lateral que agrupa las solicitudes por institución financiera, mostrando cantidad, días promedio en la etapa y solicitudes con tiempo excedido respecto al objetivo de la etapa.
- **Ordenamiento configurable**: el usuario puede ordenar el desglose por "Más excedidas" (default), "Cantidad" o "Días promedio" mediante un `ToggleGroup`.
- **Resaltado de SLA**: los promedios que superan el `stageObjectiveDays` se resaltan en rojo y se muestra un badge con la cantidad de solicitudes excedidas por institución.
- **Navegación contextual**: al seleccionar una fila, se navega a `/refunds` con `status`, `from`, `to`, `institution` y `autoSearch=true` precargados, manteniendo coherencia con el resto del flujo.

#### Resumen Financiero: nueva caluga "Monto total a pagar a clientes"
- **Nuevo KPI**: en el Resumen de Operación se agregó la caluga **"Monto total a pagar a clientes"**, que suma el `realAmount` de todas las solicitudes en estado **"Pago Programado"** dentro del rango de fechas seleccionado.
- **Click-through al listado**: al hacer clic se navega al listado de solicitudes filtrado por `status=payment_scheduled`, con el rango de fechas y `autoSearch=true`.

#### Fix: alineación de conteos entre caluga y listado (currentStatusOnly)
- **Discrepancia resuelta**: la caluga mostraba 41 solicitudes y el detalle abría 264 porque el listado usaba modo histórico amplio (`wasInStatusDuringRange`), incluyendo solicitudes que ya habían transicionado a otros estados.
- **Nuevo parámetro `currentStatusOnly`**: cuando se navega desde una caluga del Resumen, la URL incluye `currentStatusOnly=true`. El listado restringe los resultados a solicitudes cuyo **estado actual** coincide con el filtro y que transicionaron a ese estado dentro del rango, dejando ambas vistas con el mismo número.
- **Archivos**: `src/pages/Refunds/List.tsx` y `src/pages/Operacion/tabs/Resumen.tsx` (helper `buildRefundsUrl`).

### Versión 3.5.0 - 2026-04-25

#### Nuevo módulo: Conciliación bancaria
- **Nueva ruta `/conciliacion`** (acceso ADMIN) con entrada en el sidebar.
- **Listado de movimientos bancarios** de la cuenta corriente (mock con seed inicial + botón "Sincronizar banco" para simular nuevos depósitos). Pendiente de conectar al servicio real de scraping.
- **KPIs**: total depósitos, monto conciliado, monto por conciliar y solicitudes pendientes de pago.
- **Filtros por estado** del movimiento: pendiente, parcial, conciliado, ignorado y todos. Búsqueda por descripción / referencia / contraparte.
- **Matching 100% manual** mediante diálogo dedicado:
  - Lista solo solicitudes en estado **`payment_scheduled`** obtenidas vía `refundAdminApi.search`.
  - Permite **dividir un depósito entre N solicitudes** (split) hasta llegar a saldo cero.
  - Auto-sugerencia del monto a aplicar en función del `realAmount` registrado en `statusHistory`.
  - Validación de saldo (no permite exceder el monto remanente del movimiento).
- **Estado de la solicitud intacto**: la conciliación solo registra la asociación; no transiciona la solicitud a `paid`.
- **Acciones por movimiento**: ignorar/reactivar y eliminar asociaciones individuales (libera saldo).
- **Persistencia local** (localStorage) para movimientos y enlaces mientras se construye el backend.

#### Fix crítico: cálculo de prima del banco (Desgravamen)
- **Base correcta**: La prima única y la prima mensual del banco ahora se calculan sobre el **monto total del crédito original** (`montoCredito × tasa`), no sobre el saldo insoluto. El saldo insoluto se sigue usando únicamente para la tasa preferencial y el cálculo del seguro restante / devolución.
- **División por cuotas originales**: La prima mensual se divide por las **cuotas totales del crédito**, no por `cuotasUtilizadas` (que es solo el índice usado para buscar la tasa más cercana en la tabla del banco). Esto corrige el caso donde modificar las cuotas pendientes alteraba erróneamente la prima mensual mostrada.
- **Aplicado en**: `src/lib/calculadoraUtils.ts` (bloques `desgravamen` y `ambos`), propagado tanto a la calculadora pública como al editor de snapshot de solicitudes.

#### UI: claridad en el detalle del cálculo
- **Calculadora pública (`/calculadora`)**:
  - Renombrada la etiqueta **"Cuotas utilizadas"** a **"Cuotas usadas para tasa"** para dejar claro que es solo el índice de la tabla del banco.
  - Bloque **"Montos calculados (Banco)"** ahora muestra primero **"Monto total crédito"** (la base real del cálculo) y debajo, en formato pequeño/itálico, el "Saldo insoluto (referencia)".
  - Bloque **"Fórmula"** y exportación a PDF actualizados: `Prima única = Monto total crédito × Tasa`, `Prima mensual = Prima única / Cuotas originales`, `Seguro restante = Prima mensual × Cuotas pendientes`.
- **Detalle de solicitud (`Refunds/Detail.tsx`)**: Tooltip "Fórmula prima banco" actualizado con la base correcta y nota italizada aclarando el rol de "Cuotas usadas para tasa".

#### Editor de snapshot: botón "Recalcular ahora"
- **Forzar auto-recálculo**: Se agregó el botón **"Recalcular ahora"** en `EditSnapshotDialog` para gatillar manualmente el recálculo de primas y ahorros con la lógica vigente, sin necesidad de modificar campos del formulario. Útil para revalidar solicitudes existentes tras un fix en la fórmula.

### Versión 3.4.0 - 2026-04-24

#### Reemplazo de Certificado de Cobertura de Cesantía en carpeta del cliente
- **Detección de duplicados**: al subir el Certificado de Cobertura de Cesantía (`kind: certificado-de-cobertura`) a la carpeta del cliente, el sistema ahora verifica si ya existen documentos del mismo `kind` mediante `refundAdminApi.listDocs`.
- **Confirmación al usuario**: si se detectan certificados previos, se abre un `AlertDialog` informando al usuario cuántos archivos serán reemplazados y solicitando su confirmación explícita antes de continuar.
- **Reemplazo seguro**: tras confirmar, los certificados existentes se eliminan en paralelo (`DELETE /refund-requests/admin/:docId`) y luego se sube el nuevo PDF, evitando archivos huérfanos o duplicados.
- **Feedback diferenciado**: el toast de éxito indica explícitamente cuántos certificados previos fueron reemplazados.
- **Alcance acotado**: el cambio aplica únicamente al flujo de **Cesantía** (`GenerateCesantiaCertificateDialog`). El flujo de **Desgravamen** (`GenerateCertificateDialog`) y el resto de generadores no fueron modificados.

### Versión 3.3.9 - 2026-04-23

#### Exportación a Excel: columna "Número del certificado (Folio)"
- **Nueva columna**: Se agregó la columna **"Número del certificado (Folio)"** en la exportación a Excel del listado de solicitudes (`Exportar a Excel`), ubicada entre **Nº Póliza** y **Nº Crédito**.
- **Origen del dato**: Se popula con el `nroFolio` asignado a la solicitud (desde `calculation.nroFolio` o el campo de nivel superior). Si la solicitud aún no tiene folio asignado, la celda muestra `N/A`.

### Versión 3.3.8 - 2026-04-16

#### Formato consistente de montos con punto como separador de miles
- **Detalle de solicitud**: El bloque "Resumen del cálculo" ahora usa `formatCLPNumber` para mostrar todos los montos con `.` como separador de miles (ej: `$211.968`), evitando la coma de la configuración regional.
- **Listado de solicitudes**: La columna "Valor Nueva Prima" (desktop y mobile) reemplaza `toLocaleString('es-CL')` por `formatCLPNumber` y aplica redondeo a 3 decimales para eliminar ruido de punto flotante (ej: `211.96800000000002` → `211.968`).
- **Exportación a Excel**: Todos los montos numéricos (Monto Total Crédito, Primas, Saldo Insoluto, Costo Nuevo Seguro TDV, desglose Desgravamen/Cesantía, Ahorros, Monto Estimado) se exportan como strings ya formateados con `.` como separador de miles, redondeando internamente a 3 decimales para evitar que Excel reinterprete los valores con la configuración regional del usuario.

### Versión 3.3.7 - 2026-04-15

#### Carta de Corte especial para Santander Consumer
- **Formato extendido**: La Carta de Corte especial (4 páginas con documentos notariales) ahora también se genera para solicitudes de **Santander Consumer**, además de Banco Santander.

### Versión 3.3.6 - 2026-04-15

#### Fix: Nómina — monto real de devolución en diálogo de solicitudes
- **Monto real priorizado**: El diálogo "Agregar desde solicitudes" ahora muestra el monto real de devolución (`realAmount`) en lugar del monto simulado (`estimatedAmountCLP`). Se prioriza el campo de nivel superior y luego el `statusHistory`; si no existe monto real confirmado, se muestra `$0`.

### Versión 3.3.5 - 2026-04-14

#### Fix: Carta de Corte — guardado condicional de datos de crédito
- **Guardado inteligente**: El modal de generación de Carta de Corte (genérico y Santander) ahora solo ejecuta el `PATCH /update` cuando el Nº de Crédito o Nº de Póliza realmente cambiaron respecto al snapshot existente. Si los valores ya están cargados y no fueron modificados, se salta el guardado y pasa directo a la vista previa.
- **Eliminación de error 404**: Se resolvió el error "Refund request not found" que aparecía al intentar guardar datos de crédito ya existentes, evitando llamadas innecesarias al backend.

### Versión 3.3.4 - 2026-04-11

#### Botón "Solicitar datos bancarios" activo
- **Endpoint integrado**: Se activó el botón para invocar `PATCH /refund-requests/admin/:id/resend-scheduled-payment-email`, enviando el payload con nombre del cliente, email, ID de solicitud, monto real de devolución (`realAmount`), estado y link de acción (`https://www.tedevuelvo.cl/login`).
- **Modal de confirmación mejorado**: Se reemplazó el `window.confirm` nativo del navegador por un `AlertDialog` estilizado con el diseño del sistema, mostrando el email del destinatario y botones "Cancelar" / "Enviar correo".
- **Feedback de estado**: Indicador de carga ("Enviando...") en el botón y notificaciones toast para éxito y error.

### Versión 3.3.3 - 2026-04-10

#### Nº Póliza y Nº Crédito en búsqueda, grilla y exportación
- **Filtros de búsqueda**: Se agregaron campos de filtro por "Nº Póliza" y "Nº Crédito" en la sección de filtros de solicitudes, permitiendo buscar solicitudes por estos datos del snapshot.
- **Columnas en grilla**: Se añadieron las columnas "Nº Póliza" y "Nº Crédito" en la tabla de solicitudes (desktop y mobile) después de "Institución".
- **Exportación a Excel**: Los campos "Nº Póliza" y "Nº Crédito" se incluyen en la exportación a Excel dentro de la sección "Datos del crédito".

#### Corrección de selección individual de solicitudes
- **Bug fix**: Se corrigió un error donde al seleccionar una solicitud individual se marcaban todas. El problema se debía a que el campo `id` (MongoDB `_id`) no se normalizaba correctamente en las respuestas de los endpoints `list` y `search`, causando que todos los items compartieran un identificador `undefined`.

### Versión 3.3.2 - 2026-04-10

#### Validación obligatoria de datos de crédito en Carta de Corte
- **Campos obligatorios antes de generar**: Los campos "Nº de Crédito" y "Nº de Póliza" son ahora obligatorios antes de poder generar la vista previa de cualquier Carta de Corte (genérica o Santander).
- **Indicadores visuales de estado**: Se agregaron badges con íconos que muestran el estado de completitud de los datos (ámbar con `AlertCircle` para incompleto, esmeralda con `CheckCircle` para completo).
- **Botón Vista Previa deshabilitado**: El botón permanece deshabilitado hasta que ambos campos estén correctamente completados.

#### Persistencia automática al generar vista previa
- **Guardado automático en snapshot**: Al hacer clic en "Vista Previa", los valores de `nroPoliza` y `nroCredito` se guardan automáticamente en el `calculationSnapshot` mediante llamada a `refundAdminApi.updateData`.
- **Indicador de progreso**: Se muestra un spinner (`Loader2`) durante el proceso de guardado antes de mostrar la vista previa.
- **Invalidación de caché**: Tras el guardado exitoso, se invalida el caché de la solicitud (`queryClient.invalidateQueries`) para que los datos actualizados se reflejen inmediatamente en todos los componentes.

#### Validación de datos de crédito en cambio de estado "Documentos recibidos"
- **Campos obligatorios y de solo lectura**: Al cambiar el estado a "Documentos recibidos", los campos "Nº de Póliza" y "Nº de Crédito" son obligatorios pero aparecen como solo lectura (no editables).
- **Validación de precarga**: El sistema valida que estos datos ya existan en el snapshot. Si faltan, muestra un error instructivo indicando que deben cargarse previamente desde la generación de Carta de Corte.
- **Indicadores visuales diferenciados**: 
  - Verde con `CheckCircle` cuando los datos están presentes.
  - Rojo con `AlertCircle` cuando faltan, con instrucciones claras para el usuario.
- **Eliminación de guardado redundante**: Se removió la llamada API duplicada durante el cambio de estado, ya que los datos se guardan automáticamente en el paso de Carta de Corte.

### Versión 3.3.1 - 2026-04-10

#### Campos Nro. Póliza y Nro. Crédito en Snapshot
- **Nuevos campos en editor de snapshot**: se agregaron `nroPoliza` y `nroCredito` en la sección "Datos confirmados del crédito" del diálogo de edición de snapshot, permitiendo registrar estos datos junto al cálculo de la solicitud.
- **Persistencia en snapshot**: ambos campos se envían como parte del `calculationSnapshot` al backend.

#### Precarga de Nro. Póliza y Nro. Crédito en Carta de Corte
- **Formulario genérico y Santander**: al abrir el diálogo de generación de carta de corte, los campos "Nº de Crédito" y "Nº de Póliza" se precargan automáticamente desde `calculationSnapshot.nroCredito` y `calculationSnapshot.nroPoliza` si existen.

#### Precarga de Nro. Póliza y Nro. Crédito en Archivo Altas CIA
- **Autocompletado al abrir diálogo**: al abrir el modal de generación de Altas CIA, los campos "Número de Póliza" y "Código de Crédito" se precargan desde el snapshot de cada solicitud, reduciendo el ingreso manual.

#### Actualización de Tasas de Desgravamen
- **Tasas actualizadas**: Banco Ripley, Forum, Scotiabank y Tanner con nuevas tasas vigentes.
- **Nuevas instituciones**: se agregaron Chevrolet SF, Marubeni y Santander Consumer al mapeo de instituciones de la calculadora, desglose de seguros y homologación de nombres.

#### Botón "Solicitar datos bancarios" (próximamente)
- **Nuevo botón en detalle de solicitud**: visible solo cuando la solicitud está en estado "Pago programado", permite (en futuro) reenviar un correo al cliente para que ingrese sus datos de transferencia bancaria.
- **Estado deshabilitado**: el botón se muestra deshabilitado con tooltip informativo indicando que la funcionalidad está en desarrollo.

### Versión 3.3.0 - 2026-04-05

#### Folio automático en Certificados de Cobertura
- **Asignación automática de folio**: al abrir el diálogo de generación de certificados, el sistema asigna automáticamente un número de folio único vía API (`PATCH /assign-folio`).
- **Reasignación de folio**: se agregó un botón para solicitar un nuevo correlativo (`?reassign=true`), invalidando el folio anterior.
- **Bloqueo de vista previa**: la previsualización del documento queda bloqueada hasta que el folio se asigne exitosamente, garantizando trazabilidad.

#### Alertas de tiempo excedido en Operación (Resumen)
- **Badges visuales en pipeline**: se agregaron indicadores rojos con ícono de alerta en las calugas del pipeline de Resumen, mostrando cuántas solicitudes han superado los días objetivo configurados en Ajustes → Objetivos por Etapa.
- **Tooltips informativos**: al pasar el cursor sobre el badge se muestra el detalle de la cantidad y los días objetivo.
- **Consistencia con filtros**: los contadores de overdue se calculan sobre el mismo universo de datos filtrados por fecha que las calugas del pipeline.

#### Nómina - Nº Documento por defecto
- **Valor por defecto**: al agregar solicitudes desde "Agregar desde solicitudes", el campo "Nº Documento" ahora se autocompleta con el valor "1".

#### Fix: Carta de Corte Banco Santander — PDF subido con formato incorrecto
- **Problema**: al subir la carta de corte a la carpeta del cliente, el PDF se generaba con el formato genérico antiguo en lugar del formato Santander V3 previsualizado.
- **Solución**: se creó `generateSantanderCortePdfBlob` que genera el PDF con el formato V3 completo (texto legal "viene a comunicar", 4 páginas con imágenes institucionales adjuntas), y se actualizó el handler de subida para usarlo.

#### Nómina - Descarga dual TXT + Excel
- **Exportación automática a Excel**: al presionar "TXT Normal", ahora se descargan simultáneamente el archivo TXT (sin cambios en su lógica) y un archivo XLSX con las mismas filas de la nómina, incluyendo RUT, nombre, banco, cuenta, monto y demás campos.

#### Nómina - Etiqueta "En desarrollo" removida
- **Módulo listo para producción**: se removió la etiqueta "En desarrollo" del ítem "Nómina" en el menú lateral, marcándolo como `live`.

#### Fix: Diálogo Archivo Altas CIA — Acordeones no expandibles
- **Problema**: las solicitudes dentro del modal de generación de Altas CIA no podían desplegarse para completar datos faltantes, debido a que el componente `ScrollArea` de Radix interceptaba los eventos de clic del `AccordionTrigger`.
- **Solución**: se reemplazó el `Accordion` de Radix por una lista expandible personalizada con estado controlado, y se sustituyó `ScrollArea` por un `div` con `overflow-y-auto`.
- **Paginación interna**: se agregó paginación de 20 ítems por página dentro del diálogo para evitar bloqueos del DOM al procesar cientos de registros.

### Versión 3.2.9 - 2026-03-19

#### Corrección de lógica de cálculo de primas (calculadora y editor de snapshot)
- **Prima Única Banco**: corregida para calcularse sobre el monto total del crédito (`montoCredito × tasaActual`) en lugar del saldo insoluto.
- **Prima Mensual Banco**: ahora se divide la prima única por las cuotas utilizadas de la tabla de tasas (`primaUnica / cuotasUtilizadas`).
- **Saldo Insoluto estimado**: cuando no se provee, se estima proporcionalmente como `montoCredito × (cuotasPendientes / cuotasTotales)`.
- **Fórmulas en detalle de solicitud**: la sección de desglose de cálculos ahora usa `confirmedRemainingInstallments` (cuotas confirmadas) en lugar de las cuotas de simulación.

#### Actualización de Tasas Comerciales Brutas Mensuales (TC/TBM por mil)
- **Póliza 342 (Estándar, ≤20M)**: tasa 18-55 años actualizada de 0.2970 → **0.3000**; tasa 56-65 años de 0.3733 → **0.3900**.
- **Póliza 344 (Prime, >20M)**: tasa 18-55 años actualizada de 0.3267 → **0.3440**; tasa 56-65 años de 0.4106 → **0.3430**.
- Cambio aplicado en certificados genéricos (`GenerateCertificateDialog`) y en el generador específico de Banco de Chile (`bancoChilePdfGenerator`).

#### Fix: tablas de tasas hardcodeadas en PDF (GenerateCertificateDialog)
- **Póliza 344 (Prime)**: las tablas visuales del PDF mostraban valores antiguos (0,3267 / 0,4106); corregidas a **0,3440 / 0,3430**.
- **Póliza 342 (Estándar)**: las tablas visuales del PDF mostraban valores antiguos (0,2970 / 0,3733); corregidas a **0,3000 / 0,3900**.
- Se actualizaron las 8 instancias de tablas hardcodeadas en `GenerateCertificateDialog` (4 tablas × 2 rangos de edad).

#### Fix: tablas de tasas hardcodeadas en PDF Banco de Chile (bancoChilePdfGenerator)
- **Póliza 344 (Prime)**: las tablas visuales mostraban `0,34` para ambos rangos; corregidas a **0,3440** (18-55 años) y **0,3430** (56-65 años).
- Se actualizaron las 4 instancias en 2 tablas de tasas y el ejemplo de cálculo (`$367.200` → **`$371.520`**).
- Las tasas de Póliza 342 (Estándar) ya estaban correctas (`0,30` / `0,39`).

---

### Versión 3.2.8 - 2026-03-12

#### Métricas Call Center en Dashboard
- **Nueva sección dedicada**: se añadió un bloque exclusivo de KPIs para Call Center con "Total primas estimadas" y "Ticket promedio".
- **Cálculo correcto de primas**: la prima total se calcula como `newMonthlyPremium × remainingInstallments` desde el `calculationSnapshot`, reemplazando el uso incorrecto de `estimatedAmountCLP`.
- **Reorganización de calugas principales**: se removió la caluga Call Center de la fila principal y se ajustó el grid a 5 columnas para mejor distribución visual.

---

### Versión 3.2.7 - 2026-03-12

#### Corrección de datos obsoletos al reabrir editor de snapshot
- **Protección contra datos stale**: al reabrir inmediatamente el editor de snapshot tras guardar, los valores guardados se mantienen correctamente gracias a un puente de estado local (`latestSavedValuesRef`) con ventana de 15 segundos.
- **Recálculo condicional**: la auto-calculación de primas y ahorros ahora solo se ejecuta cuando el usuario modifica explícitamente campos de crédito (`age`, `totalAmount`, `originalInstallments`, `remainingInstallments`), evitando sobrescribir valores recién guardados al montar el modal.

#### Simplificación de tipos de crédito
- **Eliminación de opciones no utilizadas**: se removieron "Hipotecario" y "Comercial" del combo de tipo de crédito en el editor de snapshot, dejando solo "Consumo" y "Automotriz".

---

### Versión 3.2.6 - 2026-03-07

#### Auto-cálculo de primas y ahorros en editor de snapshot
- **Recálculo automático** de los campos `currentMonthlyPremium`, `newMonthlyPremium`, `monthlySaving` y `totalSaving` al modificar datos del crédito (edad, monto, cuotas, tipo de seguro) en el editor de snapshot.
- Los campos de primas y ahorros son ahora **solo lectura**, calculados con la lógica de `calcularDevolucion`.
- **Confirmación visual diferenciada**: en el paso de confirmación de cambios, los campos auto-calculados se muestran en una sección separada con borde punteado e ícono de calculadora, distinguiéndolos de los campos editados manualmente.

---

### Versión 3.2.5 - 2026-03-05

#### Validación de documentos al cambiar estado
- **Validación obligatoria** al cambiar a "Documentos recibidos" o "Ingresado": el sistema verifica que existan documentos con los kinds `cedula-frente`, `cedula-trasera`, `signed-mandate` y `carta-de-corte`. Si falta alguno, se informa cuál y se bloquea el cambio.
- **Corrección de sincronización de cache**: unificada la query key de documentos (`refund-documents`) entre el detalle y la sección de documentos para que los archivos recién subidos se reflejen inmediatamente en la validación.

#### Subir Carta de Corte a carpeta del cliente
- **Nuevo botón "Subir a Carpeta del Cliente"** en la vista previa de la Carta de Corte (formatos genérico y Santander).
  - Genera un PDF con jsPDF y lo sube automáticamente al endpoint `/upload-file` con kind `carta-de-corte`.
  - Invalida el cache de documentos para disponibilidad inmediata en la sección de documentos.
  - Botón con color verde esmeralda diferenciado para mejor experiencia visual.

---

### Versión 3.2.4 - 2026-03-01

#### Nuevo módulo: Nómina de Devoluciones
- **Generación de archivos TXT para Scotiabank**: Nueva página `/nomina-devoluciones` para crear nóminas de pago desde datos manuales, CSV o solicitudes existentes.
  - Importación directa desde solicitudes en estado "Pago Programado" con datos bancarios, mapeando RUT, nombre, email, banco y cuenta.
  - Importación CSV con detección automática de separador (`,` o `;`).
  - Generación de archivo TXT en modo normal o agrupado.
  - Persistencia local de borradores con restauración automática.
  - Header configurable: Nombre empresa (TDV SERVICIOS SPA), RUT (78168126-1), Convenio (003).
  - Valores por defecto: CTACTE SCOTIABANK, VARIOS, sucursal 000, glosa "Devolución Tedevuelvo".
  - Homologación automática de nombres de banco (ej: "Banco BCI" → "BCI").
  - Vista responsive con modos Compacto/Expandido.

#### Eliminación de documentos públicos
- **Nuevo botón "Eliminar documento"** en la sección de documentos públicos del detalle de solicitud.
  - Endpoint: `DELETE /api/v1/refund-requests/admin/:id`.
  - Diálogo de confirmación antes de eliminar permanentemente.
  - Recarga automática de la lista de documentos tras eliminación exitosa.

#### Mejoras en validación de documentos
- **Checklist actualizado** al cambiar estado a "Documentos recibidos": ahora incluye verificación de que todos los documentos tengan su **tipo correspondiente** asignado (no solo la carta de rechazo).

#### Ajustes en sidebar
- **Etiqueta "En desarrollo"** agregada al ítem "Nómina" en el menú lateral.
- **Removida etiqueta "En desarrollo"** del ítem "Ajustes".

---

### Versión 3.2.3 - 2026-02-27

#### Actualización de tasas Banco de Chile — Desgravamen
- **Nuevas tasas planas** para seguro de desgravamen de Banco de Chile, sin variación por monto ni tramo de edad:
  - 12 meses: 0.652% | 24 meses: 1.304% | 36 meses: 1.480% | 48 meses: 2.608% | 60 meses: 3.260%
- Tasas anteriores (variables por monto y edad, ~0.80% a ~4.17%) reemplazadas en `tasas_formateadas_te_devuelvo.json`.

---

### Versión 3.2.2 - 2026-02-24

#### Carta de Corte Santander — Nuevo formato fidedigno
- **Formato de Renuncia y Término Anticipado de Seguro V3**: Reescrita completamente la carta de corte para Banco Santander como copia fidedigna del formato oficial.
  - Texto legal actualizado: "viene a comunicar formalmente a esa Compañía Aseguradora la renuncia expresa al seguro, incluyendo todas sus coberturas asociadas."
  - Nuevo campo **Nº de Póliza** obligatorio en el formulario de generación (solo para Santander).
  - **3 páginas de documentos adjuntos**: Cédula de identidad legalizada, Certificado Notarial y Certificado del Conservador de Bienes Raíces (imágenes estáticas idénticas para todos los casos).
  - Reemplazadas las imágenes anteriores de cédula (frente/dorso) por los 3 nuevos documentos del formato oficial.

#### Eliminación de alerta urgente del sidebar
- **Removida alerta roja pulsante** del menú lateral en el ítem "Operación".
  - Ya no se muestra badge con conteo de documentos recibidos ni pagos programados en el sidebar.
  - Eliminado tooltip con desglose de alertas urgentes.
  - El hook `useUrgentAlerts` permanece disponible para uso futuro si se requiere.

#### Corrección de exportación Excel en modo histórico
- **Exportación respeta filtros activos**: Al navegar desde Operación con filtro multi-estado (ej: "En Proceso Operativo"), la exportación a Excel ahora exporta exactamente los registros filtrados localmente.
  - Antes: el botón mostraba "352" pero exportaba toda la base de datos.
  - Ahora: sin selección manual, exporta el dataset filtrado completo; con selección, exporta solo las filas seleccionadas.
  - Nuevo prop `historicalStatusMode` en `ExportToExcelDialog` para controlar el comportamiento.

#### Corrección de filtro multi-estado en Solicitudes
- **Filtro por múltiples estados funcional**: Al hacer clic en la caluga "En Proceso Operativo" desde Operación, el listado de Solicitudes ahora muestra correctamente las solicitudes en los 5 estados agrupados.
  - Causa: el guardrail local hacía comparación estricta (`===`) contra un string con comas en lugar de tratarlo como lista.
  - Solución: el filtro local ahora divide `status` por comas y verifica pertenencia con `.includes()`.

---

### Versión 2.3.1 - 2026-02-20

#### Página Operación — Caluga "En Proceso Operativo"
- **Nueva caluga destacada** en el pipeline de solicitudes (tab Resumen) que muestra el total de solicitudes en proceso operativo activo.
  - Agrupa: **Documentos Recibidos + Ingresadas + Aprobadas + Pago Programado + Pagadas**.
  - Diseño diferenciado: banner con gradiente azul-púrpura, textura de puntos, sombra profunda y número en tipografía bold 4xl para destacar visualmente sobre el resto de las calugas.
  - Desglose compacto: chips individuales por cada etapa incluida con su conteo, visibles directamente en el banner.
  - **Tooltip explicativo detallado**: al hacer hover muestra el propósito del indicador ("venta potencial del período"), el conteo por etapa con su descripción operativa y una nota aclaratoria sobre qué estados no se incluyen (En calificación y Rechazadas).
  - El valor respeta el filtro de fechas activo, siendo consistente con el resto del pipeline.

---

### Versión 2.3.0 - 2026-02-20

#### Página de Ajustes — Rediseño y nueva sección Tasas
- **Navegación tipo sidebar**: Rediseño completo con panel lateral fijo y área de contenido dinámica, escalable para futuras secciones.
  - Grupos de navegación: **Operación** (Objetivos por etapa, Plan de cumplimiento) y **Cálculos** (Tasas de referencia).
  - Breadcrumb sticky en el encabezado del contenido para orientación contextual.
  - Ítem activo destacado con `bg-primary text-primary-foreground` y flecha indicadora.
- **Nueva sección "Tasas de referencia"** (grupo Cálculos, read-only con badge "Edición próximamente"):
  - Tab **Desgravamen bancario**: Tabla interactiva con heatmap de colores (verde → rojo) por monto de crédito, plazo (cuotas) y tramo de edad. Selector de banco y toggle de edad 18–55 / 56+ con estado activo claramente visible.
  - Tab **Desgravamen TDV**: Tabla con los 2 tramos oficiales (Tramo 1: hasta 55 años `0.2970400%`, Tramo 2: desde 56 años `0.3737900%`), expresados en porcentaje con 7 decimales.
  - Tab **Cesantía**: Tabla comparativa Banco vs TDV con los 5 tramos de monto. Nueva columna "Ahorro TDV" con el diferencial porcentual promedio por institución. Tooltip por celda con el % de ahorro exacto del tramo al hacer hover.
  - **Exportación a Excel**: Workbook multi-hoja con datos de Cesantía (todos los bancos + TDV) y Desgravamen (por banco + TDV).
- **Layout expandido**: `max-w-5xl` para acomodar tablas anchas sin generar scroll horizontal no deseado.

#### Página Dashboard — Mejoras de datos y visualización
- **Fuente de datos unificada**: El Dashboard ahora consume el mismo caché de solicitudes que la página Operación (`useAllRefunds`), eliminando llamadas duplicadas a la API y garantizando consistencia entre ambas vistas.
- **Filtrado por fecha con zona horaria**: Implementado `filterByLocalDate` con extracción directa del string ISO (`createdAt.split('T')[0]`) para evitar desplazamientos por conversión UTC en zona horaria Chile.
- **Fases del flujo visual**: Visualización de solicitudes agrupadas en 4 fases del pipeline (Captación, Revisión y Docs, Gestión Bancaria, Salidas) con colores semánticos por fase (violeta, ámbar, azul, rojo).
  - Cada etapa es clickeable y navega a `/refunds` pre-filtrado por estado y rango de fecha.
  - Tooltips descriptivos por etapa explicando su significado operacional.
- **Sub-métricas de etapas críticas**:
  - **En calificación**: Consulta mandatos firmados vía Experian en lotes de 10, mostrando conteo de firmados vs pendientes.
  - **Pago programado**: Muestra cuántas solicitudes tienen datos bancarios cargados vs pendientes.
- **KPIs de resumen**: Total solicitudes, pagadas, en proceso, monto total pagado y tasa de conversión (pagadas / total sin leads iniciales).
- **Gráficos temporales con granularidad**: Series de solicitudes ingresadas y montos pagados por día/semana/mes, con presets de fecha rápidos (Hoy, Ayer, Esta semana, Último mes, Mes actual).
- **Gráfico de distribución por estado**: Pie chart y bar chart intercambiables mostrando la distribución porcentual de todas las solicitudes en el período.

#### Página Operación — Mejoras en tab Resumen
- **Navegación contextual desde KPIs**: Cada tarjeta de estado en el resumen es clickeable y navega a `/refunds` pre-filtrado por estado y fechas del filtro activo, manteniendo consistencia con el período seleccionado.
- **Selector de tipo de gráfico**: Toggle Pie / Barra en la distribución por estado para flexibilidad de visualización.
- **Integración de fechas en filtros de navegación**: Los links generados desde Operación incluyen siempre `from` y `to` del filtro activo, garantizando que el listado de solicitudes refleje exactamente el período analizado.

---


### Versión 2.2.3 - 2026-02-19

#### Carta de Corte Banco Santander - Imágenes de Cédula
- **Segunda hoja con cédula de identidad**: La carta de corte para Banco Santander ahora incluye una segunda página con las imágenes de la cédula de identidad del representante (Cristian Nieto Gavilán).
  - Imágenes estáticas (frente y dorso) adjuntas directamente al PDF generado.
  - Segunda página siempre presente en el documento Santander, tanto en vista previa como en PDF descargado.

---

### Versión 2.2.2 - 2026-02-12

#### Corrección de Fechas (Timezone)
- **Fix de fecha de nacimiento**: Corregido bug donde la fecha de nacimiento se mostraba un día menos en la vista de detalle, previsualización de certificados y PDFs.
  - Causa: `new Date("1976-02-02T00:00:00.000+00:00")` en zona horaria Chile (UTC-3/4) se desplazaba al día anterior.
  - Solución: Extracción directa de componentes de fecha desde el string ISO (`YYYY-MM-DD`) sin pasar por `new Date()`.
  - Aplicado en: Vista de detalle, Certificado Desgravamen, Certificado Cesantía, Certificado Banco de Chile y `formatDate` global.

---

### Versión 2.2.1 - 2026-02-10

#### Notificaciones por Correo en Cambios de Estado
- **Envío automático de correos**: Al cambiar el estado de una solicitud a SUBMITTED, PAYMENT_SCHEDULED, REJECTED, PAID o DOCS_RECEIVED, se envía una notificación por correo electrónico.
  - Destinatario: `dalia.mardones@tedevuelvo.cl`
  - Integración vía webhook n8n: `https://gary-tester.app.n8n.cloud/webhook/6f73e927-434b-4a37-9e66-d72a905e5b53`

#### Mejoras en Exportación Excel
- **Columnas removidas**: Eliminadas "Prima Mensual Desgravamen Banco" y "Prima Mensual Cesantía Banco" de la exportación Excel.

#### Mejoras en Edición de Solicitudes
- **Montos de devolución en snapshot**: Agregados campos "Monto estimado devolución" y "Monto real devolución" al editor de snapshot.
  - Pre-llenado automático de monto real desde `statusHistory` (entradas `payment_scheduled` o `paid`).
  - Campos root-level enviados directamente al backend, separados del `calculationSnapshot`.

---

### Versión 2.2.0 - 2026-02-06

#### Mejoras en Módulo Call Center
- **Columnas de fechas de estado**: Agregadas columnas "Fecha Docs Pendientes" y "Fecha Docs Recibidos" en la tabla de solicitudes del Call Center.
  - Extraen la fecha más reciente del `statusHistory` en que la solicitud pasó a cada estado.
  - Visibles exclusivamente en la vista Call Center (no en Solicitudes).

- **Restricción de cambio de estado**: El usuario de Call Center (`admin@callcenter.cl`) solo puede cambiar solicitudes a los estados: Cancelado, Documentos pendientes y Documentos recibidos.

#### Mejoras en Exportación Excel
- **Nuevas columnas de fechas de estado**: La exportación a Excel ahora incluye "Fecha Docs Pendientes" y "Fecha Docs Recibidos".
  - Extraídas del `statusHistory` con búsqueda case-insensitive en campos `to` y `status`.

#### Correcciones en Edición de Solicitudes
- **Fix de timezone en fecha de nacimiento**: Corregido el bug donde la fecha de nacimiento se mostraba un día menos al editar.
  - Se añade `T12:00:00` al enviar fechas al backend para evitar desplazamiento por conversión UTC.
  - Se usan getters locales (`getFullYear`, `getMonth`, `getDate`) en lugar de `.slice(0, 10)` para poblar los inputs de fecha.
- **Fix de datos no reflejados tras edición**: Corregido el envío duplicado de `birthDate` como campo top-level que sobrescribía el valor correcto del `calculationSnapshot`.

---

### Versión 2.1.9 - 2026-02-06

#### Modo Histórico "Estado en fecha" en Solicitudes
- **Filtrado por estado histórico en rango de fechas**: El toggle "Estado en fecha" permite buscar solicitudes que estuvieron en un estado determinado durante un rango de fechas.
  - Recorre el `statusHistory` de cada solicitud para determinar si el estado objetivo estuvo activo en algún momento dentro del rango [Desde, Hasta].
  - Ejemplo: filtrar por "En calificación" entre 06/01/2026 y 06/02/2026 muestra todas las solicitudes que pasaron por ese estado en ese período.
  - Obtención de datos completa con paginación paralela (lotes de 5, máx. 100 por página) para superar el límite del backend.

- **Paginación local en modo histórico**: Los resultados filtrados localmente se paginan en páginas de 20 elementos.
  - Navegación entre páginas funcional con controles estándar.
  - La exportación a Excel mantiene el dataset completo (sin paginar) para no perder información.

- **Ícono ArrowRightLeft en estados**: Nuevo ícono ↔️ junto al badge de estado cuando el estado actual de la solicitud difiere del estado filtrado.
  - Tooltip con el estado actual al pasar el mouse.
  - Reemplaza el ícono de reloj (Clock) por mayor claridad semántica.

- **Banner informativo de modo histórico**: Banner azul prominente indicando que el modo histórico está activo.
  - Muestra la fecha de corte seleccionada.
  - Botón de cierre rápido para desactivar el modo.

#### Edición de Solicitudes (Admin)
- **Edición parcial de datos**: Botones "Editar" en las secciones de Datos del Cliente, Información Bancaria y Snapshot.
  - Endpoint PATCH `/api/v1/refund-requests/admin/:publicId/update`.
  - Envío de solo campos modificados (payload parcial).
  - Confirmación detallada por categoría de campos actualizados.

---

### Versión 2.1.8 - 2026-01-30

#### Corrección en Carátula de Certificados de Cobertura
- **Eliminado "No hay comisión"**: Removido el texto "No hay comisión" de la sección COMISIÓN TOTAL CORREDOR en las carátulas de Póliza 342 y 344.
  - Aplicado al generador genérico (GenerateCertificateDialog) para todas las instituciones.
  - Aplicado al generador específico de Banco de Chile (bancoChilePdfGenerator).
- **Cambios solo estéticos**: La lógica de generación del PDF permanece sin cambios.

---

### Versión 2.1.7 - 2026-01-30

#### Actualización de Tasas en Certificado de Cobertura (Póliza 342 Standard)
- **Tasas actualizadas**: La tabla de tasas en el PDF ahora muestra valores simplificados:
  - 18-55 años: **0,30** (antes 0,2970)
  - 56-65 años: **0,39** (antes 0,3733)
- Aplicado al generador genérico (GenerateCertificateDialog) para todas las instituciones.
- Aplicado al generador específico de Banco de Chile (bancoChilePdfGenerator).
- Ejemplo de cálculo actualizado: `$30.000.000 × 0,30/1000 × 36 = $324.000 Pesos`.
- **Cambios solo estéticos**: La lógica de cálculo de Prima Única permanece sin cambios (usa snapshot).

---

### Versión 2.1.6 - 2026-01-30

#### Actualización de Tasas en Certificado de Cobertura (Póliza 344 Prime)
- **Tasas unificadas a 0,34**: La tabla de tasas en el PDF ahora muestra 0,34 para ambos rangos de edad (18-55 y 56-65).
  - Aplicado al generador genérico (GenerateCertificateDialog) para todas las instituciones.
  - Aplicado al generador específico de Banco de Chile (bancoChilePdfGenerator).
  - El ejemplo de cálculo de prima actualizado: `$30.000.000 × 0,34/1000 × 36 = $367.200 Pesos`.
- **Cambios solo estéticos**: La lógica de cálculo de Prima Única permanece sin cambios (usa snapshot).

---

### Versión 2.1.5 - 2026-01-29

#### Correcciones en Cálculo de Prima Única (Certificado de Cobertura)
- **Prima Única desde snapshot**: El cálculo de la Prima Única ahora utiliza directamente los valores del snapshot de cálculo.
  - Fórmula: `Nueva Prima Mensualizada × Cuotas Pendientes` (extraídos del `calculationSnapshot`).
  - Aplicado a Póliza 342 (Standard) y Póliza 344 (Prime) para todos los bancos.
  - Aplicado específicamente a los certificados de Banco de Chile (ambas pólizas).
  - Fallback a cálculo tradicional con TBM si no hay datos del snapshot.
  - La TBM mostrada en el UI se deriva inversamente de la Prima Única calculada.

---

### Versión 2.1.4 - 2026-01-29

#### Correcciones en Certificado de Cobertura
- **Póliza 344 (Prime) - Saldo Insoluto corregido**: Corregido el certificado para mostrar "Saldo Insoluto" en lugar de "Monto Inicial del Crédito".
  - Campo de datos ahora muestra "Saldo Insoluto*" con el valor correcto del formulario.
  - Fórmula actualizada: `TC/1000 × SI × Nper` (antes usaba MCI).
  - Explicación de la fórmula actualizada para reflejar "SI: Saldo Insoluto" en lugar de "MCI: Monto del crédito inicial".

---

### Versión 2.1.3 - 2026-01-29

#### Mejoras en Exportación Excel de Solicitudes
- **Exportación completa sin selección**: El botón "Exportar a Excel" ahora exporta todas las solicitudes cuando no hay selección.
  - Sin selección: Descarga todo el dataset usando paginación paralela (lotes de 10 páginas, 100 registros cada una).
  - Con selección: Exporta solo las solicitudes seleccionadas.
  - Barra de progreso visible durante la descarga de datos.
  - Advertencia visual cuando hay más de 100 registros a exportar.

#### Mejoras en Módulo Operación (Segmentos)
- **Nuevo KPI Prima Total Promedio**: Reemplazado "Monto en Pipeline" por "Prima Total Promedio".
  - Fórmula: Promedio de (prima mensual × cuotas pendientes).
  - Solo considera solicitudes activas + pagadas con datos válidos.
  - Tooltip descriptivo con la fórmula utilizada.

---

### Versión 2.1.2 - 2026-01-28

#### Mejoras en Certificado de Cobertura Banco de Chile
- **Beneficiario irrevocable corregido**: Corregida la visualización del beneficiario irrevocable en los certificados de cobertura del Banco de Chile.
  - Póliza 342 y 344: El nombre y RUT del beneficiario irrevocable ahora se muestran correctamente en la sección "Detalle de Coberturas".
  - Póliza 342 y 344: Corregida la sección de fallecimiento para mostrar los datos del beneficiario ingresado en lugar de datos del banco.
  - Campos con formato visual consistente usando cajas delimitadas.

---

### Versión 2.1.1 - 2026-01-28

#### Mejoras en Filtros de Solicitudes
- **Filtro de origen a backend**: El filtro por origen (Directo/Alianza) ahora envía el parámetro `isPartner` al servidor.
  - `isPartner=0` para solicitudes directas.
  - `isPartner=1` para solicitudes de alianza.
  
- **Filtro de datos bancarios a backend**: El filtro de estado de pago ahora envía el parámetro `hasBankInfo` al servidor.
  - `hasBankInfo=1` para solicitudes con datos bancarios (Listo).
  - `hasBankInfo=0` para solicitudes sin datos bancarios (Pendiente).

---

### Versión 2.1.0 - 2026-01-23

#### Mejoras en Calculadora
- **Búsqueda en selector de institución**: El combo de instituciones financieras ahora permite buscar escribiendo el nombre del banco.
  - Implementado con componente Combobox (Command + Popover).
  - Filtrado en tiempo real mientras el usuario escribe.
  - Mejora la experiencia de usuario al tener muchas instituciones.

- **Nuevas instituciones financieras**: Agregadas 5 nuevas instituciones al selector.
  - **Lider BCI**: Usa las mismas tasas que BCI (producto conjunto Lider/Walmart y BCI).
  - **Cencosud**: Banco Cencosud Scotiabank.
  - **Forum**: Financiera Forum.
  - **Tanner**: Tanner Servicios Financieros.
  - **Cooperativas**: Opción genérica para cooperativas de ahorro.

- **Corrección de mapeo de instituciones**: Validación y corrección de todas las instituciones financieras.
  - Agregado mapeo faltante para "Banco Security" en datos de cesantía.
  - Agregado mapeo para "Itaú - Corpbanca" (BANCO ITAU-CORPBANCA).
  - Total de 17 instituciones ahora disponibles con soporte completo para desgravamen y cesantía.

#### Generador de Certificado de Cesantía
- **Nuevo certificado de cesantía**: Implementado generador de PDF para certificados de seguro de cesantía.
  - Formato de dos páginas similar al certificado de desgravamen.
  - Datos dinámicos del asegurado, ejecutivo y seguro.
  - Cálculo automático de prima neta basado en monto del crédito y tasa escalonada de cesantía.
  - Formulario de edición con campos organizados: Nombres, Apellido Paterno, Apellido Materno.
  - Parsing inteligente del nombre completo respetando el orden correcto.

#### Mejoras en Lista de Solicitudes
- **Nueva columna "Tipo Seguro"**: Agregada columna que muestra el tipo de seguro de cada solicitud.
  - Detección automática: Desgravamen (violeta), Cesantía (teal) o Ambos.
  - Basado en el campo `calculationSnapshot.insuranceToEvaluate`.
  - Visible tanto en vista desktop como en vista móvil.

- **Filtro por tipo de seguro**: Nuevo filtro en la sección de filtros.
  - Opciones: Todos, Desgravamen, Cesantía, Ambos.
  - Persistencia en URL para compartir filtros.

#### Mejoras en Exportación Excel
- **Tipo de seguro en exports**: La columna "Tipo de Seguro" ahora detecta correctamente el formato mayúsculas de la API.
  - Lógica case-insensitive para detectar CESANTIA, DESGRAVAMEN o AMBOS.

---

### Versión 2.0.9 - 2026-01-07

#### Mejoras en Lista de Solicitudes
- **Nueva columna "Valor Nueva Prima"**: Agregada columna que muestra el valor total de la nueva prima.
  - Cálculo: Nueva prima mensual × Cuotas pendientes.
  - Visible tanto en vista desktop como en vista móvil.
  - Valores extraídos del snapshot de cálculo (`calculationSnapshot`).

---

### Versión 2.0.8 - 2026-01-07

#### Rediseño de Página de Login
- **Nueva interfaz profesional**: Diseño moderno con layout de dos paneles.
  - Panel izquierdo: Branding con gradiente, logo y lista de características destacadas.
  - Panel derecho: Formulario de login elegante y centrado.
  - Íconos en campos de entrada (email y contraseña).
  - Diseño completamente responsive para móvil.

- **Animaciones de entrada suave**: Implementadas animaciones CSS para mejorar la experiencia de usuario.
  - Animación fade-in en el panel de branding con delays escalonados.
  - Animación scale-in en el formulario de login.
  - Transiciones suaves en botones e inputs.

#### Mejoras en Vista de Solicitudes por Alianza
- **Nombre de alianza en título**: El título ahora muestra "Solicitudes de [nombre alianza]" en lugar del ID.
  - ID de alianza en formato corto con funcionalidad de copiado al portapapeles.
  
- **Columnas copiables**: Las columnas ID, Cliente, RUT y Email ahora permiten copiar su valor al hacer clic.
  - Ícono de copiar visible al pasar el mouse.
  - Toast de confirmación al copiar.

- **Nueva columna RUT**: Agregada columna RUT en la vista de solicitudes por alianza.

- **Filtros avanzados**: Nuevos filtros para la vista de solicitudes por alianza.
  - Filtro por Estado con todos los estados disponibles.
  - Filtro por Firma (Firmado/Pendiente).
  - Filtro por rango de fechas (Desde/Hasta) con calendario.
  - Contador de resultados filtrados.
  - Botón "Limpiar" para resetear todos los filtros.

- **Exportación mejorada**: La exportación Excel/CSV ahora incluye los datos filtrados.
  - Nuevas columnas: Firma, Pago, Gestor.
  - Nombre de archivo indica si hay filtros aplicados (`_filtrado`).
  - Estados exportados con etiquetas en español.

- **Navegación al detalle corregida**: Al abrir una solicitud desde alianza, navega correctamente a la vista de Refunds.
  - Botón "Volver" regresa a la lista de solicitudes de la alianza.

#### Correcciones
- **Fix de $NaN en montos**: El componente Money ahora muestra $0 cuando el valor es NaN o undefined.

---

### Versión 2.0.7 - 2026-01-06
- **Botón "Descargar todo"**: Nueva funcionalidad para descargar todos los documentos adjuntos de una solicitud en un archivo ZIP.
  - Botón ubicado en el header de la sección "Documentos" en la vista de detalle.
  - Descarga en paralelo de todos los archivos para mayor velocidad.
  - Archivo ZIP nombrado con el ID público de la solicitud.
  - Indicador de carga mientras se procesan los archivos.

#### Correcciones
- **Fix de error al navegar entre páginas**: Corregido error "Cannot update a component while rendering" en la lista de solicitudes.
  - Movida la llamada a `toast()` dentro de un `useEffect` para evitar actualizar estado durante el render.
  - Mejora en la estabilidad de la navegación entre páginas.

#### Mejoras en Calculadora
- **Cálculo de prima actualizado**: El cálculo de la prima ahora utiliza las cuotas pendientes en lugar de las cuotas totales.
  - Mejora la precisión del cálculo al reflejar el periodo real restante del crédito.

#### Mejoras en Exportación Excel
- **Capital Asegurado corregido**: La columna "Capital Asegurado" ahora muestra el "Saldo asegurado promedio" (`averageInsuredBalance`).
- **Formato de fechas de vigencia**: Las columnas "Vigencia Desde" y "Vigencia Hasta" ahora usan formato dd-mm-aaaa para consistencia.
- **Cálculo de Vigencia Hasta**: Ahora se calcula sumando la cantidad de cuotas pendientes a la fecha de vigencia desde.
