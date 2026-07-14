# Servicio de Conciliación Bancaria — Especificación para Backend

Versión: 2.1 · Módulo: `Conciliación`

> **Cambio v2.1** — Se elimina el flujo de dos pasos (draft + confirm). La conciliación
> manual usa el **mismo** endpoint atómico que la conciliación CSV individual:
> `POST /bank/reconciliation` crea el link y transiciona la solicitud a
> `payment_scheduled` en la misma transacción. Ya no existe `/confirm` ni estado
> `pending` en los links.

Este documento describe el contrato que debe implementar el backend para la asociación de movimientos bancarios (cartolas) con solicitudes de devolución.

---

## 1. Concepto

Una **conciliación** vincula un movimiento bancario (identificado por `documentoNumero`) con una o más solicitudes de devolución, indicando cuánto del abono se asigna a cada solicitud.

El flujo se compone de dos pasos explícitos:

1. **Asociar (borrador)** — El usuario agrega una o más solicitudes al movimiento. El backend
   crea los links con estado `pending` (no confirmados). La solicitud **NO** cambia de estado.
   Estos links pueden eliminarse libremente mientras estén en `pending`.
2. **Confirmar** — El usuario confirma la conciliación del movimiento. El backend, en una
   transacción atómica, marca los links `pending` como `confirmed`, guarda el `realAmount` en
   cada solicitud y transiciona el estado a **Pago Programado** (`payment_scheduled`).
   Una vez `confirmed`, un link **NO** puede eliminarse.

Reglas generales:

- El frontend solo agrega solicitudes en estado **Ingresado** (`submitted`).
- El monto asignado al movimiento (`amountApplied`) puede ser menor o igual al abono.
- Un movimiento puede tener conciliación parcial: parte confirmada + saldo restante disponible
  para nuevos borradores/confirmaciones en sesiones posteriores.

---

## 2. Modelo de datos

### Tabla `bank_reconciliation_links` (o nombre equivalente)

| Columna            | Tipo                                      | Notas                                                      |
| ------------------ | ----------------------------------------- | ---------------------------------------------------------- |
| `id`               | `uuid` PK                                 |                                                            |
| `documento_numero` | `text` NOT NULL                           | Identificador del movimiento bancario.                     |
| `refund_id`        | `uuid` NOT NULL FK → `refund_requests.id` | Referencia interna de la solicitud.                        |
| `public_id`        | `text` NOT NULL                           | `publicId` de la solicitud (ej. `TDV-12345`).             |
| `amount_applied`   | `numeric` NOT NULL                        | Monto del abono asignado a esta solicitud.                 |
| `real_amount`      | `numeric` NOT NULL                        | Monto real de devolución a registrar en la solicitud.      |
| `status`           | `text` NOT NULL DEFAULT 'pending'         | `pending` (borrador) \| `confirmed` (aplicado).            |
| `confirmed_at`     | `timestamptz` NULL                        | Timestamp de confirmación (null mientras `pending`).       |
| `confirmed_by`     | `uuid` NULL FK → `users.id`               | Usuario que confirmó (null mientras `pending`).            |
| `created_at`       | `timestamptz` NOT NULL DEFAULT now()      |                                                            |
| `created_by`       | `uuid` FK → `users.id` (opcional)         | Usuario que creó la conciliación.                          |

Índices recomendados:
- `CREATE INDEX idx_bank_reconciliation_documento ON bank_reconciliation_links (documento_numero);`
- `CREATE INDEX idx_bank_reconciliation_refund ON bank_reconciliation_links (refund_id);`
- `CREATE INDEX idx_bank_reconciliation_status ON bank_reconciliation_links (documento_numero, status);`

---

## 3. Contrato de API

Prefijo: `/api/v1/bank`. Todos los endpoints requieren usuario autenticado.

### 3.1 `GET /api/v1/bank/reconciliation/:documentoNumero`

Devuelve el detalle de conciliación de un movimiento bancario.

**200 OK**
```json
{
  "documentoNumero": "123456789",
  "totalApplied": 640227,
  "count": 1,
  "links": [
    {
      "id": "uuid-del-link",
      "refundId": "TDV-12345",
      "amountApplied": 640227,
      "realAmount": 512500,
      "status": "pending",
      "confirmedAt": null,
      "createdAt": "2026-07-10T12:00:00.000Z",
      "createdBy": "uuid-usuario"
    }
  ]
}
```

**404** si no existe conciliación para ese movimiento.

> `totalApplied` debe considerar **todos** los links (pending + confirmed) para que el
> frontend calcule correctamente el saldo restante del movimiento.

### 3.2 `POST /api/v1/bank/reconciliation/bulk`

Recibe un listado de `documentoNumero` y devuelve un resumen de conciliación por cada uno.

**Request**
```json
{
  "documentoNumeros": ["123456789", "987654321"]
}
```

**200 OK**
```json
{
  "byDocumentoNumero": {
    "123456789": { "totalApplied": 640227, "count": 1 },
    "987654321": { "totalApplied": 0, "count": 0 }
  }
}
```

### 3.3 `POST /api/v1/bank/reconciliation` — Asociar (crea borradores)

Crea uno o más links en estado **`pending`**. **No** cambia el estado de la solicitud.

**Request**
```json
{
  "documentoNumero": "123456789",
  "matches": [
    {
      "publicId": "TDV-12345",
      "amountApplied": 640227,
      "realAmount": 640227
    }
  ]
}
```

Campos:
- `publicId`: identificador público de la solicitud.
- `amountApplied`: monto del abono que se asigna a esa solicitud.
- `realAmount`: monto real de devolución a guardar (se persiste ya en el link, aunque
  todavía no se aplique a la solicitud).

**Validaciones del backend**

1. **Estado de la solicitud**: debe estar en **`submitted`** (Ingresado).
   Rechazar con **422** si no lo está:
   ```json
   { "error": "La solicitud TDV-XXXX no está en estado Ingresado" }
   ```
2. **Movimiento**: `documentoNumero` debe existir en la cartola cargada.
3. **Saldo disponible**: `Σ amountApplied (nuevos + existentes pending + existentes confirmed)`
   **no** debe exceder el abono del movimiento.
4. **Solicitud no duplicada**: rechazar si esa `publicId` ya tiene un link (pending o confirmed)
   en cualquier movimiento.
5. **Montos positivos**: `amountApplied > 0` y `realAmount > 0`.

**Comportamiento**

- Crear los registros en `bank_reconciliation_links` con `status = 'pending'`.
- **NO** modificar el estado de la solicitud.
- **NO** modificar `realAmount` en la solicitud todavía (se hace al confirmar).

**201 Created** con los links recién creados (mismo formato de §3.1).

### 3.5 `POST /api/v1/bank/reconciliation/:documentoNumero/confirm` — Confirmar

Confirma todos los links en estado `pending` del movimiento (o un subconjunto explícito).

**Request (opcional body)**
```json
{ "linkIds": ["uuid-1", "uuid-2"] }
```
- Si `linkIds` se omite, se confirman **todos** los links `pending` del movimiento.
- Si se especifica, solo esos links son confirmados.

**Proceso atómico**

Para cada link seleccionado, en una única transacción:
1. Validar que el link esté en `status = 'pending'`.
2. Validar que la solicitud siga en `submitted`. Si no, rollback total con **422**.
3. Guardar `real_amount` del link en el campo `realAmount` de la solicitud.
4. Transicionar la solicitud a `payment_scheduled` (registrar en `status_history`).
5. Actualizar el link: `status = 'confirmed'`, `confirmed_at = now()`, `confirmed_by = user`.

Si cualquier paso falla → **rollback completo**, ningún cambio persiste.

**200 OK**
```json
{
  "documentoNumero": "123456789",
  "confirmedCount": 2,
  "links": [ /* mismo formato que §3.1, con status="confirmed" */ ]
}
```

**422** si algún link ya está `confirmed` o alguna solicitud ya no está en `submitted`.

### 3.4 `DELETE /api/v1/bank/reconciliation/:id`

Elimina un link de conciliación **solo si está en `status = 'pending'`**.

- Si el link está `confirmed` → rechazar con **409 Conflict**:
  ```json
  { "error": "No se puede eliminar un link ya confirmado" }
  ```
- Si está `pending` → eliminar el registro. **No** modifica el estado de la solicitud
  (nunca se había cambiado).

---

## 4. Integración con el estado de la solicitud

La transición de estado se produce **solo** en el endpoint de confirmación (§3.5):

| Acción del usuario         | Endpoint                                | Estado del link | Estado de la solicitud       |
| -------------------------- | --------------------------------------- | --------------- | ---------------------------- |
| Agregar solicitud (draft)  | `POST /bank/reconciliation`             | `pending`       | `submitted` (sin cambios)    |
| Eliminar draft             | `DELETE /bank/reconciliation/:id`       | (eliminado)     | `submitted` (sin cambios)    |
| Confirmar conciliación     | `POST …/:documentoNumero/confirm`       | `confirmed`     | `payment_scheduled` (+ realAmount) |
| Eliminar link confirmado   | ❌ rechazado (409)                       | —               | —                            |

---

## 5. Autorización

- Solo usuarios con rol administrador u operaciones pueden llamar a estos endpoints.
- Un usuario con rol Call Center **no** debe poder conciliar.

---

## 6. Casos borde

- **Movimiento parcialmente conciliado**: permitir nuevos links (pending o confirmados) mientras
  `Σ amountApplied ≤ abono`. Las confirmaciones anteriores permanecen intactas.
- **Solicitud ya vinculada en otro movimiento**: rechazar con **422** en §3.3.
- **Confirmación con solicitud fuera de `submitted`**: si alguien cambió el estado por otra vía
  entre el `POST` y el `confirm`, rechazar toda la confirmación con **422** y no aplicar nada.
- **Reintento de confirm**: si todos los links ya están `confirmed`, responder **200** con
  `confirmedCount: 0` (idempotencia).

---

## 7. Checklist de entrega

- [ ] Endpoint `GET /bank/reconciliation/:documentoNumero` implementado.
- [ ] Endpoint `POST /bank/reconciliation/bulk` implementado.
- [ ] Endpoint `POST /bank/reconciliation` crea links `pending` sin cambiar estado de la solicitud.
- [ ] Endpoint `POST /bank/reconciliation/:documentoNumero/confirm` transiciona a `payment_scheduled` de forma atómica.
- [ ] Endpoint `DELETE /bank/reconciliation/:id` rechaza (409) links ya `confirmed`.
- [ ] Campo `status` (`pending`/`confirmed`) expuesto en la respuesta de `GET`.
- [ ] Tabla de links con los índices recomendados.
- [ ] Autorización por rol implementada.
- [ ] Errores con mensaje claro en `error`.
