# Welcome to your Lovable project

## Versión 1.1.1

## Changelog

### Versión 1.1.1 - 2025-11-08

#### Nuevas Funcionalidades
- **Visualización de datos demográficos**: Agregado el despliegue de edad y fecha de nacimiento en la sección "Datos del cliente" del detalle de solicitudes.
  - La edad se obtiene directamente desde `calculationSnapshot.age` del servicio.
  - La fecha de nacimiento se formatea en formato dd/mm/aaaa desde `calculationSnapshot.birthDate`.
  - Ambos campos se muestran con valor "N/A" cuando no están disponibles.

- **Exportación de fecha de nacimiento en Excel**: La funcionalidad de generación de Excel ahora incluye la fecha de nacimiento del cliente.
  - Columna `Fecha_Nacimiento` en el archivo Excel generado.
  - Formato dd/mm/aaaa extraído desde `calculationSnapshot.birthDate`.
  - Manejo de casos sin fecha de nacimiento con valor "N/A".

#### Correcciones
- **Normalización de estados**: Implementada normalización automática de estados de solicitudes desde el servicio.
  - Los estados ahora se convierten a minúsculas automáticamente (simulated, requested, qualifying, etc.).
  - Función `normalizeStatus` en `refundAdminApi.ts` para asegurar consistencia.
  - Mapeo correcto de todos los estados del servicio a las etiquetas en español:
    - `simulated` → "Simulado"
    - `requested` → "Solicitado"
    - `qualifying` → "En calificación"
    - `docs_pending` → "Documentos pendientes"
    - `docs_received` → "Documentos recibidos"
    - `submitted` → "Ingresado"
    - `approved` → "Aprobado"
    - `rejected` → "Rechazado"
    - `payment_scheduled` → "Pago programado"
    - `paid` → "Pagado"
    - `canceled` → "Cancelado"

#### Mejoras Técnicas
- Actualización del tipo `RefundRequest` para reflejar la estructura real del servicio.
- Mejora en el manejo de respuestas del servicio con normalización de estados en todos los endpoints.
- Optimización del código para usar los campos correctos desde `calculationSnapshot`.

---

### Versión 1.1.0 - 2025-11-07

#### Nuevas Funcionalidades
- **Generación de Excel para CIA**: Agregado botón "Archivo Altas CIA" que permite generar un archivo Excel con formato específico para la compañía de seguros.
  - Formulario interactivo para completar datos requeridos por solicitud (Número de Póliza, Código de Crédito).
  - Integración con servicio de consulta de datos de clientes por RUT.
  - Botón "Buscar Información" que consume el servicio `https://rut-data-extractor-production.up.railway.app/rut/{RUT}` para autocompletar datos personales (Sexo, Dirección, Comuna).
  - Mapeo automático de género: MUJ → F, VAR → M.
  - Validación de campos obligatorios antes de generar el archivo.
  - Indicadores visuales de completitud de datos por solicitud.
  - Manejo de errores con mensaje "Datos no encontrados" cuando el servicio no retorna información.

#### Mejoras Técnicas
- Refactorización del componente `GenerateExcelDialog` para mejorar la arquitectura y mantenibilidad.
- Implementación de manejo de estados de carga durante la consulta de información del cliente.
- Uso de accordion para organizar múltiples solicitudes de forma eficiente.

---

### Versión 1.0.0 - 2025-10-22

#### Nuevas Funcionalidades
- **Filtro de Mandato**: Agregado filtro para visualizar solicitudes con mandato firmado o pendiente en la lista de solicitudes.
- **Indicadores Visuales de Estado**: 
  - El estado "REQUESTED" ahora se muestra como "Simulado" para mejor comprensión del usuario.
  - Badges de estado con códigos de color diferenciados para cada estado del proceso.

#### Mejoras de UX
- Optimización de la visualización de estados en la lista de solicitudes.
- Mejora en la presentación de información de mandatos firmados.
- Sistema de filtros ampliado para mejor gestión de solicitudes.

---

## Project info

**URL**: https://lovable.dev/projects/e346b405-766c-446c-a745-3449be733fde

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/e346b405-766c-446c-a745-3449be733fde) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/e346b405-766c-446c-a745-3449be733fde) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/tips-tricks/custom-domain#step-by-step-guide)
