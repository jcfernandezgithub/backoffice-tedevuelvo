import corteCedulaAsset from '@/assets/corte-cedula-legalizada-2026-11.jpg.asset.json'

// The external production host does not serve Lovable's asset proxy path.
// Keep the same immutable attachment, resolving it through its serving origin.
export const corteCedulaImg = new URL(
  corteCedulaAsset.url,
  'https://backoffice-te-devuelvo.lovable.app',
).href