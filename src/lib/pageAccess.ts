// Mapeo entre las rutas de la aplicación y las claves de página (pages) que
// entrega el backend en el login. Se usa para filtrar el sidebar y bloquear
// rutas a las que el rol del usuario no tiene acceso.

export const ROUTE_TO_PAGE_KEY: Record<string, string> = {
  '/dashboard': 'DASHBOARD',
  '/refunds': 'SOLICITUDES',
  '/cierre-mensual': 'CIERRE_MENSUAL',
  '/solicitudes': 'SOLICITUDES',
  '/gestion-callcenter': 'GESTION_CALLCENTER',
  '/alianzas': 'ALIANZAS',
  '/usuarios': 'USUARIOS',
  '/operacion': 'OPERACION',
  '/calculadora': 'CALCULADORA',
  '/nomina-devoluciones': 'NOMINA',
  '/conciliacion': 'CONCILIACION',
  '/procesos-masivos': 'PROCESOS_MASIVOS',
  '/ajustes': 'AJUSTES',
}

export function pageKeyForPath(pathname: string): string | null {
  // Match la ruta base más larga que coincida.
  const match = Object.keys(ROUTE_TO_PAGE_KEY)
    .sort((a, b) => b.length - a.length)
    .find((base) => pathname === base || pathname.startsWith(base + '/'))
  return match ? ROUTE_TO_PAGE_KEY[match] : null
}

// Páginas en desarrollo: accesibles para ADMIN aunque el backend aún no las
// entregue en el listado `pages` del login. Quitar del set cuando el backend
// incorpore la page al rol correspondiente.
const DEV_PAGES_ADMIN_ONLY = new Set(['CIERRE_MENSUAL'])

export function hasPageAccess(pages: string[] | undefined, key: string | null, rol?: string): boolean {
  if (!key) return true
  if (!pages || pages.length === 0) return false
  if (pages.includes(key)) return true
  return rol === 'ADMIN' && DEV_PAGES_ADMIN_ONLY.has(key)
}

export function firstAllowedRoute(pages: string[] | undefined): string {
  if (!pages || pages.length === 0) return '/login'
  // Preferencias por orden natural del menú.
  const preferred = [
    '/operacion',
    '/dashboard',
    '/gestion-callcenter',
    '/refunds',
    '/calculadora',
    '/alianzas',
    '/usuarios',
    '/nomina-devoluciones',
    '/conciliacion',
    '/procesos-masivos',
    '/ajustes',
  ]
  for (const path of preferred) {
    const key = ROUTE_TO_PAGE_KEY[path]
    if (key && pages.includes(key)) return path
  }
  return '/login'
}