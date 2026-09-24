# Mostrar el rol real en el encabezado

## Cambio
- Conservar el nombre visible del rol que entrega el inicio de sesión, incluso cuando sea un rol personalizado como “Operador”.
- Mostrar ese nombre junto al usuario en la barra superior.
- Mantener como respaldo las etiquetas conocidas: Administrador, Operaciones, Alianzas, Call Center y Solo lectura.
- Aplicar lo mismo al renovar la sesión para que el rol no desaparezca ni vuelva a `READONLY`.

## Validación
- Confirmar que un usuario Operador vea `Nombre · Operador`.
- Confirmar que los permisos y páginas actuales no cambien.
