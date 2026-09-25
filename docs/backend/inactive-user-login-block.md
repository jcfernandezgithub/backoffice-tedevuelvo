# Bloqueo de login para usuarios inactivos y registro de último acceso — Especificación para Backend

Versión: 1.0 · Módulo: `Autenticación / Usuarios` · Relacionado: `Ajustes → Usuarios`

Este documento describe dos brechas detectadas en el servidor de autenticación y el contrato esperado para corregirlas.

---

## 1. Problemas detectados

### 1.1 Un usuario inactivo puede iniciar sesión

**Comportamiento actual:** un usuario marcado como **Inactivo** desde `Ajustes → Usuarios` puede autenticarse normalmente con su correo y contraseña. El servidor valida las credenciales pero **no valida el estado del usuario**.

**Impacto:** desactivar un usuario no tiene efecto real sobre su acceso. Es una brecha de seguridad: cualquier cuenta desactivada (ex-funcionarios, accesos revocados) sigue operativa.

### 1.2 Las sesiones activas no se invalidan al desactivar

**Comportamiento actual:** si un usuario con sesión abierta es desactivado, su token sigue siendo válido hasta que expira o cierra sesión manualmente.

**Impacto:** la desactivación no es inmediata; el usuario puede seguir operando durante la vida útil del token.

### 1.3 El campo "Último acceso" nunca se actualiza

**Comportamiento actual:** el listado de usuarios muestra "Nunca" en la columna Último acceso para todos los usuarios.

**Impacto:** no hay trazabilidad de uso de las cuentas, dificultando auditorías y detección de cuentas abandonadas.

---

## 2. Requisitos

### 2.1 Bloqueo de login para usuarios inactivos (obligatorio)

En el endpoint de autenticación (`POST /api/v1/auth/login` o equivalente), **después de validar las credenciales** y antes de emitir el token:

1. Verificar el estado del usuario (`active` / `status`).
2. Si el usuario está inactivo, **rechazar la autenticación** con:

**403 Forbidden**
```json
{
  "code": "USER_INACTIVE",
  "message": "Tu cuenta está desactivada. Contacta a un administrador."
}
```

Reglas:
- El código de error debe ser `USER_INACTIVE` para que el frontend muestre un mensaje específico (distinto de credenciales inválidas).
- **No** revelar si el correo existe: el mensaje no debe distinguir entre "usuario inactivo" y otros estados ante clientes no autenticados más allá de este código controlado.
- Registrar el intento en el log de auditoría (ver §2.4).

### 2.2 Invalidación de sesiones al desactivar (obligatorio)

Cuando un administrador desactiva un usuario (`PATCH /api/v1/users/{id}` con `active: false` o equivalente):

1. **Revocar todos los tokens/sesiones activas** de ese usuario (blacklist de tokens, rotación de `tokenVersion`, o eliminación de refresh tokens, según la estrategia vigente).
2. Las peticiones posteriores con tokens previos deben responder `401 Unauthorized`.

Adicionalmente, en el endpoint de validación/refresh de sesión (el que el frontend usa al cargar la aplicación), verificar el estado del usuario: si está inactivo, responder `401` aunque el token no haya expirado.

### 2.3 Registro de último acceso (obligatorio)

1. Agregar columna `last_login_at timestamptz NULL` a la tabla de usuarios.
2. Actualizarla con `now()` en cada **login exitoso** (no en cada refresh de token, para no distorsionar el dato).
3. Incluir `lastLoginAt` en la respuesta del listado de usuarios (`GET /api/v1/users`) y en el detalle de usuario.

**Respuesta esperada (extracto):**
```json
{
  "id": "usr-123",
  "email": "operador@tedevuelvo.cl",
  "name": "Pedro Retamales",
  "active": true,
  "lastLoginAt": "2026-09-24T21:05:12.000Z"
}
```

El frontend ya muestra la columna; solo necesita recibir el dato. Si `lastLoginAt` es `null`, se muestra "Nunca".

### 2.4 Auditoría (recomendado)

Registrar en el log de auditoría:
- Intento de login de usuario inactivo (correo, fecha, IP).
- Desactivación/activación de usuarios (quién lo hizo, a quién, cuándo).

---

## 3. Consideraciones de seguridad

- La validación de estado debe hacerse **siempre en el servidor**. El frontend agregará un bloqueo adicional al recibir `USER_INACTIVE`, pero es solo una mejora de experiencia, no una barrera de seguridad.
- La desactivación debe ser efectiva de inmediato: ningún endpoint protegido debe aceptar tokens de usuarios inactivos.
- Un usuario no debe poder desactivarse a sí mismo (el frontend ya lo bloquea; el servidor debe validarlo también y responder `400` con código `CANNOT_DEACTIVATE_SELF`).

---

## 4. Criterios de aceptación

1. Un usuario inactivo que intenta iniciar sesión recibe `403 USER_INACTIVE` y no obtiene token.
2. Al desactivar un usuario con sesión abierta, su siguiente petición autenticada responde `401`.
3. El listado de usuarios muestra la fecha real del último login para cada usuario que haya ingresado.
4. Un usuario activo sin cambios sigue autenticándose con normalidad.
5. Un administrador no puede desactivar su propia cuenta.

---

## 5. Trabajo del frontend (ya comprometido)

- Mostrar mensaje específico "Tu cuenta está desactivada. Contacta a un administrador." al recibir `USER_INACTIVE` en el login.
- Cerrar la sesión local si el servidor responde `401` en la validación de sesión.
- Mostrar `lastLoginAt` en la columna Último acceso del listado de usuarios.
