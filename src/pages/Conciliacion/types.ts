export type MovementType = 'deposit' | 'charge'
export type MovementStatus = 'pending' | 'partial' | 'reconciled' | 'ignored'

export interface BankMovement {
  id: string
  date: string // ISO
  description: string
  reference?: string
  counterpartName?: string
  counterpartRut?: string
  amount: number // monto original (positivo = abono, negativo = cargo)
  type: MovementType
  remaining: number // saldo del movimiento aún por conciliar
  status: MovementStatus
  createdAt: string
  updatedAt: string
}

export interface ReconciliationLink {
  id: string
  movementId: string
  refundId: string
  refundPublicId: string
  refundClientName: string
  refundClientRut: string
  amountApplied: number
  appliedAt: string
  appliedBy?: string
  note?: string
}

export interface PendingRefund {
  id: string
  publicId: string
  fullName: string
  rut: string
  realAmount: number
  /** Monto estimado por la simulación original (referencia para comparar contra el CSV). */
  estimatedAmount: number
  reconciledAmount: number // suma de matches existentes
  remainingAmount: number
  /** Indica si remainingAmount proviene del estimatedAmountCLP (true) o de un realAmount confirmado (false). */
  isEstimated: boolean
  isFullyReconciled: boolean
  scheduledAt: string
  nroCredito?: string
  /** Nº de póliza del seguro asociado — desde calculationSnapshot. Permite desambiguar entre desgravamen y cesantía cuando comparten nroCredito. */
  nroPoliza?: string
  /** Prima mensual del nuevo seguro (Te Devuelvo) — desde calculationSnapshot. */
  newMonthlyPremium?: number
  /** Cuotas restantes confirmadas del crédito — desde calculationSnapshot. */
  confirmedRemainingInstallments?: number
}