# Servicio de Roles — Especificación para Backend

Versión: 1.0 · Módulo: `Ajustes → Roles y permisos` · Frontend actual: mock en memoria (`src/pages/Ajustes/services/rolesStore.ts`).

Este documento describe el contrato que debe implementar el backend para reemplazar el mock actual. El frontend consume los roles a través del hook `useRoles()` y espera la misma forma de datos.

---

## 1. Concepto

Un **Rol** define un perfil de acceso a las páginas de la plataforma. Cada usuario tiene exactamente **un** rol asignado (relación N:1 usuarios → rol). El listado de páginas es fijo y lo define el frontend (ver §6). El backend solo persiste referencias a esos identificadores como strings.

Existen dos categorías:

- **Rol de sistema (`isSystem: true`)**: no se puede renombrar, no se puede cambiar sus páginas, no se puede eliminar. Solo su `description` es editable.
- **Rol personalizado (`isSystem: false`)**: totalmente editable y eliminable (siempre que no tenga usuarios asignados).

### Roles precargados (seed obligatorio)

| id           | label          | isSystem | allowedPages                                |
| ------------ | -------------- | -------- | ------------------------------------------- |
| `ADMIN`      | Administrador  | `true`   | *todas* las páginas de `ALL_PLATFORM_PAGES` |
| `CALLCENTER` | Call Center    | `false`  | `["Call Center", "Calculadora"]`            |

> `ADMIN` es el único rol marcado como de sistema. `CALLCENTER` viene precargado como conveniencia pero puede editarse o eliminarse desde la UI.

---

## 2. Modelo de datos

### Tabla `roles`

| Columna         | Tipo                                     | Notas                                                                    |
| --------------- | ---------------------------------------- | ------------------------------------------------------------------------ |
| `id`            | `text` PK                                | `ADMIN`, `CALLCENTER` para sistema; `role-xxxxxx` (6 chars) para custom. |
| `label`         | `text` NOT NULL                          | Nombre visible. Único case-insensitive. Máx 40 chars.                    |
| `description`   | `text`                                   | Máx 280 chars. Opcional.                                                 |
| `allowed_pages` | `text[]` NOT NULL                        | Subconjunto de `ALL_PLATFORM_PAGES`. Al menos 1 elemento.                |
| `is_system`     | `boolean` NOT NULL DEFAULT false         | Solo `true` para `ADMIN`.                                                |
| `created_at`    | `timestamptz` NOT NULL DEFAULT now()     |                                                                          |
| `updated_at`    | `timestamptz` NOT NULL DEFAULT now()     | Trigger para actualizar en cada UPDATE.                                  |

Índices:
- Único case-insensitive sobre `label`: `CREATE UNIQUE INDEX roles_label_unique ON roles (lower(label));`

### Campos derivados (calcula el backend en la respuesta, no se persisten)

- `scope`: `"FULL"` si `allowed_pages.length === ALL_PLATFORM_PAGES.length`, si no `"LIMITED"`.
- `restrictedPages`: `ALL_PLATFORM_PAGES − allowed_pages`.
- `summary`:
  - Si `scope === 'FULL'`: `"Acceso completo a la plataforma"`.
  - Si no: `"Acceso limitado (N páginas)"`.
- `shortLabel`: por ahora igual a `label`.
- `usersAssigned` (opcional, útil para la UI): `SELECT COUNT(*) FROM users WHERE role_id = roles.id`.

---

## 3. Contrato de API (REST)

Prefijo sugerido: `/api/roles`. Todas las respuestas en JSON con `Content-Type: application/json`. Todos los endpoints requieren usuario autenticado con rol **Administrador**.

### 3.1 `GET /api/roles` — Listar

**200 OK**
```json
[
  {
    "id": "ADMIN",
    "label": "Administrador",
    "shortLabel": "Administrador",
    "description": "Este usuario podrá visualizar y administrar todas las páginas...",
    "summary": "Acceso completo a la plataforma",
    "scope": "FULL",
    "allowedPages": ["Dashboard", "Solicitudes", "..."],
    "restrictedPages": [],
    "isSystem": true,
    "usersAssigned": 3,
    "createdAt": "2026-01-01T00:00:00.000Z",
    "updatedAt": "2026-01-01T00:00:00.000Z"
  }
]
```

### 3.2 `GET /api/roles/:id` — Obtener uno

**200 OK** → mismo objeto de arriba.
**404** si no existe.

### 3.3 `POST /api/roles` — Crear

**Request**
```json
{
  "label": "Supervisor de operaciones",
  "description": "Puede revisar solicitudes y conciliación.",
  "allowedPages": ["Solicitudes", "Operación", "Conciliación"]
}
```

**Validaciones**:
- `label`: string, trim, 1–40 chars, único case-insensitive.
- `description`: string opcional, máx 280 chars.
- `allowedPages`: array no vacío, todos los valores deben pertenecer a `ALL_PLATFORM_PAGES` (ver §6). Sin duplicados.

Backend genera `id = "role-" + nanoid(6)` (alfanumérico minúsculas) y garantiza unicidad.

**201 Created** → objeto rol completo.
**400** validación fallida → `{ "error": { "campo": ["mensaje"] } }`.
**409** si `label` ya existe → `{ "error": "Ya existe un rol con este nombre" }`.

### 3.4 `PATCH /api/roles/:id` — Editar

**Request** (todos los campos opcionales)
```json
{
  "label": "Nuevo nombre",
  "description": "Nueva descripción",
  "allowedPages": ["Solicitudes"]
}
```

**Reglas específicas para roles de sistema (`is_system = true`)**:
- `label` → rechazar con **422**: `{ "error": "No se puede renombrar un rol de sistema" }`.
- `allowedPages` → rechazar con **422**: `{ "error": "No se pueden modificar las páginas de un rol de sistema" }`.
- `description` → permitido.

**200 OK** → objeto rol completo actualizado.
**404** si no existe.
**409** conflicto de `label`.

### 3.5 `DELETE /api/roles/:id` — Eliminar

**Reglas**:
- Si `is_system === true` → **403 Forbidden**: `{ "error": "Los roles del sistema no pueden eliminarse" }`.
- Si existe al menos 1 usuario con `role_id = :id` → **409 Conflict**:
  ```json
  { "error": "Este rol tiene N usuario(s) asignado(s). Reasígnalos antes de eliminarlo.", "usersAssigned": N }
  ```
- En éxito → **204 No Content**.

> **Nota UX**: el frontend ya exige que el admin escriba el nombre exacto del rol para confirmar. El backend **no** debe pedir esa confirmación de nuevo; simplemente aplica las reglas anteriores.

---

## 4. Integración con la tabla `users`

La tabla de usuarios debe tener una FK:

```sql
ALTER TABLE users
  ADD COLUMN role_id text NOT NULL REFERENCES roles(id) ON UPDATE CASCADE ON DELETE RESTRICT;
```

- `ON DELETE RESTRICT` refuerza a nivel BD la regla del §3.5.
- La autorización a rutas/páginas se hace en el backend leyendo `roles.allowed_pages` del rol del usuario autenticado. El frontend replica la misma lógica para ocultar UI, pero **no es fuente de verdad**.

---

## 5. Autorización

- Solo usuarios con rol `ADMIN` (o cualquier rol cuyo `allowed_pages` contenga `"Ajustes"` **y** `"Usuarios"`) pueden llamar a estos endpoints.
- Recomendado: middleware `requireRole("ADMIN")` mientras solo exista un rol de sistema.
- Todas las respuestas de error deben usar el formato `{ "error": "mensaje" }` o `{ "error": { campo: [msgs] } }` para validaciones.

---

## 6. Enum de páginas de la plataforma (`ALL_PLATFORM_PAGES`)

Fuente de verdad en el frontend: `src/pages/Usuarios/constants/roleAccess.ts`. Al día de hoy:

```
["Dashboard", "Solicitudes", "Call Center", "Alianzas", "Usuarios",
 "Operación", "Calculadora", "Nómina", "Conciliación",
 "Procesos Masivos", "Ajustes"]
```

El backend debe:

1. Validar contra este listado (idealmente cargado desde config compartida o replicado en el backend).
2. Rechazar valores desconocidos con **400**.
3. Cuando se agreguen páginas nuevas: coordinar con frontend, actualizar la lista en ambos lados, y **no** modificar automáticamente los roles existentes (los nuevos accesos son opt-in vía UI).

---

## 7. Auditoría (recomendado, no bloqueante para v1)

Registrar en una tabla `roles_audit`:

| Columna      | Tipo                                        |
| ------------ | ------------------------------------------- |
| `id`         | `uuid`                                      |
| `role_id`    | `text`                                      |
| `action`     | `text` (`created` | `updated` | `deleted`) |
| `changed_by` | `uuid` (user)                               |
| `diff`       | `jsonb` (before/after)                      |
| `created_at` | `timestamptz`                               |

---

## 8. Casos borde

- **Crear rol con las 11 páginas seleccionadas**: se acepta, `scope = "FULL"`, pero `isSystem = false` y sigue siendo eliminable.
- **Editar rol y dejar `allowedPages = []`**: rechazar con 400.
- **Renombrar a un nombre ya usado (case-insensitive)**: 409.
- **Eliminar `ADMIN`**: 403 siempre.
- **Race condition en unicidad de `label`**: el índice único garantiza la integridad; capturar el error y devolver 409.

---

## 9. Migración de datos existentes

Al desplegar por primera vez:

1. Ejecutar seed con `ADMIN` y `CALLCENTER` (ver §1).
2. Mapear la columna actual de rol de los usuarios (si existe algo como `rol enum`) al nuevo `role_id`:
   - `'ADMIN' → 'ADMIN'`
   - `'CALLCENTER' → 'CALLCENTER'`
   - Cualquier otro valor previo → coordinar caso a caso.
3. Solo después de migrar los datos, aplicar el `NOT NULL` y la FK sobre `users.role_id`.

---

## 10. Checklist de entrega

- [ ] Tabla `roles` creada con índices y trigger `updated_at`.
- [ ] Seed de `ADMIN` (isSystem) y `CALLCENTER` (no system).
- [ ] FK `users.role_id` con `ON DELETE RESTRICT`.
- [ ] Endpoints `GET/POST/PATCH/DELETE` con las validaciones descritas.
- [ ] Autorización por rol Administrador en todos los endpoints.
- [ ] Errores en el formato acordado.
- [ ] Campos derivados (`scope`, `restrictedPages`, `summary`, `usersAssigned`) presentes en la respuesta.
- [ ] (Opcional) tabla de auditoría.
