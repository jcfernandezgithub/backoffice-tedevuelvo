# Módulo de Alianzas - Gestión de Usuarios

## Descripción

Este módulo permite gestionar usuarios asociados a cada alianza que accederán exclusivamente al **Portal de Alianzas** para crear y gestionar solicitudes. Los usuarios de alianza NO tienen acceso al backoffice.

## Funcionalidades Implementadas

### ✅ Listado de Alianzas (`/alianzas`)
- **Pills "Usuarios (N)"**: Muestra el conteo de usuarios por alianza
- **Navegación directa**: Click en la pill navega a `/alianzas/:id#usuarios`
- **Menú de acciones**: Opción "Gestionar usuarios" en el dropdown
- **Preservación**: Mantiene toda la funcionalidad existente sin cambios

### ✅ Detalle de Alianza (`/alianzas/:id`)
- **Tabs**: Resumen | Usuarios  
- **URL Hash**: Auto-selecciona tab "Usuarios" cuando la URL contiene `#usuarios`
- **Navegación**: Integrado con el sistema de routing existente

### ✅ Tab "Usuarios" 
- **CRUD completo**: Crear, editar, bloquear, eliminar usuarios
- **Búsqueda y filtros**: Por nombre, email, rol, estado, fechas
- **Ordenamiento**: Por todas las columnas principales
- **Paginación**: Con selector de tamaño de página
- **Exportación**: CSV con datos filtrados
- **Validación**: Formularios con Zod y React Hook Form

### ✅ Roles y Estados
- **Roles**: `ALIANZA_ADMIN` | `ALIANZA_OPERADOR`
- **Estados**: `ACTIVE` | `BLOCKED` | `PENDING`
- **Invitaciones**: Sistema de invitación por email al Portal de Alianzas
- **Seguridad**: No permite eliminar al último admin de la alianza

### ✅ Acciones por Usuario
- Editar datos de contacto y rol
- Bloquear/Desbloquear con nota opcional
- Reiniciar contraseña (mock)
- Reenviar invitación (para usuarios pendientes)
- Revocar sesiones del Portal (mock)
- Eliminar con confirmación destructiva

## Arquitectura

```
src/pages/Alianzas/
├── List.tsx                    # Listado principal con pills de usuarios
├── Detail.tsx                  # Página de detalle con tabs
├── tabs/
│   └── Usuarios.tsx           # Tab de gestión de usuarios
├── components/
│   ├── AllianceUsersTable.tsx      # Tabla principal de usuarios
│   ├── AllianceUserForm.tsx        # Formulario crear/editar
│   ├── AllianceUserRowActions.tsx  # Menú de acciones por fila
│   ├── AllianceUserDetailsDrawer.tsx # Drawer de detalles y audit
│   ├── AllianceUserFilters.tsx     # Panel de filtros
│   ├── BlockUserDialog.tsx         # Dialog para bloquear usuario
│   └── DeleteUserDialog.tsx        # Dialog de confirmación eliminar
├── hooks/
│   └── useAllianceUsers.ts     # Hooks para todas las operaciones
├── services/
│   └── allianceUsersClient.ts  # Cliente mock (listo para API)
├── mocks/
│   └── allianceUsers.seed.ts   # Datos de prueba
├── types/
│   └── allianceUserTypes.ts    # Tipos TypeScript
└── schemas/
    └── allianceUserSchema.ts   # Validación con Zod
```

## Datos Mock

- **2-3 alianzas** con usuarios asociados
- **5-20 usuarios por alianza** con datos realistas
- **Historial de auditoría** para cada acción
- **Latencia simulada** en todas las operaciones

## Integración con APIs

Para conectar con APIs reales, reemplazar las implementaciones en:

1. **`allianceUsersClient.ts`**: Cambiar mocks por llamadas HTTP
2. **Contratos esperados**: Documentados en los tipos TypeScript
3. **Manejo de errores**: Ya implementado para respuestas de API

## Características UX/UI

- **Accesibilidad**: ARIA roles, navegación por teclado, contraste AA
- **Responsive**: Tabla → cards en móvil, sheets para acciones
- **Estados**: Skeletons, empty states, error states
- **Feedback**: Toasts para todas las acciones
- **Corporativo**: Mantiene el estilo visual existente

## Validaciones

- **Email válido**: Formato estándar
- **Teléfono chileno**: Regex para formato local
- **Nombre completo**: Mínimo 2 palabras
- **Reglas de negocio**: No eliminar último admin

## Notas Importantes

- **Sin solicitudes en backoffice**: Los usuarios de alianza crean solicitudes únicamente en el Portal de Alianzas
- **Separación de contextos**: Backoffice para administración, Portal para operación
- **Preparado para producción**: Arquitectura escalable y mantenible