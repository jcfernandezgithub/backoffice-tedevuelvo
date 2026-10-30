import { useId } from 'react'
import { Input } from '@/components/ui/input'
import { AlertCircle } from 'lucide-react'
import { isNonPortablePolicy, NON_PORTABLE_POLICY_MESSAGE } from '@/lib/policyPortability'

type Props = React.ComponentProps<typeof Input>

export function PolicyNumberInput(props: Props) {
  const errorId = useId()
  const blocked = isNonPortablePolicy(props.value)
  return (
    <>
      <Input {...props} aria-invalid={blocked || props['aria-invalid']} aria-describedby={blocked ? errorId : props['aria-describedby']} className={blocked ? 'border-destructive focus-visible:ring-destructive' : props.className} />
      {blocked && (
        <p id={errorId} role="alert" className="flex items-start gap-2 text-sm font-medium text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{NON_PORTABLE_POLICY_MESSAGE}</span>
        </p>
      )}
    </>
  )
}