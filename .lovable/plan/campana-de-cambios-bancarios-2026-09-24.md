# Campana de cambios bancarios

## Objetivo
Reemplazar el acceso de “Cambios bancarios” en el menú lateral por una notificación administrativa junto al nombre del usuario.

## Cambios
- Quitar “Cambios bancarios” del menú lateral y retirar allí la consulta de pendientes.
- Mostrar una campana solo a usuarios con rol Administrador.
- Consultar el contador de cambios bancarios pendientes y mostrarlo sobre la campana cuando sea mayor que cero.
- Al abrir la campana, mostrar un resumen claro del estado:
  - cantidad de cambios pendientes;
  - mensaje de bandeja vacía cuando no existan;
  - acceso “Revisar cambios bancarios” hacia la bandeja existente.
- Mantener la ruta y la bandeja actual protegidas para administradores.
- Actualizar el contador periódicamente y después de aprobar, rechazar o cancelar cambios mediante la caché existente.

## Validación
- Confirmar que usuarios no administradores no ven la campana.
- Confirmar que administradores ven contador, resumen y acceso a la bandeja.
- Verificar que “Cambios bancarios” ya no aparece en el menú y que la aplicación compila correctamente.
