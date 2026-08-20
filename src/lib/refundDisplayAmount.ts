/**
 * Resuelve el monto a mostrar en los listados de solicitudes.
 *
 * - Sin recálculo: se muestra el monto de la simulación (`estimatedAmountCLP`).
 * - Con recálculo (snapshot con datos confirmados del crédito): se muestra el
 *   `totalSaving` del snapshot, que es la devolución recalculada al cliente.
 */
export interface DisplayAmountInfo {
  amount: number
  simulatedAmount: number
  recalculatedAmount: number | null
  isRecalculated: boolean
}

export function resolveDisplayAmount(refund: any): DisplayAmountInfo {
  const snap = refund?.calculationSnapshot || {}
  const simulatedAmount = Number(refund?.estimatedAmountCLP || 0)

  const hasConfirmedData = Boolean(
    snap.confirmedTotalAmount ||
    snap.confirmedAverageInsuredBalance ||
    snap.confirmedOriginalInstallments ||
    snap.confirmedRemainingInstallments
  )
  const totalSaving = Number(snap.totalSaving || 0)

  const isRecalculated =
    hasConfirmedData &&
    totalSaving > 0 &&
    Math.abs(totalSaving - simulatedAmount) > 1

  return {
    amount: isRecalculated ? totalSaving : simulatedAmount,
    simulatedAmount,
    recalculatedAmount: isRecalculated ? totalSaving : null,
    isRecalculated,
  }
}
