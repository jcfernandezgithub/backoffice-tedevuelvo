# Servicio de Conciliación Bancaria — Especificación para Backend

Versión: 1.0 · Módulo: `Conciliación`

Este documento describe el contrato que debe implementar el backend para la asociación de movimientos bancarios (cartolas) con solicitudes de devolución.

---

## 1. Concepto

Una **conciliación** vincula un movimiento bancario (identificado por `documentoNumero`) con una o más solicitudes de devolución, indicando cuánto del abono se asigna a cada solicitud.

- El frontend solo permite conciliar solicitudes cuyo estado sea **Ingresado** (`submitted`).
- El monto asignado al movimiento (`amountApplied`) puede ser menor o igual al abono.
- Al crear una conciliación, el backend debe guardar el monto **real** de devolución (`realAmount`) y dejar la solicitud en estado **Pago Programado** (`payment_scheduled`).

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
| `created_at`       | `timestamptz` NOT NULL DEFAULT now()      |                                                            |
| `created_by`       | `uuid` FK → `users.id` (opcional)         | Usuario que creó la conciliación.                          |

Índices recomendados:
- `CREATE INDEX idx_bank_reconciliation_documento ON bank_reconciliation_links (documento_numero);`
- `CREATE INDEX idx_bank_reconciliation_refund ON bank_reconciliation_links (refund_id);`

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
      "createdAt": "2026-07-10T12:00:00.000Z",
      "createdBy": "uuid-usuario"
    }
  ]
}
```

**404** si no existe conciliación para ese movimiento.

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

### 3.3 `POST /api/v1/bank/reconciliation` — Crear conciliación

Este es el endpoint principal para asociar solicitudes a un movimiento bancario.

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

- `publicId`: identificador público de la solicitud.
- `amountApplied`: monto del abono que se asigna a esa solicitud.
- `realAmount`: monto real de devolución que se guarda en la solicitud.

**Validaciones del backend (críticas)**

1. **Estado de la solicitud**: la solicitud debe estar en estado **`submitted`** (Ingresado).
   - Si el estado actual no es `submitted`, rechazar con **422**:
     ```json
     { "error": "La solicitud TDV-XXXX no está en estado Ingresado" }
     ```
   - **No** debe exigir `payment_scheduled` como estado previo.

2. **Existencia del movimiento**: el `documentoNumero` debe existir en la cartola cargada para el rango de fechas activo.

3. **Saldo disponible**: la suma de `amountApplied` de las solicitudes en el request, más los `amountApplied` ya existentes para ese movimiento, no debe superar el abono del movimiento.

4. **Monto positivo**: cada `amountApplied` y `realAmount` debe ser mayor a 0.

**Proceso atómico esperado en el backend**

1. Validar que todas las solicitudes estén en `submitted`.
2. Validar que el saldo total no exceda el abono.
3. Para cada solicitud:
   - Registrar `realAmount` en el historial de estados y/o en el campo principal de la solicitud.
   - Cambiar el estado de la solicitud a `payment_scheduled`.
   - Crear el registro en `bank_reconciliation_links` con `amount_applied` y `real_amount`.
4. Si cualquier paso falla, hacer rollback completo.

**201 Created** si todo se procesa correctamente.

**400/422** si fallan validaciones, con mensaje claro en `error`.

### 3.4 `DELETE /api/v1/bank/reconciliation/:id`

Elimina un link de conciliación. El backend debe:
- Eliminar el registro de `bank_reconciliation_links`.
- **Opcional**: revertir el estado de la solicitud a `submitted` si ya no tiene otros links y no se ha pagado.

---

## 4. Integración con el estado de la solicitud

El endpoint de conciliación debe ser el responsable de la transición de estado:

- **Antes**: `submitted` (Ingresado).
- **Después**: `payment_scheduled` (Pago Programado).
- **realAmount**: guardar el valor de `realAmount` del request.

**No** se requiere que el frontend llame por separado a un endpoint de actualización de estado. El frontend enviará `realAmount` dentro de `matches` y el backend lo aplicará junto con la creación del link.

---

## 5. Autorización

- Solo usuarios con rol administrador u operaciones pueden llamar a estos endpoints.
- Un usuario con rol Call Center **no** debe poder conciliar.

---

## 6. Casos borde

- **Movimiento parcialmente conciliado**: permitir nuevos links mientras la suma total no supere el abono.
- **Solicitud ya conciliada en otro movimiento**: rechazar con **422**.
- **Múltiples solicitudes para un mismo movimiento**: permitir; validar que la suma total no exceda el abono.
- **Solicitud en estado `payment_scheduled` o posterior**: si llega a este endpoint (por ejemplo por un error previo), se puede aceptar si no tiene links asociados, pero lo ideal es que el frontend solo envíe solicitudes en `submitted`.

---

## 7. Checklist de entrega

- [ ] Endpoint `GET /bank/reconciliation/:documentoNumero` implementado.
- [ ] Endpoint `POST /bank/reconciliation/bulk` implementado.
- [ ] Endpoint `POST /bank/reconciliation` implementado con validación `status = submitted`.
- [ ] Endpoint `DELETE /bank/reconciliation/:id` implementado.
- [ ] Transición atómica a `payment_scheduled` + guardado de `realAmount` dentro del mismo endpoint.
- [ ] Tabla de links con los índices recomendados.
- [ ] Autorización por rol implementada.
- [ ] Errores con mensaje claro en `error`.
