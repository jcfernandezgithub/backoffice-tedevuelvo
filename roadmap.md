# Envío de Datos al Banco desde CSV
## Alertas operativas
- [x] Ocultar datos actuales del detalle y conservar antecedentes de detección, banco, tipo y cuenta enmascarada; 21 pruebas y revisión en computador/teléfono con datos simulados aprobadas.
- [x] Mejorar revisión de casos: banco, cuenta y tipo explícitos, estados de solicitudes en español y comparación alineada; 21 pruebas y revisión visual en computador/teléfono con datos simulados, sin cambiar detección ni pagos. Verificación real sigue pendiente de sesión autorizada.
- [x] Simplificar pantalla de alertas, separar detalles del análisis y filtros adicionales sin cambiar reglas ni servicios; 21 pruebas aprobadas y revisión visual en computador y teléfono con datos simulados, sin escrituras reales.
- [x] Mover Alertas operativas a Operación con permisos y filtros independientes; retirada del Dashboard, 34 pruebas y revisión completa en escritorio/móvil con datos simulados, sin escrituras reales.
- [x] Integrar pestaña Dashboard, corte común, permisos, filtros, evidencia e historial paginados.
- [x] Incorporar revisión segura y configuración ADMIN sin activar reglas automáticamente.
- [x] Probar contratos y permisos, conflicto con conservación de borrador, toma, comentario, resolución, historial y detalle en nueva pestaña; comprobación móvil con datos simulados, sin modificar solicitudes reales.
- [ ] Verificar alertas con datos reales: el servicio responde 401 sin autenticación; no hay sesión autorizada disponible y el README no confirma despliegue/activación. Requiere acceso de prueba autorizado y confirmar ambiente del backend.
## Entidades financieras
- [x] Mover directorio a Ajustes → Entidades financieras, quitar menú principal y conservar enlaces anteriores; nueve pruebas y navegación ADMIN/operador verificadas con respuestas simuladas.
- [x] Corregir menú oculto cuando login/renovación entregan ADMIN en objeto role en vez de arreglo roles; nueve pruebas aprobadas y navegación con formato real verificada mediante respuestas de prueba, operador sigue sin acceso.
- [x] Integrar directorio administrativo exclusivo ADMIN con listado paginado, consulta, creación, edición y eliminación confirmada; independiente de calculadora y correos.
- [x] Probar contratos, permisos, validaciones y navegación: diez pruebas aprobadas, CRUD y conflicto 409 verificados con respuestas interceptadas, operador sin acceso y móvil sin ensanchar la página; compilación correcta.
- [ ] Verificar directorio con datos reales: el endpoint desplegado responde 404 sin autenticación y no hay sesión administrativa disponible; requiere servicio desplegado y sesión autorizada. No se modificaron contactos reales.
## Columnas de listados
- [x] Incorporar barra superior siempre visible y desplazamiento horizontal inferior en Solicitudes, Cierre Mensual y Call Center. Acciones accesibles sin ensanchar la página en 1568, 1024 y 768 px con respuestas simuladas; filtros y tarjetas móviles sin cambios.
## Correos de datos bancarios
- [x] Añadir selección de todas las páginas filtradas y acceso al detalle en nueva pestaña sin perder la selección; 13 pruebas aprobadas y flujo verificado con respuestas simuladas, sin enviar correos ni modificar solicitudes reales.
- [x] Corregir identificador público en consulta y envío; tratar ya procesada como advertencia no bloqueante y diferenciar fallo previo de envío intentado. Diez pruebas aprobadas; lote con dos advertencias y un envío verificado con respuestas simuladas, sin correos reales.
- [x] Añadir pestaña con lista paginada y selección de solicitudes en Pago programado, confirmación y envío secuencial usando el servicio individual.
- [x] Probar selección, revalidación del estado, payload y detención sin reintentos; siete pruebas nuevas y cinco de regresión aprobadas; interfaz verificada con respuestas simuladas sin enviar correos reales.
- [ ] Verificar envío real: pendiente corrección del error n8n reportado y sesión con destinatarios autorizados; no se enviaron correos reales.

## Póliza mensualizada
- [x] Registrar cambios en README bajo 4.5.1 y actualizar la versión del login.
- [x] Bloquear el ingreso de la póliza Cardiff 226071739 con aviso inmediato en edición y carta de corte; impedir guardado por vías alternativas. Pruebas aprobadas y comprobación visual del formulario con datos de prueba, sin alterar solicitudes reales.

## Vista móvil Dashboard y Operación
- [x] Optimizar filtros, calugas y gráficos en móviles conservando escritorio y cálculos.
- [x] Quitar etiqueta de desarrollo del Dashboard; verificar ambas páginas en 360, 390, 768 y 1683 px con respuestas simuladas, sin sesión real.
- [x] Documentar en el README, bajo la versión 4.5.0, la integración con servicios agregados, la comparación de períodos, la vista móvil y la estabilidad de sesión.

## Integración Dashboard
- [x] Entregar directiva al backend para conservar newTotalPremium y actualizar contrato y pruebas.
- [x] Implementar cliente y presentación de los seis servicios sin recalcular primas; conservar diseño y navegación.
- [x] Incorporar consultas por sesión y bloque, cancelación, errores y actualización independiente.
- [x] Ejecutar 22 pruebas de contrato/regresión y verificar aviso de sesión vencida y regreso al login; compilación correcta, sin cambios en fuentes de Operación.
- [ ] Verificar seis servicios con sesión válida, pestañas, filtros y Operación en vivo: rutas públicas responden 404 y la sesión anterior no renueva (401).
- [ ] Confirmar prima total calculada en backend desplegado: PDF mantiene fórmula anterior; se entregó directiva, pendiente respuesta del equipo backend.

## Call Center
- [x] Presentar el desglose por seguro con calugas alineadas a los indicadores actuales, sin modificar los cálculos.
- [x] Mantener totales y añadir desglose por seguro de gestionadas, primas y ticket; siete pruebas aprobadas y sumas verificadas con el último cruce real.
- [ ] Verificación visual autenticada del desglose: la sesión de prueba no pudo abrir Dashboard; pendiente acceso de prueba válido.
- [x] Excluir re-gestiones del conteo, primas, ticket y gráfico; cinco pruebas aprobadas y regla verificada con datos reales del último cruce.

## Envío bancario
- [x] Forzar Ingresado → Documentos recibidos y registrar proceso masivo y usuario en cada cambio masivo; quince pruebas aprobadas, sin ejecutar envíos reales.
- [x] Consultar el estado posterior al cambio y permitir actualizar resultados sin repetir el envío; cubrir transición diferida y estado intermedio con pruebas.
- [x] Omitir validaciones con IA exclusivamente en Envío de Datos al Banco; nueve pruebas aprobadas, sin envíos bancarios reales.
- [x] Agregar pestaña, carga y revisión de solicitudes con validación del flujo individual.
- [x] Ejecutar cambios a Documentos recibidos secuencialmente, con confirmación y resultados sin reintentos automáticos.
- [x] Probar reglas y verificar la pantalla con respuestas simuladas; distinguir cambio de estado de finalización bancaria.
- [x] Renombrar la pestaña y mostrar cliente, RUT y entidad bancaria en revisión y resultados.
- [ ] Verificar envío bancario real: requiere sesión administrativa y solicitudes autorizadas; no se realizaron envíos reales.