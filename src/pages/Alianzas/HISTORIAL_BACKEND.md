# Implementación del Historial de Cambios - Backend

## Descripción
Esta documentación describe cómo implementar el historial de cambios para las alianzas en el backend de Te Devuelvo.

## Endpoint Requerido

### GET /api/v1/partners/:id/history

Retorna el historial de cambios de una alianza específica.

**Respuesta esperada:**
```json
[
  {
    "id": "hist_123",
    "alianzaId": "691be4a740d20d6776365e23",
    "changedBy": {
      "id": "68f24333ded054e9ebe8f38f",
      "name": "Admin TeDevuelvo",
      "email": "admin@tedevuelvo.cl"
    },
    "changedAt": "2025-11-18T04:08:05.267Z",
    "changeType": "updated",
    "changes": [
      {
        "field": "telefono",
        "fieldLabel": "Teléfono",
        "oldValue": "+5698778521",
        "newValue": "+56978785124"
      },
      {
        "field": "degravamen",
        "fieldLabel": "Comisión Degravamen",
        "oldValue": "1",
        "newValue": "2"
      }
    ]
  },
  {
    "id": "hist_122",
    "alianzaId": "691be4a740d20d6776365e23",
    "changedBy": {
      "id": "68f24333ded054e9ebe8f38f",
      "name": "Admin TeDevuelvo",
      "email": "admin@tedevuelvo.cl"
    },
    "changedAt": "2025-11-18T03:14:47.850Z",
    "changeType": "created",
    "changes": []
  }
]
```

## Estructura de la Base de Datos

### Tabla: partner_history

```sql
CREATE TABLE partner_history (
  id VARCHAR(36) PRIMARY KEY,
  partner_id VARCHAR(36) NOT NULL,
  changed_by_user_id VARCHAR(36) NOT NULL,
  changed_by_user_name VARCHAR(255) NOT NULL,
  changed_by_user_email VARCHAR(255) NOT NULL,
  changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  change_type ENUM('created', 'updated', 'status_changed') NOT NULL,
  changes JSON,
  
  INDEX idx_partner_id (partner_id),
  INDEX idx_changed_at (changed_at),
  
  FOREIGN KEY (partner_id) REFERENCES partners(_id) ON DELETE CASCADE
);
```

## Implementación en el Backend

### 1. Middleware para capturar cambios

Crear un middleware que capture los cambios antes de actualizar:

```typescript
// middleware/captureChanges.ts
export function capturePartnerChanges(req, res, next) {
  const partnerId = req.params.id;
  const newData = req.body;
  
  // Obtener datos actuales
  Partner.findById(partnerId).then(currentPartner => {
    const changes = [];
    
    // Comparar cada campo
    const fieldsToTrack = {
      name: 'Nombre',
      code: 'Código',
      rut: 'RUT',
      telefono: 'Teléfono',
      contactEmail: 'Email',
      direccion: 'Dirección',
      descripcion: 'Descripción',
      degravamen: 'Comisión Degravamen',
      cesantia: 'Comisión Cesantía',
      status: 'Estado',
      inicioVigencia: 'Fecha de Inicio',
      terminoVigencia: 'Fecha de Término'
    };
    
    for (const [field, label] of Object.entries(fieldsToTrack)) {
      if (newData[field] !== undefined && currentPartner[field] !== newData[field]) {
        changes.push({
          field,
          fieldLabel: label,
          oldValue: String(currentPartner[field] || ''),
          newValue: String(newData[field])
        });
      }
    }
    
    // Guardar cambios en req para usar después
    req.partnerChanges = changes;
    next();
  });
}
```

### 2. Guardar historial después de actualizar

```typescript
// En el controlador de actualización
async updatePartner(req, res) {
  const partnerId = req.params.id;
  const changes = req.partnerChanges || [];
  
  // Actualizar partner
  const updatedPartner = await Partner.findByIdAndUpdate(
    partnerId,
    req.body,
    { new: true }
  );
  
  // Guardar en historial solo si hay cambios
  if (changes.length > 0) {
    await PartnerHistory.create({
      id: generateId(),
      partner_id: partnerId,
      changed_by_user_id: req.user.id,
      changed_by_user_name: req.user.fullName,
      changed_by_user_email: req.user.email,
      changed_at: new Date(),
      change_type: 'updated',
      changes: JSON.stringify(changes)
    });
  }
  
  res.json(updatedPartner);
}
```

### 3. Endpoint para obtener historial

```typescript
// GET /api/v1/partners/:id/history
async getPartnerHistory(req, res) {
  const partnerId = req.params.id;
  
  const history = await PartnerHistory
    .find({ partner_id: partnerId })
    .sort({ changed_at: -1 })
    .limit(50); // Últimos 50 cambios
  
  const formatted = history.map(entry => ({
    id: entry.id,
    alianzaId: entry.partner_id,
    changedBy: {
      id: entry.changed_by_user_id,
      name: entry.changed_by_user_name,
      email: entry.changed_by_user_email
    },
    changedAt: entry.changed_at,
    changeType: entry.change_type,
    changes: JSON.parse(entry.changes || '[]')
  }));
  
  res.json(formatted);
}
```

### 4. Registrar creación de alianza

```typescript
// En el controlador de creación
async createPartner(req, res) {
  const newPartner = await Partner.create(req.body);
  
  // Registrar creación en historial
  await PartnerHistory.create({
    id: generateId(),
    partner_id: newPartner._id,
    changed_by_user_id: req.user.id,
    changed_by_user_name: req.user.fullName,
    changed_by_user_email: req.user.email,
    changed_at: new Date(),
    change_type: 'created',
    changes: '[]'
  });
  
  res.json(newPartner);
}
```

## Frontend - Integración

Una vez implementado el endpoint, el frontend lo consumirá automáticamente. Solo necesitas descomentar el código en `ViewAlianzaDialog` que está marcado como placeholder.

## Consideraciones de Seguridad

1. **Autenticación**: El endpoint debe requerir autenticación
2. **Autorización**: Solo usuarios con permisos pueden ver el historial
3. **Auditoría**: El historial NO debe ser modificable ni eliminable
4. **Retención**: Definir política de retención de datos (ej: mantener por 2 años)

## Mejoras Futuras

- Paginación del historial
- Filtros por rango de fechas
- Filtros por usuario que realizó el cambio
- Exportar historial a CSV/Excel
- Notificaciones cuando se realizan cambios críticos
