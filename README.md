# Welcome to your Lovable project

## Versión 2.1.0

## Changelog

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

---

### Versión 2.0.6 - 2025-12-30

#### Sistema de Homologación de Instituciones
- **Nuevo sistema extensible**: Implementado sistema de homologación de nombres de instituciones financieras.
  - Archivo `src/lib/institutionHomologation.ts` con mapeo configurable.
  - `institutionId = "chile"` se muestra como "BANCO DE CHILE".
  - Aplicado en: lista de solicitudes, detalle, exportación Excel y carta de corte.
  - Preparado para agregar más instituciones fácilmente.

#### Actualización de Certificados de Cobertura
- **Póliza 342 (créditos hasta 20M)**: Actualizado certificado según documentos oficiales.
  - Código CMF corregido a formato `POL 2 2015 0573`.
  - Fechas de vigencia actualizadas: 13/10/2025 - 12/09/2028.
  - Agregado "No hay comisión" en fila de comisiones.
  - Agregada "Nota 3" indicando prima única pagada a Augustar Seguros de Vida S.A.
  - Condiciones especiales ART. CP actualizado a `5`.

- **Póliza 344 Prime (créditos superiores a 20M)**: Actualizado certificado según documentos oficiales.
  - Fechas de vigencia actualizadas: 01/12/2025 - 30/11/2028.
  - Agregado "No hay comisión" en fila de comisiones.
  - Actualizada "Nota 2" mencionando Augustar Seguros de Vida S.A.
  - Agregada "Nota 3" indicando prima única pagada a Augustar Seguros de Vida S.A.
  - Condiciones especiales ART. CP actualizado a `3`.

---

### Versión 2.0.5 - 2025-12-26

#### Mejoras en Certificado de Cobertura
- **Firma TDV Servicios SpA agregada**: Añadida la firma de TDV Servicios SpA en la sección de firmas del certificado de coberturas.
  - Firma visible junto a las firmas de AuguStar Seguros de Vida y el Asegurado.
  - Aplicado tanto en formato Standard (Póliza 342) como Prime (Póliza 344).

---

### Versión 2.0.4 - 2025-12-24

#### Mejoras en Exportación Excel
- **Reorganización de columnas**: Las columnas del Excel ahora están organizadas por categorías lógicas.
  - Datos del Cliente: ID Público, ID Interno, Nombre, RUT, Email, Teléfono, Fecha de Nacimiento.
  - Estado y Gestión: Estado, Mandato, Origen, Gestor.
  - Datos del Crédito: Institución, Tipo de Seguro, Monto Total, Cuotas Pagadas/Restantes.
  - Cálculos de Primas: Prima Mensual Actual, Porcentaje Prima Actual vs TDV, Prima Antigua, Prima Nueva, Prima Neta, Saldo Insoluto, Costo Nuevo Seguro TDV.
  - Ahorros y Montos: Ahorro Mensual, Ahorro Total, Monto Estimado CLP.
  - Fechas: Fecha de Creación, Última Actualización.

- **Nuevo campo Porcentaje Prima Actual vs Prima TDV**: Cálculo porcentual que muestra la relación entre la prima nueva y la prima actual mensual.
  - Fórmula: `(prima nueva / prima actual mensual) × 100`
  - Incluye símbolo de porcentaje (%) en el valor exportado.

- **Eliminación de duplicados**: Removida columna duplicada "Monto Estimado", conservando solo "Monto Estimado CLP".

---

### Versión 2.0.3 - 2025-12-19

#### Mejoras en Calculadora
- **Margen de seguridad Te Devuelvo corregido**: El margen de seguridad de Te Devuelvo ahora es 10% (anteriormente 15%).
- **Márgenes de seguridad ampliados**: Se agregaron opciones de margen desde 0% hasta 75% en incrementos de 5%.
- **Margen Te Devuelvo configurable**: Nueva funcionalidad para cambiar el porcentaje de margen asociado a "Te Devuelvo".
  - Botón "Configurar" junto a la opción de margen Te Devuelvo.
  - Selector con todas las opciones de porcentaje disponibles.
  - Configuración persistida en localStorage.
  - El PDF exportado refleja el margen configurado.

#### Actualización de Estados de Módulos
- **Calculadora marcada como Productiva**: El módulo Calculadora ahora aparece con badge "Productiva" (verde) en el menú lateral.

#### Acceso Call Center
- **Acceso a Calculadora para usuario Call Center**: El usuario `admin@callcenter.cl` ahora tiene acceso a dos funcionalidades: Call Center y Calculadora.
  - Actualizado filtro de navegación en sidebar para mostrar ambas opciones.
  - Actualizada restricción de rutas en ProtectedRoute para permitir acceso a `/calculadora`.

---

### Versión 2.0.2 - 2025-12-18

#### Renombre de Módulo Reportes a Operación
- **Cambio de nombre completo**: El módulo "Reportes" ha sido renombrado a "Operación" en todo el sistema.
  - Nuevo nombre en el menú lateral: "Operación" con icono Activity.
  - Nueva URL: `/operacion` (anteriormente `/reportes`).
  - Carpeta renombrada de `src/pages/Reportes` a `src/pages/Operacion`.
  - Título de la página actualizado a "Operación".

#### Actualización de Estados de Módulos
- **Estados actualizados en el sidebar**:
  - Dashboard, Solicitudes, Call Center, Alianzas y Operación: "Productiva" (verde).
  - Usuarios y Ajustes: "En desarrollo" (amarillo).

#### Mejoras en Certificado de Cobertura
- **Firma AuguStar corregida**: Posicionamiento correcto de la firma de AuguStar en los PDFs generados.
  - Firma ahora aparece entre el título y la línea de firma, sin superposición de texto.
  - Aplicado tanto en formato Standard (Póliza 342) como Prime (Póliza 344).
  
- **Mejoras de visualización en diálogo**: Optimizado el formulario de generación de certificado.
  - Incrementado ancho del diálogo (`max-w-4xl`) y altura máxima (`max-h-[95vh]`).
  - Espaciado interno ajustado para mostrar toda la información sin scroll.
  - Headers y footers fijos para mejor navegación.

#### Mejoras en Gestión de Pagos
- **Monto Real de Devolución**: Al cambiar el estado a "Pago Programado" se requiere ingresar el monto real de devolución.
  - Campo obligatorio que aparece solo al seleccionar el estado "Pago Programado".
  - Pre-cargado con el monto estimado como referencia.
  - Validación para evitar valores vacíos o en cero.
  - El monto real se almacena en el historial de estados (`statusHistory`) para trazabilidad.

- **Visualización de Datos Bancarios**: Nueva sección para mostrar información de cuenta corriente del cliente.
  - Se muestra cuando el estado es "Pago Programado" o "Pagado" y existen datos bancarios.
  - Mensaje de confirmación: "Los datos bancarios ya fueron registrados para procesar la devolución".
  - Campos mostrados: Banco, Tipo de cuenta y Número de cuenta.
  - Diseño en card con estilo visual diferenciado (success).

- **Indicador de Pago en Lista**: Nueva columna "Pago" en la lista de solicitudes.
  - Badge "Listo" (verde con pulso) cuando existen datos bancarios.
  - Badge "Pendiente" (amarillo) cuando faltan datos bancarios.
  - Filtro "Datos pago" para filtrar por estado de datos bancarios.

---

### Versión 2.0.1 - 2025-12-11

#### Mejoras en Certificado de Cobertura
- **Formato Prime para créditos superiores a 20M**: Implementado nuevo formato de certificado (Póliza 344) para créditos que excedan $20.000.000 CLP.
  - Detección automática del formato según monto del crédito.
  - Badge indicador del formato en el diálogo de generación ("Póliza 342" o "Póliza 344 Prime").
  - Estructura diferenciada con secciones de póliza, contratante, asegurado, coberturas y beneficiarios.

- **Campo Saldo Insoluto editable**: Agregado campo editable en el formulario de generación.
  - Pre-cargado con el monto estimado de la simulación.
  - Validación para evitar valores en cero.
  - Valor reflejado correctamente en el PDF generado.

#### Mejoras en Vista de Solicitudes
- **Visualización de origen y gestor**: Nuevas columnas en la lista de solicitudes.
  - Columna "Origen": Badge con nombre de alianza (clickeable para navegar al detalle) o "Directo".
  - Columna "Gestor": Nombre del usuario de alianza que creó la solicitud.
  - Filtro por origen (Alianza/Directo) en el panel de filtros.

#### Mejoras en Exportación Excel
- **Exportación de columnas adicionales**: La exportación a Excel ahora incluye las columnas "Mandato", "Origen" y "Gestor".
  - Mandato: Muestra "Firmado" o "Pendiente" según el estado del mandato.
  - Origen: Muestra el nombre de la alianza o "Directo" para solicitudes sin alianza.
  - Gestor: Muestra el nombre del gestor asociado a la solicitud.

- **Estados en español**: La columna "Estado" ahora se exporta con las etiquetas en español tal como aparecen en pantalla.
  - Mapeo completo: Simulado, Solicitado, En calificación, Documentos pendientes, etc.

---

### Versión 2.0.0 - 2025-12-05

#### Nuevo Módulo Call Center
- **Módulo Call Center completo**: Implementado nuevo módulo para gestión de solicitudes desde Call Center.
  - Acceso restringido para usuarios con email `admin@callcenter.cl`.
  - Vista de lista con las mismas funcionalidades que Solicitudes.
  - Vista de detalle adaptada sin botones de "Certificado de Cobertura" ni "Carta de Corte".
  - Badge "Vista Call Center" en el encabezado del detalle para identificación visual.
  - Navegación independiente (rutas `/gestion-callcenter` y `/gestion-callcenter/:id`).

- **Subida de archivos con Drag & Drop**: Nueva funcionalidad de carga de documentos en el detalle de solicitudes.
  - Zona de arrastrar y soltar archivos con feedback visual.
  - Soporte para PDF, imágenes, Word y Excel.
  - Interfaz simplificada sin campos adicionales de tipo o nombre.
  - Actualización automática de la lista de documentos tras subir.

- **Badge de estado actualizado**: Cambiado "En construcción" por "En Certificación" con estilo amarillo/naranja.

---

### Versión 1.1.9 - 2025-12-03

#### Mejoras en Certificado de Cobertura
- **Visualización de fórmula de Prima Única**: En la pantalla de generación de certificado de cobertura se muestra ahora la fórmula completa del cálculo de la Prima Única del Seguro.
  - Fórmula visible: "Saldo insoluto × TBM × Nper"
  - Valores numéricos correspondientes mostrados debajo de la fórmula
  - Mejora la transparencia y comprensión del cálculo para el usuario

#### Mejoras en Filtros de Fecha
- **Filtros rápidos de fecha en Dashboard**: Agregados botones de acceso rápido para selección de rangos de fecha.
  - Botones "Hoy", "Ayer", "Última semana" y "Último mes".
  - Corrección de zona horaria usando función `toLocalDateString` para evitar desfases de fecha.
  - Optimización de queries con `staleTime` y `placeholderData` para evitar parpadeos al cambiar filtros.

- **Filtros rápidos de fecha en Solicitudes**: Implementada la misma funcionalidad en la página de Solicitudes (Refunds).
  - Botones de acceso rápido integrados en la sección de filtros.
  - Nueva función `handleDateRangeChange` para actualizar ambas fechas en una sola operación de estado.
  - Diseño responsivo que se adapta a diferentes tamaños de pantalla.

---

### Versión 1.1.8 - 2025-12-02

#### Mejoras en Generación de Documentos
- **Validación de mandato firmado**: Los botones "Certificado de Cobertura" y "Carta de Corte" ahora requieren que el mandato esté firmado para habilitarse.
  - Botones deshabilitados con tooltip explicativo cuando el mandato no está firmado.
  - Validación integrada con el estado `experianStatus.hasSignedPdf` de la solicitud.
  - Mejora en la prevención de generación de documentos sin autorización del cliente.

- **Renombre de botones de documentos**: 
  - "Generar Certificado de Cobertura" → "Certificado de Cobertura".
  - "Generar Carta de Corte" → "Carta de Corte".

#### Mejoras en Navegación
- **Estado de Alianzas actualizado**: El módulo de Alianzas ahora aparece como "Productiva" en el menú lateral (anteriormente "En certificación").

---

### Versión 1.1.7 - 2025-11-26

#### Integración con API Real
- **Solicitudes por Alianza**: Implementada integración con el endpoint real de solicitudes filtradas por alianza.
  - Nuevo método `listByPartner(partnerId: string)` en `refundAdminApi.ts` para consultar solicitudes de una alianza específica.
  - Endpoint integrado: `GET /api/v1/partner-refunds/partner/:partnerId`.
  - La vista de Solicitudes (`/solicitudes`) ahora carga datos reales cuando se proporciona el parámetro `alianzaIdFilter` en la URL.
  - Normalización automática de estados desde el backend a formato consistente.
  - Manejo de errores y validación de respuestas del servicio.
  - Columnas de la tabla adaptadas dinámicamente según la fuente de datos (API real vs mock).
  - Preservación de funcionalidad con datos mock cuando no hay filtro de alianza.

---

### Versión 1.1.6 - 2025-11-25

#### Optimización de Documentos Públicos
- **Mejora en visualización de adjuntos**: Optimizada la sección de documentos públicos en solicitudes.
  - Eliminada llamada redundante al API al hacer clic en la solapa "Documentos Públicos".
  - Los documentos ahora se reutilizan de la consulta inicial del componente padre.
  - Nombre del archivo extraído correctamente de la propiedad `key` del API.
  - Tamaño del archivo mostrado usando la propiedad `size` del API.
  - Removida columna "Tipo" de la tabla de documentos públicos.
  - Mejorado formato de descarga usando el nombre real del archivo con su extensión.

#### Limpieza del Módulo
- **Eliminación del módulo Certificados**: Removido completamente el módulo de certificados del sistema.
  - Eliminada opción "Certificados" del menú lateral de navegación.
  - Eliminadas todas las rutas relacionadas con `/certificados`.
  - Eliminados componentes, mocks y tipos relacionados con certificados.
  - Actualizado `domain.ts` para remover la interfaz `Certificado`.
  - Limpieza en `solicitudesService.ts` de referencias a certificados.

#### Mejoras en Alianzas Comerciales
- **Protección de datos inmutables en edición de alianzas**: Los campos críticos ahora no son editables.
  - Campo "Nombre Comercial" ahora es de solo lectura en el formulario de edición.
  - Campo "Código Único" ahora es de solo lectura en el formulario de edición.
  - Indicadores visuales (fondo gris y cursor no permitido) para campos no editables.
  - Prevención de modificaciones accidentales de identificadores únicos de alianzas.

---

### Versión 1.1.5 - 2025-11-11

#### Correcciones Críticas
- **Fix de crash en página de detalle**: Corregido error `TypeError: Cannot read properties of undefined (reading 'toLocaleString')` en la vista de detalle de solicitudes.
  - El problema ocurría cuando `estimatedAmountCLP` era undefined.
  - Reemplazado código que llamaba directamente a `.toLocaleString()` por el componente `Money` con validación de tipo.
  - Agregada verificación segura: si el valor no es un número, se muestra 'N/A'.
  - Mejora en la robustez del renderizado de montos en toda la aplicación.

---

### Versión 1.1.4 - 2025-11-11

#### Nuevo Estado de Solicitud

- **Estado DATOS_SIN_SIMULACION agregado**: 
  - Nuevo estado "Datos (sin simulación)" disponible en todas las vistas.
  - Dashboard actualizado para mostrar contador de solicitudes en este estado.
  - Reportes y gráficos ahora incluyen este estado en sus análisis.
  - Correcciones en el mapeo de estados en `dashboardService.ts` y `reportsApiClient.ts`.

#### Correcciones
- **Manejo de valores nulos**: Corregido error al renderizar montos undefined en lista de solicitudes.
  - Agregado optional chaining (`?.`) y valor por defecto para `estimatedAmountCLP`.

---

### Versión 1.1.3 - 2025-11-08

#### Mejoras de Responsive y Performance Mobile

- **Optimización para dispositivos móviles**: Todas las vistas ahora son completamente responsivas.
  - Vista de **Refunds/Solicitudes**: Tabla en desktop, cards optimizados en móvil.
  - Vista de **Dashboard**: Grid adaptativo (2 columnas en móvil, hasta 4 en desktop).
  - Padding y spacing adaptativos en todas las páginas para mejor uso del espacio.
  
- **Componentes nuevos para mobile**:
  - `MobileCard`: Componente reutilizable para mostrar datos en formato card.
  - `ResponsiveContainer`: Wrapper para mostrar diferentes vistas según el dispositivo.
  - `LoadingSkeleton` y `EmptyState`: Estados de carga y vacío optimizados.
  - `DataGrid` mejorado: Auto-switch entre tabla (desktop) y cards (móvil).

- **Navegación mejorada**:
  - Sidebar ahora se puede colapsar/expandir con botón de menú hamburguesa.
  - Cierre automático del sidebar en móvil al hacer clic en enlaces.
  - Botón de toggle con animaciones suaves.

- **Optimizaciones de performance**:
  - Touch optimization: `touch-action: manipulation` para mejor respuesta táctil.
  - Tap highlight removido para UX nativa.
  - Overscroll behavior deshabilitado.
  - Antialiasing mejorado con `font-feature-settings`.
  - Reducción de elementos visuales no esenciales en móvil.

- **Breakpoints utilizados**:
  - Mobile: < 768px (md)
  - Tablet: 768px - 1024px (lg)
  - Desktop: > 1024px

---

### Versión 1.1.2 - 2025-11-08

#### Correcciones Críticas
- **Formato de estados en actualización**: Corregido el envío de estados al backend.
  - Los estados ahora se convierten a MAYÚSCULAS antes de enviarlos a la API (SIMULATED, REQUESTED, QUALIFYING, DOCS_PENDING, DOCS_RECEIVED, SUBMITTED, APPROVED, REJECTED, PAYMENT_SCHEDULED, PAID, CANCELED).
  - El frontend continúa usando minúsculas internamente (simulated, requested, etc.) para consistencia.
  - Función `updateStatus` en `refundAdminApi.ts` ahora transforma el estado con `.toUpperCase()` antes del envío.
  - Corrige el error: "status must be one of the following values: SIMULATED, REQUESTED..." al intentar cambiar estados.

---

### Versión 1.1.1 - 2025-11-08

#### Nuevas Funcionalidades
- **Visualización de datos demográficos**: Agregado el despliegue de edad y fecha de nacimiento en la sección "Datos del cliente" del detalle de solicitudes.
  - La edad se obtiene directamente desde `calculationSnapshot.age` del servicio.
  - La fecha de nacimiento se formatea en formato dd/mm/aaaa desde `calculationSnapshot.birthDate`.
  - Ambos campos se muestran con valor "N/A" cuando no están disponibles.

- **Exportación de fecha de nacimiento en Excel**: La funcionalidad de generación de Excel ahora incluye la fecha de nacimiento del cliente.
  - Columna `Fecha_Nacimiento` en el archivo Excel generado.
  - Formato dd/mm/aaaa extraído desde `calculationSnapshot.birthDate`.
  - Manejo de casos sin fecha de nacimiento con valor "N/A".

#### Correcciones
- **Normalización de estados**: Implementada normalización automática de estados de solicitudes desde el servicio.
  - Los estados ahora se convierten a minúsculas automáticamente (simulated, requested, qualifying, etc.).
  - Función `normalizeStatus` en `refundAdminApi.ts` para asegurar consistencia.
  - Mapeo correcto de todos los estados del servicio a las etiquetas en español:
    - `simulated` → "Simulado"
    - `requested` → "Solicitado"
    - `qualifying` → "En calificación"
    - `docs_pending` → "Documentos pendientes"
    - `docs_received` → "Documentos recibidos"
    - `submitted` → "Ingresado"
    - `approved` → "Aprobado"
    - `rejected` → "Rechazado"
    - `payment_scheduled` → "Pago programado"
    - `paid` → "Pagado"
    - `canceled` → "Cancelado"

#### Mejoras Técnicas
- Actualización del tipo `RefundRequest` para reflejar la estructura real del servicio.
- Mejora en el manejo de respuestas del servicio con normalización de estados en todos los endpoints.
- Optimización del código para usar los campos correctos desde `calculationSnapshot`.

---

### Versión 1.1.0 - 2025-11-07

#### Nuevas Funcionalidades
- **Generación de Excel para CIA**: Agregado botón "Archivo Altas CIA" que permite generar un archivo Excel con formato específico para la compañía de seguros.
  - Formulario interactivo para completar datos requeridos por solicitud (Número de Póliza, Código de Crédito).
  - Integración con servicio de consulta de datos de clientes por RUT.
  - Botón "Buscar Información" que consume el servicio `https://rut-data-extractor-production.up.railway.app/rut/{RUT}` para autocompletar datos personales (Sexo, Dirección, Comuna).
  - Mapeo automático de género: MUJ → F, VAR → M.
  - Validación de campos obligatorios antes de generar el archivo.
  - Indicadores visuales de completitud de datos por solicitud.
  - Manejo de errores con mensaje "Datos no encontrados" cuando el servicio no retorna información.

#### Mejoras Técnicas
- Refactorización del componente `GenerateExcelDialog` para mejorar la arquitectura y mantenibilidad.
- Implementación de manejo de estados de carga durante la consulta de información del cliente.
- Uso de accordion para organizar múltiples solicitudes de forma eficiente.

---

### Versión 1.0.0 - 2025-10-22

#### Nuevas Funcionalidades
- **Filtro de Mandato**: Agregado filtro para visualizar solicitudes con mandato firmado o pendiente en la lista de solicitudes.
- **Indicadores Visuales de Estado**: 
  - El estado "REQUESTED" ahora se muestra como "Simulado" para mejor comprensión del usuario.
  - Badges de estado con códigos de color diferenciados para cada estado del proceso.

#### Mejoras de UX
- Optimización de la visualización de estados en la lista de solicitudes.
- Mejora en la presentación de información de mandatos firmados.
- Sistema de filtros ampliado para mejor gestión de solicitudes.

---

## Project info

**URL**: https://lovable.dev/projects/e346b405-766c-446c-a745-3449be733fde

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/e346b405-766c-446c-a745-3449be733fde) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/e346b405-766c-446c-a745-3449be733fde) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/tips-tricks/custom-domain#step-by-step-guide)
