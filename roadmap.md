# Envío de Datos al Banco desde CSV
## Integración Dashboard
- [x] Entregar directiva al backend para conservar newTotalPremium y actualizar contrato y pruebas.
- [ ] Conectar los seis servicios agregados conservando diseño, navegación y prima total calculada.
- [ ] Incorporar consultas por sesión y bloque, cancelación, errores y actualización independiente.
- [ ] Probar contrato y navegación; verificar disponibilidad real y conservar Operación sin cambios.

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