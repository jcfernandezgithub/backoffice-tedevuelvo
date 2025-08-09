import { Badge } from '@/components/ui/badge'

export function StatusBadge({ estado }: { estado: string }) {
  const map: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
    SIMULACION_CONFIRMADA: { variant: 'secondary', label: 'Simulación confirmada' },
    DEVOLUCION_CONFIRMADA_COMPANIA: { variant: 'default', label: 'Devolución confirmada' },
    FONDOS_RECIBIDOS_TD: { variant: 'default', label: 'Fondos recibidos' },
    CERTIFICADO_EMITIDO: { variant: 'default', label: 'Certificado emitido' },
    CLIENTE_NOTIFICADO: { variant: 'default', label: 'Cliente notificado' },
    PAGADA_CLIENTE: { variant: 'default', label: 'Pagada al cliente' },
    PENDIENTE: { variant: 'secondary', label: 'Pendiente' },
    APROBADA: { variant: 'default', label: 'Aprobada' },
    PAGADA: { variant: 'default', label: 'Pagada' },
  }
  const cfg = map[estado] ?? { variant: 'outline', label: estado }
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>
}
