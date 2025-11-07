# Integración de Reportes con API Real

## 📋 Resumen

La página de Reportes ha sido **conectada exitosamente a la API real de refunds**, reemplazando los datos mock por datos en tiempo real del backend.

## 🔄 Cambios Realizados

### 1. Nuevo Cliente de API (`reportsApiClient.ts`)

Se creó un nuevo servicio que:
- Consume datos de `refundAdminApi` 
- Transforma los datos de la API al formato esperado por los componentes de Reportes
- Mapea estados de refunds a estados del dashboard
- Calcula métricas y agregaciones en tiempo real

**Mapeo de Estados:**
```typescript
REQUESTED → SIMULACION_CONFIRMADA
QUALIFYING/DOCS_PENDING/DOCS_RECEIVED → EN_PROCESO  
SUBMITTED → DEVOLUCION_CONFIRMADA_COMPANIA
APPROVED → FONDOS_RECIBIDOS_TD
PAYMENT_SCHEDULED → CLIENTE_NOTIFICADO
PAID → PAGADA_CLIENTE
REJECTED/CANCELED → (excluidos de reportes)
```

### 2. Servicios Actualizados

**`reportsClient.ts`:**
- Ahora delega toda la lógica al nuevo `reportsApiClient`
- Mantiene la misma interfaz pública
- Compatible con todos los componentes existentes

**`dashboardService.ts`:**
- Ya estaba conectado a la API real
- Se mantiene funcionando correctamente
- Usa el mismo mapeo de estados

### 3. Funcionalidades Disponibles

✅ **KPIs en Tiempo Real:**
- Solicitudes totales
- Tasa de éxito (% pagadas)
- Monto estimado total
- Monto pagado a clientes (~85% del estimado)
- Ingresos por comisiones (~12% del pagado)

✅ **Gráficos Temporales:**
- Cantidad de solicitudes
- Montos recuperados
- Montos pagados
- Tasa de éxito
- Granularidad: día/semana/mes

✅ **Distribuciones:**
- Por estado (estados mapeados)
- Por alianza/institución

✅ **Funnel de Conversión:**
- Etapas del proceso
- Porcentajes de avance

✅ **Métricas SLA:**
- Tiempo promedio por institución
- Percentiles P95, P99
- Estado (verde/amarillo/rojo)

✅ **Tabla Resumen:**
- Lista de solicitudes
- Paginación
- Datos transformados

## 📊 Estimaciones

Como la API de refunds no tiene todos los campos exactos del modelo de reportes, se hacen las siguientes estimaciones:

- **Monto pagado al cliente:** 85% del `estimatedAmountCLP`
- **Comisiones:** 12% del monto pagado al cliente
- **Tipo de seguro:** Por defecto "cesantia" (hasta que se agregue al API)
- **Compañía:** "Por determinar" (hasta que se agregue al API)

## 🔧 Mantenimiento

### Para agregar nuevos campos de la API:

1. Actualizar `reportsApiClient.ts` con los nuevos campos
2. Eliminar las estimaciones cuando los datos reales estén disponibles
3. Los componentes de UI no requieren cambios

### Para modificar el mapeo de estados:

Editar las constantes en:
- `src/pages/Reportes/services/reportsApiClient.ts` (línea 7)
- `src/services/dashboardService.ts` (línea 17)

## 🚀 Próximos Pasos

1. **Alertas:** Implementar cálculo de alertas basado en datos reales
2. **Alianzas/Compañías:** Conectar a servicios reales cuando estén disponibles
3. **Optimización:** Implementar caché y paginación en el backend
4. **Tipo de Seguro:** Agregar campo al modelo de refunds

## 📝 Notas Técnicas

- Los filtros se aplican mayormente en el cliente (la API tiene limitaciones)
- Se usa `pageSize: 10000` para obtener todas las solicitudes
- Rechazadas y canceladas se excluyen de los reportes
- Las fechas se manejan en formato ISO con zona horaria de Santiago

## ✅ Testing

Todas las visualizaciones existentes funcionan correctamente:
- Tab Resumen ✓
- Tab Tendencias ✓
- Tab Cuellos de Botella ✓
- Tab Segmentos ✓
- Tab Alertas ✓ (estructura lista para datos reales)

---

**Última actualización:** 2025-11-07
**Autor:** Lovable AI Assistant
