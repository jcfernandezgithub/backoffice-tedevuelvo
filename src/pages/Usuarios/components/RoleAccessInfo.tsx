import { ShieldCheck, Lock, Check, X, HelpCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { useRoles } from '@/pages/Ajustes/hooks/useRoles'

interface Props {
  role: string
  compact?: boolean
}

export function RoleAccessInfo({ role, compact }: Props) {
  const { getRole } = useRoles()
  const def = getRole(role)

  if (!def) {
    return (
      <div className="rounded-lg border p-4 flex items-center gap-2 text-sm text-muted-foreground bg-muted/30">
        <HelpCircle className="h-4 w-4" />
        Este rol ya no existe. Selecciona uno vigente.
      </div>
    )
  }

  const isFull = def.scope === 'FULL'
  const Icon = isFull ? ShieldCheck : Lock

  return (
    <div className={`rounded-lg border p-4 space-y-3 ${isFull ? 'bg-emerald-50/50 border-emerald-200' : 'bg-amber-50/50 border-amber-200'}`}>
      <div className="flex items-start gap-3">
        <div className={`rounded-md p-2 ${isFull ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm">{def.summary}</span>
            <Badge variant={isFull ? 'default' : 'secondary'} className="text-[10px]">
              {isFull ? 'Acceso completo' : 'Acceso limitado'}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">{def.description}</p>
        </div>
      </div>

      {!compact && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">
              Páginas habilitadas ({def.allowedPages.length})
            </p>
            <ul className="space-y-1">
              {def.allowedPages.map((p) => (
                <li key={p} className="flex items-center gap-2 text-xs">
                  <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                  <span>{p}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">
              Páginas restringidas ({def.restrictedPages.length})
            </p>
            {def.restrictedPages.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">Ninguna</p>
            ) : (
              <ul className="space-y-1">
                {def.restrictedPages.map((p) => (
                  <li key={p} className="flex items-center gap-2 text-xs text-muted-foreground">
                    <X className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  )
}