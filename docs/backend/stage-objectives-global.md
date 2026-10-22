# Objetivos por etapa centralizados — Especificación para Backend

**Versión:** 1.0  
**Fecha:** 22 de octubre de 2026  
**Módulos:** Ajustes → Objetivos por etapa; Operación → Resumen y Cuellos de Botella.  
**Estado:** propuesta de contrato para implementar y coordinar con frontend; no describe servicios ya disponibles.

## 1. Problema y objetivo

Actualmente los días objetivo se guardan en `localStorage`, clave `tdv:stage-objectives`. No se guardan en el servidor ni por identidad: son propios del navegador y pueden persistir al cambiar de usuario en ese navegador. Otros dispositivos pueden usar valores distintos.

Se requiere una única configuración central del backoffice: cuando un administrador guarda un cambio, todos los usuarios autorizados deben utilizar esos mismos objetivos para evaluar plazos. **Central no significa público:** los servicios requieren autenticación y autorización. No exponer esta configuración mediante un repositorio o endpoint público.

Esta entrega es una especificación; no modifica la aplicación ni implementa endpoints.

## 2. Alcance y reglas

- Una configuración global para el backoffice, no una por usuario, navegador o sesión.
- Solo administradores activos pueden modificar o restaurar los objetivos. El servidor valida esta condición con la identidad autenticada, nunca con un rol enviado en el cuerpo.
- Lectura para usuarios activos autorizados a consultar Operación o administrar estos ajustes; no ampliar permisos de Alianzas, Call Center ni otros perfiles.
- Los cinco objetivos deben ser números enteros entre **1 y 365 días**, inclusive, conservando los límites actuales.
- Son días corridos, no hábiles. No introducir calendarios de feriados ni modificar el cálculo actual de tiempos entre transiciones.
- La clave corresponde a la etapa destino de la transición, no al tiempo estático en su estado actual.
- `QUALIFYING` / En Calificación se excluye: es el punto de entrada y no tiene objetivo de transición.
- Mantener la convención de estados: mayúsculas en API; minúsculas en frontend.
- El total se deriva de la suma de los cinco objetivos y no se edita independientemente. Inicialmente es **26 días**. No reemplazar con este total otras metas independientes que puedan existir en Operación.
- Un cambio afecta evaluaciones posteriores, incluso al consultar períodos históricos; no altera fechas, estados ni historiales de solicitudes. No se pide versionado de objetivos por fecha de vigencia en esta fase.
- Restaurar valores iniciales es un cambio global, con los mismos permisos, control de concurrencia y auditoría que guardar.

### Valores iniciales comprobados en la aplicación

| Estado API | Clave frontend | Etapa | Días |
|---|---|---|---:|
| DOCS_RECEIVED | docs_received | Documentos recibidos | 5 |
| SUBMITTED | submitted | Ingresadas | 2 |
| APPROVED | approved | Aprobadas | 14 |
| PAYMENT_SCHEDULED | payment_scheduled | Pago programado | 3 |
| PAID | paid | Pagadas | 2 |

## 3. Persistencia

Crear un recurso único y persistente dentro del ámbito del backoffice, utilizando la tecnología y las convenciones del backend existente. Si el backend tiene múltiples organizaciones, resolver el ámbito desde la sesión para no compartir configuración entre organizaciones.

Campos del recurso:

- `objectives`: los cinco pares `status` / `targetDays`.
- `version`: entero positivo, incrementado en cada modificación efectiva.
- `updatedAt`: fecha/hora UTC ISO 8601 generada en servidor.
- `updatedBy`: identificador y nombre del ejecutor, obtenidos de la sesión. Puede ser `null` solo en la inicialización técnica.

No permitir duplicados de configuración dentro del mismo ámbito. Inicializar una vez con los valores anteriores; no sobrescribir una configuración existente en despliegues posteriores. Los valores locales no deben importarse automáticamente: no existe una fuente local confiable que represente el acuerdo global.

## 4. Contrato propuesto

Usar la base URL, autenticación Bearer y renovación de sesión existentes. Las rutas siguientes son propuestas y deben ser confirmadas por backend antes de integrar frontend.

### 4.1 Consultar

`GET /api/v1/settings/stage-objectives`

**200 OK**

```json
{
  "objectives": [
    { "status": "DOCS_RECEIVED", "targetDays": 5 },
    { "status": "SUBMITTED", "targetDays": 2 },
    { "status": "APPROVED", "targetDays": 14 },
    { "status": "PAYMENT_SCHEDULED", "targetDays": 3 },
    { "status": "PAID", "targetDays": 2 }
  ],
  "totalTargetDays": 26,
  "version": 1,
  "updatedAt": "2026-10-22T12:52:00.000Z",
  "updatedBy": null
}
```

La fecha es ilustrativa. `totalTargetDays` debe coincidir siempre con la suma; no aceptarlo como entrada de actualización. Devolver la configuración completa en un orden estable.

### 4.2 Reemplazar los objetivos

`PUT /api/v1/settings/stage-objectives`

Reemplazo completo y atómico de los cinco objetivos. Ejemplo de solicitud:

```json
{
  "expectedVersion": 1,
  "objectives": [
    { "status": "DOCS_RECEIVED", "targetDays": 6 },
    { "status": "SUBMITTED", "targetDays": 2 },
    { "status": "APPROVED", "targetDays": 14 },
    { "status": "PAYMENT_SCHEDULED", "targetDays": 3 },
    { "status": "PAID", "targetDays": 2 }
  ]
}
```

**200 OK:** misma estructura de GET, con `totalTargetDays: 27`, nueva versión y autor/fecha reales del servidor.

Validaciones obligatorias:

1. Exactamente las cinco claves admitidas, sin repetidas ni faltantes.
2. `targetDays` entero de 1 a 365; rechazar cadenas, decimales, cero, negativos y nulos. No redondear ni convertir silenciosamente.
3. `expectedVersion` obligatorio y coincidente con la versión persistida.
4. Cambio, incremento de versión y auditoría en una única operación atómica.
5. Si los valores coinciden con los vigentes y la versión coincide, devolver la configuración actual sin incrementar versión ni generar una modificación ficticia.
6. No aceptar autor, fecha, ámbito ni versión nueva como atributos controlados por el cliente.

Para restaurar los valores iniciales, frontend enviará el mismo PUT con los cinco valores de la tabla y la versión vigente. No se requiere un servicio adicional.

### 4.3 Errores

Usar un formato estable, compatible con las convenciones del backend:

```json
{
  "code": "STAGE_OBJECTIVES_VERSION_CONFLICT",
  "message": "Otro administrador actualizó los objetivos. Recarga los valores antes de guardar.",
  "requestId": "req-example"
}
```

| HTTP | Código propuesto | Condición |
|---|---|---|
| 401 | UNAUTHORIZED | Sesión ausente, inválida o expirada |
| 403 | FORBIDDEN | Usuario sin permiso de lectura o modificación |
| 422 | INVALID_STAGE_OBJECTIVES | Objetivos o versión de entrada inválidos; incluir detalles por campo |
| 409 | STAGE_OBJECTIVES_VERSION_CONFLICT | La versión cambió desde la lectura |
| 503 | STAGE_OBJECTIVES_UNAVAILABLE | No es posible consultar o persistir la configuración |

Aplicar también la política existente de usuarios inactivos; nunca dar excepción a un administrador inactivo. Ante una respuesta incierta de escritura, el cliente debe releer, no repetir automáticamente el PUT.

## 5. Auditoría y seguridad

Registrar de forma persistente cada modificación efectiva:

- Ámbito y recurso afectados.
- Objetivos anteriores y nuevos.
- Versiones anterior y nueva.
- ID y nombre del administrador autenticado.
- Fecha/hora UTC y `requestId`.

No registrar tokens ni contraseñas. La auditoría debe permitir identificar qué administrador cambió qué plazo y cuándo; no se requiere una pantalla o endpoint de historial en esta fase. No permitir que el endpoint general de actualización de ajustes evada estas validaciones.

La respuesta de lectura y las cachés deben ser privadas y aisladas por ámbito/permisos; no habilitar almacenamiento público compartido.

## 6. Consistencia entre usuarios y disponibilidad

- El GET posterior a un PUT confirmado debe devolver la nueva versión, también desde otras instancias del servicio. Invalidar cualquier caché del servidor al guardar.
- Propuesta de actualización frontend: consultar al abrir Ajustes y Operación; refrescar al recuperar el foco y cada 30 segundos mientras las vistas consumidoras estén activas. Con ello los usuarios con la pantalla abierta reciben el cambio en el siguiente refresco, no necesariamente de forma instantánea.
- Tras guardar, utilizar la respuesta canónica e invalidar la consulta compartida para que Resumen y Cuellos de Botella utilicen los mismos valores.
- Ante fallo de consulta, no volver silenciosamente a los valores locales ni iniciales. Mostrar que los objetivos no están disponibles o que el último valor confirmado está desactualizado; no presentar como vigentes conclusiones de cumplimiento calculadas con datos obsoletos.
- Ante fallo de guardado, mantener el borrador y no anunciar éxito.
- Ante 409, conservar el borrador para revisión y solicitar una nueva lectura; no sobrescribir cambios ajenos automáticamente.
- Si llega una nueva versión mientras hay cambios sin guardar, no reemplazar el borrador sin avisar.

El intervalo de refresco es una propuesta para la integración, no un requisito de infraestructura de eventos en tiempo real.

## 7. Integración frontend posterior

Una vez disponible y confirmado el contrato:

1. Sustituir la persistencia de `src/hooks/useStageObjectives.ts` por la consulta y actualización central.
2. Unificar los consumidores que hoy leen `readStageObjectives()` en Operación → Resumen y Cuellos de Botella.
3. Mantener diseño, filtros, cálculos de transición y demás módulos sin cambios.
4. Mostrar última actualización y administrador ejecutor en Ajustes, con fecha/hora presentada en Chile.
5. Confirmar que guardar/restaurar afecta a todos los usuarios autorizados y restringir las acciones a administradores.
6. Dejar de usar `tdv:stage-objectives` como fuente de verdad; su existencia no puede sobrescribir el servidor.

Estos cambios no se realizan como parte de este documento.

## 8. Pruebas y criterios de aceptación

1. Instalación nueva: GET devuelve 5, 2, 14, 3 y 2 días, total 26; no incluye QUALIFYING.
2. Un administrador cambia DOCS_RECEIVED de 5 a 6; otro usuario en otro navegador obtiene 6 y total 27. El valor persiste tras reiniciar el servicio.
3. Solo un administrador activo puede guardar/restaurar. Un operador autorizado puede leer, pero su PUT recibe 403 y no cambia datos.
4. Perfiles sin acceso a Operación/Ajustes no obtienen acceso mediante estos endpoints.
5. Cada objetivo acepta 1 y 365; rechaza 0, 366, negativos, decimales, texto y null.
6. Rechazar estados desconocidos, repetidos o faltantes sin modificar parcialmente la configuración.
7. Dos administradores leen versión 1: el primer cambio genera versión 2; el segundo PUT con versión 1 recibe 409 y no sobrescribe.
8. Restaurar persiste los valores iniciales para todos y registra ejecutor, versiones y valores anteriores/nuevos.
9. La auditoría y el cambio son atómicos: una falla no puede producir un cambio sin registro.
10. Resumen y Cuellos de Botella consumen la misma versión y conservan las reglas de cálculo actuales.
11. Una consulta histórica utiliza los objetivos globales actuales sin modificar los historiales de las solicitudes.
12. Una caída del servicio no activa valores locales como si fueran vigentes; un guardado fallido no muestra éxito.
13. Guardar valores idénticos con versión vigente no incrementa versión; releer después de una escritura incierta permite comprobar el resultado sin reintentarlo automáticamente.

## 9. Entrega solicitada al equipo backend

Confirmar rutas definitivas, contratos JSON y códigos de error; permisos efectivos de lectura/escritura; inicialización de los cinco valores; persistencia y auditoría; pruebas de concurrencia; URL/entorno donde está desplegado y ejemplos autenticados de GET/PUT sin compartir credenciales. Coordinar el despliegue antes de retirar la fuente local del frontend.
