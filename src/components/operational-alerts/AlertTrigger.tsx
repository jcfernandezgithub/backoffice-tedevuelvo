import type { OperationalAlert } from '@/services/operationalAlertsApi'
import { ruleLabels } from '@/lib/operationalAlerts'
import { SearchCheck } from 'lucide-react'

const guidance = {
  SAME_RUT_MULTIPLE_ACCOUNTS: 'Revisa banco, tipo y número de cuenta en las solicitudes del mismo RUT. Un tipo de cuenta diferente puede explicar la diferencia, aunque las terminaciones visibles coincidan. El servicio no identifica cuál de esos tres datos originó la diferencia.',
  SAME_ACCOUNT_MULTIPLE_RUTS: 'Revisa los RUT de los clientes y los datos bancarios de las solicitudes relacionadas. El servicio detectó una misma cuenta asociada a distintos RUT; las terminaciones visibles por sí solas no permiten comprobarlo.',
  SAME_RUT_MONTHLY_PAID_VOLUME: 'Revisa los montos y las fechas de cambio a Pagado de las solicitudes del mes. Consulta «Última evaluación aplicada» para conocer los criterios y el resultado más reciente.',
  BANK_ACCOUNT_CHANGE_NEAR_PAYMENT: 'Revisa los cambios bancarios y su cercanía al pago en «Antecedentes de la última detección positiva». Si faltan antecedentes, no se puede atribuir la alerta a un cambio específico.',
} satisfies Record<OperationalAlert['ruleCode'], string>

export function AlertTrigger({ alert }: { alert: OperationalAlert }) {
  return <section aria-labelledby="alert-trigger-title" className="border-l-4 border-primary bg-muted/40 px-4 py-3 space-y-2">
    <h3 id="alert-trigger-title" className="font-semibold flex items-center gap-2"><SearchCheck className="h-5 w-5 shrink-0" aria-hidden="true"/>¿Qué originó la detección anterior?</h3>
    <p className="font-medium text-sm">{ruleLabels[alert.ruleCode]}</p>
    {alert.reason && <p className="text-sm break-words">{alert.reason}</p>}
    <p className="text-sm text-muted-foreground">{guidance[alert.ruleCode]}</p>
  </section>
}