# Welcome to your Lovable project

## Versión 3.2.2

## Changelog

### Versión 3.2.2 - 2026-02-24

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
