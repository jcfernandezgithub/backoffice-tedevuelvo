
# Plan: Rediseño de página Administración de Usuarios

## Alcance
Reemplazar el prototipo actual de `/usuarios` por una experiencia nueva orientada a los dos roles reales de esta etapa: **Administrador** y **Call Center**. Solo capa visual con datos simulados en memoria — sin backend, sin autenticación real, sin cambios en rutas ni en otras páginas.

## Roles y accesos (predefinidos, no editables)
- **Administrador** → "Acceso completo a la plataforma". Ve todas las páginas del sidebar.
- **Call Center** → "Acceso exclusivo al módulo Call Center". Solo ve la página Call Center.

Se define una constante única `ROLE_ACCESS` con la lista de páginas habilitadas/restringidas por rol, reutilizada en formulario, detalle y advertencias. Esto deja preparado el punto de conexión futura con permisos reales.

## Estructura de la página

### Encabezado
- Título: **Administración de usuarios**
- Descripción: "Administra las personas que pueden acceder a la plataforma y define su nivel de acceso."
- Botón principal **Crear usuario** (abre panel lateral).

### KPIs (5 tarjetas)
Total, Activos, Inactivos, Administradores, Call Center — calculadas sobre los datos simulados.

### Buscador + filtros
- Input de búsqueda por nombre o correo.
- Select rol: Todos / Administrador / Call Center.
- Select estado: Todos / Activo / Inactivo / Invitación pendiente.
- Botón **Limpiar filtros** + contador de resultados.
- Filtrado 100% local sobre el store simulado.

### Listado
- **Desktop:** tabla con columnas Nombre, Correo, Rol (badge), Estado (badge), Último acceso, Fecha de creación, Acciones.
- **Mobile (`<md`):** tarjetas con rol y estado arriba, campos apilados y menú contextual de acciones (usa `MobileCard`).
- Skeleton en loading simulado; estado vacío con ilustración textual y CTA "Crear usuario".

### Acciones por usuario (menú `…`)
Ver detalle, Editar, Cambiar rol, Activar/Desactivar, Reenviar invitación (solo si estado = pendiente), Eliminar.
- Acciones destructivas → `ConfirmDialog`.
- Usuario autenticado actual (mockeado, ej. `admin@tedevuelvo.cl`): opciones Eliminar, Desactivar y Cambiar-rol-a-Call-Center quedan deshabilitadas con `Tooltip` explicativo.

## Paneles y diálogos

### Panel lateral Crear/Editar (Sheet)
Dos secciones:
1. **Información** — Nombre, Apellido, Correo, Teléfono (opcional).
2. **Configuración de acceso** — Rol, Estado inicial (Activo / Inactivo / Invitación pendiente).

Debajo del selector de rol se muestra en vivo un bloque **Explicación del rol**:
- Admin → badge "Acceso completo" + lista de páginas.
- Call Center → badge "Acceso limitado" + listas "Páginas habilitadas" y "Páginas restringidas".

Validaciones (zod + react-hook-form): nombre, apellido, correo (formato y unicidad contra el store simulado), rol y estado obligatorios. Errores inline; botón principal deshabilitado con errores.

En edición, si cambia el rol se muestra advertencia contextual y se pide confirmación antes de guardar el cambio de rol.

### Panel lateral Detalle (Sheet)
Datos personales, estado, rol, fechas, descripción del nivel de acceso, listas de páginas habilitadas/restringidas, timeline simulado de actividad (Usuario creado, Rol actualizado, Desactivado, Invitación reenviada). Accesos rápidos: Editar, Cambiar rol, Activar/Desactivar.

### Confirmación de eliminación
Modal con nombre, correo, rol, advertencia y botón destructivo.

## Estado y datos simulados
- Store local con Zustand-like via `useState` + contexto simple en un hook `useMockUsers` que reemplaza el actual `useUsers`. Persiste en memoria durante la sesión.
- Seed con ~10 usuarios cubriendo: admins activos, call center activos, inactivos, invitaciones pendientes, el usuario autenticado actual.
- Toasts (`sonner`) para éxito/error en cada acción.

## Archivos

### Nuevos
- `src/pages/Usuarios/constants/roleAccess.ts` — definición de páginas por rol (punto de conexión futura).
- `src/pages/Usuarios/mocks/mockUsers.seed.ts` — datos simulados iniciales.
- `src/pages/Usuarios/hooks/useMockUsers.ts` — store en memoria (CRUD + filtros).
- `src/pages/Usuarios/components/UsersStats.tsx` — 5 KPIs.
- `src/pages/Usuarios/components/UsersFilters.tsx` — buscador + filtros + limpiar.
- `src/pages/Usuarios/components/UsersTable.tsx` — tabla desktop.
- `src/pages/Usuarios/components/UsersMobileList.tsx` — tarjetas mobile.
- `src/pages/Usuarios/components/UserRowActionsV2.tsx` — menú de acciones con restricciones del usuario actual.
- `src/pages/Usuarios/components/UserFormSheet.tsx` — panel crear/editar con explicación de rol.
- `src/pages/Usuarios/components/UserDetailsSheet.tsx` — panel detalle.
- `src/pages/Usuarios/components/RoleAccessInfo.tsx` — bloque reutilizable de accesos por rol.
- `src/pages/Usuarios/components/DeleteUserConfirm.tsx` — modal eliminar.
- `src/pages/Usuarios/schemas/userSchemaV2.ts` — zod schema con validaciones actualizadas.
- `src/pages/Usuarios/types/userTypesV2.ts` — tipos `Role = 'ADMIN' | 'CALLCENTER'`, `UserState = 'ACTIVE' | 'INACTIVE' | 'PENDING'`.

### Modificados
- `src/pages/Usuarios/index.tsx` — reescrito para usar los componentes nuevos.
- `README.md` — sección versión **4.1.3**.
- `src/pages/auth/Login.tsx` — versión 4.1.3.

### Conservados (sin tocar)
Todos los componentes legacy (`UserTable`, `UserForm`, `UserDetailsDrawer`, `useUsers`, etc.) se dejan como referencia para no romper otras dependencias; simplemente dejan de usarse en la página.

## Restricciones respetadas
- No se crean roles ni matriz editable de permisos.
- No se toca autenticación, rutas protegidas, ni el sidebar (los roles no ocultan páginas reales todavía).
- Ningún otro módulo se modifica.

## Puntos a conectar al backend en la siguiente etapa
1. Reemplazar `useMockUsers` por servicio real (crear, listar, editar, eliminar, cambiar estado, cambiar rol, reenviar invitación).
2. Alimentar el usuario autenticado actual desde `AuthContext` en vez del mock.
3. Invitaciones reales por correo (`Reenviar invitación`).
4. Persistir el rol en el backend y aplicar restricciones reales en `AppSidebar`, `ProtectedRoute` y `AdminRoute`.
5. Migrar `ROLE_ACCESS` a datos servidos por backend cuando se soporten permisos personalizados.
6. Auditoría real de actividad reemplazando el timeline simulado.
