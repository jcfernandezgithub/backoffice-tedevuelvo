## Objetivo
Reemplazar las instituciones financieras hardcoded + márgenes en `localStorage` por el nuevo backend (`/public/institutions` y `/admin/institutions`), y agregar CRUD admin completo en Ajustes.

## Arquitectura

```text
backend
  GET  /public/institutions          → calculadora / selects (sin token)
  GET  /admin/institutions           → pantalla Ajustes (con token)
  GET  /admin/institutions/:id
  POST /admin/institutions
  PATCH /admin/institutions/:id      → editar campos / soft-disable (active:false)
  DELETE /admin/institutions/:id     → solo botón "eliminar definitivo"

frontend
  src/services/institutionsService.ts   ← nuevo, fetch + authenticatedFetch
  src/hooks/usePublicInstitutions.ts    ← React Query, cache 5 min, usado por
                                          Calculadora y combos
  src/hooks/useAdminInstitutions.ts     ← React Query admin (lista + mutations)
  src/pages/Ajustes/components/
     SafetyMarginsSection.tsx           ← se renombra mentalmente a
                                          "Instituciones financieras", se
                                          reescribe sobre el endpoint admin
```

## Servicio (`institutionsService.ts`)

```ts
type Institution = {
  id: string;
  value: string;       // slug usado por refunds/snapshots
  label: string;       // texto visible
  grupo: string;
  margen_seguridad: number;
  active: boolean;
};

listPublic(): GET /public/institutions          // sin auth, fetch nativo
listAdmin(): authenticatedFetch GET /admin/...
getAdmin(id)
createAdmin(payload)
updateAdmin(id, payload)   // PATCH
deleteAdmin(id)            // DELETE definitivo
```

`API_BASE_URL` se reutiliza del constante en `apiClient.ts` (exportarla).

## Hooks

- `usePublicInstitutions()` → `useQuery(['institutions','public'])`, staleTime 5 min. Devuelve `{ data, isLoading }`. Filtra `active === true` y ordena por `label`.
- `useAdminInstitutions()` → query + `createMutation`, `updateMutation`, `deleteMutation`, `toggleActiveMutation` (helper sobre update). Invalida ambas queries (`public` y `admin`) tras cada mutación.
- Helpers para reemplazar los actuales (`getSafetyMarginByInstitutionId`, `isInstitutionVisibleInCalculator`): leen desde la query cache; si no hay cache aún, retornan defaults (10%, visible) para no romper cálculos antiguos. Se exportan desde `useSafetyMargins.ts` redirigidos al nuevo módulo para no romper imports existentes.

## Pantalla Ajustes – Instituciones financieras

Reescritura de `SafetyMarginsSection.tsx` manteniendo el estilo actual (cards con gradiente, switch sí/no, búsqueda, KPIs):

Header
- Título "Instituciones financieras" + descripción.
- Botón `+ Nueva institución` (abre dialog de creación).

Toolbar
- Buscador por `label` / `value` / `grupo`.
- Tabs/filtro: Todas · Activas · Inactivas.
- KPIs: Total · Visibles en calculadora (`active === true`) · Margen promedio.

Lista (una card por institución)
- Columna izquierda: nombre (`label`), subtítulo `grupo · value`.
- Input numérico `margen_seguridad` (0–100, step 0.5).
- Switch `Visible en calculadora` ↔ campo `active` del backend.
- Menú "⋯": Editar (label / value / grupo) · Eliminar definitivamente.
- Cambios de margen y de switch son optimistic: se envían con PATCH al soltar el input (debounce 600 ms) o al togglear el switch. Toast de éxito/error y rollback en error.

Dialog de creación / edición
- Campos: `label`, `value` (slug, validado `^[a-z0-9-]+$`), `grupo`, `margen_seguridad`, `active`.
- Reutiliza `react-hook-form` + `zod`.

Eliminación definitiva
- `ConfirmDialog` con texto "eliminar" para evitar accidentes.

Sin dialog masivo de "guardar cambios" como hoy: las acciones son individuales y atómicas vs backend.

## Migración de consumidores

- `INSTITUCIONES_DISPONIBLES` en `calculadoraUtils.ts` deja de exportar lista hardcoded; en su lugar `Calculadora` usa `usePublicInstitutions()` para poblar el select (mapea `value` → snapshot, `label` → texto). Mientras carga, el select muestra skeleton.
- `getSafetyMarginByInstitutionId` se reimplementa leyendo la cache de la query pública (con fallback a 10%).
- `useSafetyMargins` queda como wrapper deprecado que delega en el nuevo hook para no romper imports actuales (`EditSnapshotDialog`, etc.).

## Plan de archivos
1. `src/services/institutionsService.ts` (nuevo)
2. `src/hooks/useInstitutions.ts` (nuevo, public + admin + helpers)
3. `src/pages/Ajustes/components/InstitutionsSection.tsx` (nuevo, reemplaza `SafetyMarginsSection`)
4. `src/pages/Ajustes/components/InstitutionFormDialog.tsx` (nuevo)
5. `src/pages/Ajustes/index.tsx` (swap import)
6. `src/lib/calculadoraUtils.ts` (quitar `INSTITUCIONES_DISPONIBLES` hardcoded o dejar como fallback)
7. `src/pages/Calculadora/index.tsx` (consumir hook)
8. `src/hooks/useSafetyMargins.ts` (re-export shim → nuevos helpers)

## Pendientes de confirmar
1. ¿`value` y `grupo` deben ser editables en la UI o solo `label`, `margen_seguridad` y `active`? Cambiar `value` rompe snapshots existentes.
2. ¿Permito eliminación definitiva (`DELETE`) o oculto ese botón y dejo solo el toggle activo/inactivo?
3. ¿La calculadora pública debe seguir mostrando instituciones aunque la API falle (cae a la lista hardcoded actual) o muestro estado de error?
