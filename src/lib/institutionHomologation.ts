/**
 * Sistema de homologación de nombres de instituciones
 * Mapea IDs internos a nombres comerciales para despliegue
 */

const institutionHomologations: Record<string, string> = {
  chile: 'BANCO DE CHILE',
  // Agregar más homologaciones aquí:
  // santander: 'BANCO SANTANDER CHILE',
  // bci: 'BANCO DE CRÉDITO E INVERSIONES',
  // estado: 'BANCO DEL ESTADO DE CHILE',
  // scotiabank: 'SCOTIABANK CHILE',
  // itau: 'BANCO ITAÚ CHILE',
  // security: 'BANCO SECURITY',
  // bice: 'BANCO BICE',
  // falabella: 'BANCO FALABELLA',
  // ripley: 'BANCO RIPLEY',
}

/**
 * Obtiene el nombre comercial de una institución
 * @param institutionId - ID interno de la institución
 * @returns Nombre comercial homologado o el ID original si no existe homologación
 */
export function getInstitutionDisplayName(institutionId: string | undefined | null): string {
  if (!institutionId) return 'N/A'
  
  const normalizedId = institutionId.toLowerCase().trim()
  return institutionHomologations[normalizedId] || institutionId
}

/**
 * Verifica si existe una homologación para la institución
 * @param institutionId - ID interno de la institución
 * @returns true si existe homologación
 */
export function hasInstitutionHomologation(institutionId: string | undefined | null): boolean {
  if (!institutionId) return false
  
  const normalizedId = institutionId.toLowerCase().trim()
  return normalizedId in institutionHomologations
}
