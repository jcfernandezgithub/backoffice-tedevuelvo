import type { StatusHistoryEntry } from '@/types/refund'
import { resolveStatusHistoryAuthor } from '@/lib/statusHistoryAuthor'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

export function StatusHistoryAuthor({ entry }: { entry: StatusHistoryEntry }) {
  const author = resolveStatusHistoryAuthor(entry)
  if (!author.label) return null
  const explanation = 'provenance' in author && author.provenance === 'LOOKUP'
    ? 'Nombre actual del usuario'
    : 'provenance' in author && author.provenance === 'SNAPSHOT'
      ? 'Nombre registrado al realizar la acción'
      : undefined
  const reference = 'reference' in author ? author.reference : undefined
  const label = <span className="break-words [overflow-wrap:anywhere]">{author.label}</span>
  return (
    <>
      {' • por '}
      {explanation || reference ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <span tabIndex={0} className="rounded-sm underline decoration-dotted underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{label}</span>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs break-all">
            {explanation && <p>{explanation}</p>}
            {reference && <p>ID de referencia: {reference}</p>}
          </TooltipContent>
        </Tooltip>
      ) : label}
    </>
  )
}