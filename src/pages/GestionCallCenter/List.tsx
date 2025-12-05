// Call Center - Usa el mismo componente RefundsList con rutas personalizadas
import RefundsList from '@/pages/Refunds/List'

export default function CallCenterList() {
  return <RefundsList title="Call Center" listTitle="Listado Call Center" detailBasePath="/gestion-callcenter" />
}
