export const NON_PORTABLE_POLICY_MESSAGE = 'No es posible portar al cliente con la póliza 226071739 de Cardiff, porque es mensualizada. No se puede continuar con la gestión de esta póliza.'

export function isNonPortablePolicy(value: unknown): boolean {
  return String(value ?? '').trim() === '226071739'
}

export function assertPortablePolicy(value: unknown): void {
  if (isNonPortablePolicy(value)) throw new Error(NON_PORTABLE_POLICY_MESSAGE)
}