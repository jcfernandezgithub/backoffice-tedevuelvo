# Especificación: Edición de datos para devolución con aprobación de administrador

## 1. Contexto

Hoy los datos bancarios de una solicitud (`bankInfo`) se editan con:

```
PATCH /api/v1/refund-requests/admin/{publicId}/update
Body: { "bankInfo": { "bank": "...", "accountType": "...", "accountNumber": "..." } }
```

Cualquier usuario del backoffice con acceso a la solicitud puede cambiarlos y el cambio se aplica al instante. Como esta cuenta es la que recibe el pago al cliente, cambiarla es una acción **extremadamente sensible** (riesgo de fraude o error).

## 2. Objetivo

1. Se pueden editar (o crear, si no existen) los datos bancarios **solo cuando la solicitud está en `PAYMENT_SCHEDULED`**.
2. Si el usuario es **ADMIN**, el cambio se aplica directo (queda registrado igual).
3. Si el usuario **no es ADMIN**, se crea una **solicitud de cambio pendiente**. `bankInfo` no se toca hasta que un ADMIN la apruebe.
4. Todo queda auditado.

## 3. Reglas de negocio

| # | Regla |
|---|-------|
| R1 | Solo se permite crear o modificar `bankInfo` si `status = PAYMENT_SCHEDULED`. En cualquier otro estado → `409 INVALID_STATUS`. |
| R2 | Da lo mismo si `bankInfo` existe o no: si no existe se crea, si existe se reemplaza. |
| R3 | El rol se valida **en el servidor** con el JWT, nunca con datos que envía el cliente. |
| R4 | Máximo **una** solicitud `PENDING` por solicitud de devolución. Si ya existe → `409 PENDING_CHANGE_EXISTS` (el usuario puede cancelarla y crear otra). |
| R5 | Un ADMIN no puede aprobar un cambio que él mismo pidió (segregación de funciones). Recomendado. |
| R6 | Al aprobar, se revalida R1. Si la solicitud ya no está en `PAYMENT_SCHEDULED` → `409` y el cambio pasa a `EXPIRED`. |
| R7 | Al aprobar, se compara que `bankInfo` actual sea igual al `previousBankInfo` guardado. Si cambió en el intermedio → `409 STALE_CHANGE`. |
| R8 | Mientras haya un cambio `PENDING`: **bloquear** el paso a `PAID` (`PATCH .../status`) y la inclusión en nómina → `409 BANK_CHANGE_PENDING`. |
| R9 | El motivo (`reason`) es obligatorio para no-ADMIN (mín. 10 caracteres). Opcional para ADMIN. |
| R10 | El `PATCH .../update` actual **debe rechazar** `bankInfo` en el body (`403`) para no-ADMIN, y para todos si el estado no es `PAYMENT_SCHEDULED`. Así nadie se salta el flujo. |

## 4. Modelo de datos

Nueva colección `bank_info_change_requests`:

```ts
{
  _id: ObjectId,
  refundId: string,             // publicId de la solicitud
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELED' | 'EXPIRED' | 'APPLIED_DIRECT',
  previousBankInfo: { bank, accountType, accountNumber } | null,
  newBankInfo:      { bank, accountType, accountNumber },
  reason: string,
  requestedBy:  { userId, email, name },
  requestedAt:  Date,
  reviewedBy?:  { userId, email, name },
  reviewedAt?:  Date,
  reviewComment?: string,       // obligatorio al rechazar
  createdAt, updatedAt
}
```

Índices: `{ refundId: 1, status: 1 }`, `{ status: 1, requestedAt: -1 }`.
Índice único parcial: `{ refundId: 1 }` donde `status = 'PENDING'` (garantiza R4).

`APPLIED_DIRECT` = cambio hecho por un ADMIN sin aprobación (sirve de auditoría).

Opcional en la solicitud (`refund_requests`): `hasPendingBankChange: boolean` para filtrar y mostrar avisos sin otra consulta.

## 5. Endpoints

Base: `/api/v1/refund-requests/admin`

### 5.1 Crear cambio
`POST /{publicId}/bank-info-changes`

```json
{ "bankInfo": { "bank": "BANCO ESTADO", "accountType": "CUENTA RUT", "accountNumber": "12345678" }, "reason": "Cliente informó cambio de cuenta por correo" }
```

- ADMIN → aplica en `bankInfo`, crea registro `APPLIED_DIRECT`. `201 { change, applied: true }`
- No ADMIN → crea `PENDING`. `201 { change, applied: false }`

Validaciones: los 3 campos son obligatorios y sin espacios al inicio o final. `accountNumber` solo dígitos (y guion), máx. 30 caracteres. `bank` y `accountType` deben ser valores del catálogo.

### 5.2 Ver cambios de una solicitud
`GET /{publicId}/bank-info-changes` → lista ordenada por `requestedAt desc` (incluye el pendiente si existe).

### 5.3 Listar pendientes (bandeja del ADMIN)
`GET /bank-info-changes?status=PENDING&page=1&limit=20` → **solo ADMIN**.
Cada ítem incluye datos para mostrar: `refundId`, `fullName`, `rut`, `institutionId`, `realAmount`, `previousBankInfo`, `newBankInfo`, `reason`, `requestedBy`, `requestedAt`.
Respuesta con paginación `{ data, meta: { total, page, limit } }` (mismo formato que `/admin/search`).

### 5.4 Aprobar
`POST /bank-info-changes/{changeId}/approve` → **solo ADMIN**
Body opcional: `{ "comment": "Validado con el cliente por teléfono" }`
Acciones, en una **transacción**: revalidar R1, R5, R6 y R7 → actualizar `refund.bankInfo` → `status = APPROVED` → quitar `hasPendingBankChange`.

### 5.5 Rechazar
`POST /bank-info-changes/{changeId}/reject` → **solo ADMIN**
Body: `{ "comment": "..." }` (obligatorio). `bankInfo` no se toca.

### 5.6 Cancelar
`POST /bank-info-changes/{changeId}/cancel` → quien lo pidió, o un ADMIN. Solo si está en `PENDING`.

### 5.7 Contador (opcional, para aviso en el menú)
`GET /bank-info-changes/count?status=PENDING` → `{ count }` (solo ADMIN).

## 6. Códigos de error

| HTTP | code | Cuándo |
|------|------|--------|
| 400 | `VALIDATION_ERROR` | Body inválido |
| 403 | `FORBIDDEN` | No-ADMIN intenta aprobar, rechazar o listar pendientes; o editar `bankInfo` por `/update` |
| 403 | `SELF_APPROVAL_NOT_ALLOWED` | R5 |
| 404 | `NOT_FOUND` | La solicitud o el cambio no existe |
| 409 | `INVALID_STATUS` | La solicitud no está en `PAYMENT_SCHEDULED` |
| 409 | `PENDING_CHANGE_EXISTS` | R4 |
| 409 | `STALE_CHANGE` | R7 |
| 409 | `BANK_CHANGE_PENDING` | R8 (al intentar pasar a PAID o incluir en nómina) |

Formato: `{ "statusCode": 409, "code": "INVALID_STATUS", "message": "..." }`

## 7. Cambios en servicios existentes

1. `PATCH /admin/{id}/update`: aplicar R10 (ignorar o rechazar `bankInfo`).
2. `PATCH /admin/{id}/status`: si el destino es `PAID` y hay un cambio `PENDING` → `409 BANK_CHANGE_PENDING`.
3. Servicios de nómina: excluir o rechazar solicitudes con `hasPendingBankChange = true`.
4. `GET /admin/{id}` y `/admin/search`: devolver `hasPendingBankChange` (y opcionalmente `pendingBankChange` resumido en el detalle).
5. `statusHistory` o timeline: agregar entrada informativa "Datos bancarios actualizados (aprobado por X)", sin cambiar el estado.

## 8. Notificaciones (opcional, recomendado)

Usar el webhook n8n existente con nuevos eventos:
- `BANK_CHANGE_REQUESTED` → correo a los ADMIN con el enlace a la solicitud.
- `BANK_CHANGE_APPROVED` / `BANK_CHANGE_REJECTED` → correo a quien lo pidió.

No incluir el número de cuenta completo en correos. Enmascararlo, por ejemplo `****5678`.

## 9. Seguridad y auditoría

- Rol verificado desde el JWT en cada endpoint (guard `@Roles('ADMIN')`).
- Registro de auditoría inmutable: no se borran cambios, solo cambian de estado.
- Guardar IP y user-agent de quien pide y de quien revisa (recomendado).
- Enmascarar `accountNumber` en logs.

## 10. Flujo

```text
No-ADMIN edita ──► POST bank-info-changes ──► PENDING
                                               │
                        ┌──────────────────────┼─────────────────────┐
                   ADMIN aprueba          ADMIN rechaza        Solicitante cancela
                        │                      │                     │
               bankInfo actualizado        REJECTED              CANCELED
                   APPROVED

ADMIN edita ──► POST bank-info-changes ──► bankInfo actualizado + APPLIED_DIRECT
```

## 11. Criterios de aceptación

- [ ] Editar `bankInfo` fuera de `PAYMENT_SCHEDULED` devuelve 409.
- [ ] Solicitud sin `bankInfo` en `PAYMENT_SCHEDULED` permite crearlo.
- [ ] No-ADMIN crea un cambio PENDING y `bankInfo` no cambia.
- [ ] No-ADMIN recibe 403 al llamar approve/reject o al enviar `bankInfo` por `/update`.
- [ ] ADMIN aprueba y `bankInfo` queda actualizado en una transacción.
- [ ] No se puede tener más de un PENDING por solicitud.
- [ ] Con PENDING activo, pasar a PAID o incluir en nómina devuelve 409.
- [ ] Todo cambio (directo o aprobado) queda registrado con usuario y fecha.
