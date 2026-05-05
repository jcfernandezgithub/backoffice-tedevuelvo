
## Objetivo

Reemplazar los certificados de cobertura de desgravamen actuales (Pólizas 342/344 + genérico antiguo) por una **única Póliza 347** basada en los PDFs `Pol347_GENERICO.pdf` y `Pol347_BCO_CHILE.pdf`, con copia literal del layout y textos legales, y aplicando la nueva matriz de Planes/Tasas.

## Reglas de negocio confirmadas

**Tramos por monto del crédito (selección de Plan):**
- Plan 1 → ≤ $20.000.000
- Plan 2 → $20.000.001 – $60.000.000
- Plan 3 → $60.000.001 – $100.000.000

**Tasas TBM (mensual por mil) por Plan y tramo de edad:**

| Plan | 18–55 años | 56–64 años |
|------|-----------|-----------|
| Plan 1 | 0,3400 ‰ | 0,4400 ‰ |
| Plan 2 | 0,4400 ‰ | 0,4400 ‰ |
| Plan 3 | 0,4400 ‰ | 0,5000 ‰ |

**Topes y validaciones (ya aplicados en `calculadoraUtils.ts` en la versión anterior):**
- Monto máx: $100M | Edad mín 18 / máx contratación 64 / máx cobertura <72
- Cuotas totales 3–80
- Estos NO se tocan: ya están aplicados.

**Aplica tanto al certificado genérico como al de Banco de Chile** (mismas tasas y planes).

## Alcance

### A. Backups (rollback rápido)
1. `bancoChilePdfGenerator.ts` → `bancoChilePdfGenerator.backup.ts` (copia exacta).
2. Extraer la lógica del PDF genérico actual de `GenerateCertificateDialog.tsx` a un nuevo `genericPdfGenerator.backup.ts` con la implementación tal cual hoy.

Para revertir: cambiar 1 import en `GenerateCertificateDialog.tsx` y 1 import en sus consumidores.

### B. Nuevos generadores (Póliza 347)

Crear:
- `src/pages/Refunds/components/pdfGenerators/pol347Config.ts` — config compartida (rates, plan tiers, helpers `getPlanByAmount`, `getTBM`, `getPrimaUnica`, `getCapitalMaximo`).
- `src/pages/Refunds/components/pdfGenerators/genericPol347Generator.ts` — copia literal de `Pol347_GENERICO.pdf` (10 páginas).
- Reescribir `bancoChilePdfGenerator.ts` con copia literal de `Pol347_BCO_CHILE.pdf` (10 páginas), exportando una función única `generateBancoChilePol347PDF` (ya no Prime/Standard).

**Copia literal**: cada página será una réplica visual del PDF de referencia — tablas, márgenes, fuentes, casillas, posición de firmas/sellos, textos legales palabra por palabra. Se usará el screenshot de cada página parseada como referencia visual durante el desarrollo.

### C. Integración en `GenerateCertificateDialog.tsx`

- Borrar la implementación inline del PDF genérico actual (~2000 líneas) y reemplazarla por una llamada a `generateGenericPol347PDF(refund, formData, firmas)`.
- Reemplazar las llamadas a `generateBancoChilePrimePDF` / `generateBancoChileStandardPDF` por `generateBancoChilePol347PDF` (única).
- Eliminar la rama `isPrime` (ya no aplica: el plan se decide por monto, no por umbral 20M).
- El preview mantiene su flujo actual (form → preview → descarga + upload).

### D. Datos dinámicos a inyectar (idénticos a hoy, sin inventar)

De `refund` y `refund.calculationSnapshot`:
- Nombre, RUT, fecha nacimiento, edad
- Saldo insoluto (`confirmedAverageInsuredBalance` ?? `averageInsuredBalance` ?? `remainingBalance` ?? `estimatedAmountCLP`)
- Cuotas pendientes (`confirmedRemainingInstallments` ?? `remainingInstallments`)
- Fechas crédito, número operación

De `formData`:
- Folio, dirección/nº/depto/ciudad/comuna, celular, sexo, autoriza email
- Beneficiario nombre + RUT (Banco de Chile fija "Banco de Chile" / 97.004.000-5 según el PDF; en el genérico es editable)

Calculados:
- **Plan** (1/2/3) según monto (saldo insoluto)
- **TBM** según Plan + edad
- **Prima Única** = `saldoInsoluto × (TBM / 1000) × cuotasPendientes`

### E. UI a actualizar

- En el formulario de `GenerateCertificateDialog`: si actualmente muestra "Prime / Standard" o "Póliza 342/344", reemplazar por "Plan 1/2/3 — Póliza 347" (label informativo, no editable).
- Actualizar nombre del archivo subido: `Cert_Cobertura_Desgravamen_Pol347_<RUT>_<Folio>.pdf`.

### F. QA visual obligatorio

Después de generar cada PDF nuevo:
1. Renderizar con datos de prueba (1 caso por plan: $15M, $40M, $85M).
2. `pdftoppm` cada PDF → inspeccionar página por página.
3. Comparar contra screenshots de las páginas originales del PDF de referencia.
4. Iterar hasta que no haya texto cortado, tablas mal alineadas, casillas fuera de lugar ni textos resumidos/parafraseados.

## Archivos afectados

```text
NUEVOS:
  src/pages/Refunds/components/pdfGenerators/pol347Config.ts
  src/pages/Refunds/components/pdfGenerators/genericPol347Generator.ts
  src/pages/Refunds/components/pdfGenerators/bancoChilePdfGenerator.backup.ts
  src/pages/Refunds/components/pdfGenerators/genericPdfGenerator.backup.ts

MODIFICADOS:
  src/pages/Refunds/components/pdfGenerators/bancoChilePdfGenerator.ts (reescritura completa)
  src/pages/Refunds/components/GenerateCertificateDialog.tsx (extracción de generador genérico inline + cambios de integración)
```

`calculadoraUtils.ts` y la calculadora **NO se tocan**: las nuevas tasas TBM viven en los generadores PDF, no en la simulación de devolución (que ya quedó actualizada en pasos previos con los rangos del Plan 3).

## Detalles técnicos

- jsPDF (ya está en el proyecto) para generación.
- Las firmas (`firmaAugustarImg`, `firmaTdvImg`, `firmaCngImg`) se mantienen tal cual.
- Los logos de AuguStar de los PDFs nuevos se extraerán del parseo (`parsed-documents://.../page_X_image_1_v2.jpg`) y se copiarán a `src/assets/` para embeber en cada página.
- Mantener `isBancoChile(institutionId)` como router entre generador genérico vs Banco de Chile.

## Riesgos / consideraciones

- 10 páginas × 2 generadores = mucho código. Se hará página por página con QA intermedio.
- Si un dato del PDF nuevo no existe en el sistema (ej. algún campo del beneficiario en variantes raras), te aviso antes de inventar y dejo placeholder vacío.
- La memoria de proyecto sobre Pólizas 342/344 y rates antiguas de Banco Chile quedará obsoleta: actualizo `mem://features/banco-chile-custom-certificate`, `mem://data-structure/banco-chile-desgravamen-rates` y `mem://features/certificate/generic-specs-v2` al final.

## Tiempo estimado

Trabajo intenso. Voy a hacerlo por bloques (backups → config compartido → genérico páginas 1-5 → QA → genérico páginas 6-10 → QA → Banco Chile páginas 1-5 → QA → Banco Chile páginas 6-10 → QA final → integración → memoria).

¿Aprobás el plan y arranco?
