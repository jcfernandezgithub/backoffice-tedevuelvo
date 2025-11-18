import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Building2, Mail, Phone, MapPin, Percent, Calendar, Users } from 'lucide-react';
import { AllianceUsersTable } from '../components/AllianceUsersTable';
import { 
  useAllianceUsers,
  useCreateAllianceUser,
  useUpdateAllianceUser,
  useBlockAllianceUser,
  useUnblockAllianceUser,
  useResetAllianceUserPassword,
  useResendAllianceInvitation,
  useRevokeAlliancePortalSessions,
  useDeleteAllianceUser
} from '../hooks/useAllianceUsers';
import type { AllianceUserListParams } from '../types/allianceUserTypes';

interface UsuariosTabProps {
  alianceName: string;
}

export function UsuariosTab({ alianceName }: UsuariosTabProps) {
  const { id: alianzaId } = useParams<{ id: string }>();
  const [params, setParams] = useState<AllianceUserListParams>({
    page: 1,
    pageSize: 10,
  });

  // Mock alliance data - in real app this would come from API
  const alianza = {
    id: alianzaId,
    nombre: alianzaId === 'AL-001' ? 'Sindicato Financiero Andes' : 'Broker Pacífico',
    descripcion: alianzaId === 'AL-001' ? 'Alianza estratégica con sindicato del sector financiero' : 'Broker especializado en seguros comerciales',
    contacto: { email: 'contacto@alianza.cl', fono: '+56 2 2345 6789' },
    direccion: 'Av. Apoquindo 1234, Las Condes',
    comisionDegravamen: 12.5,
    comisionCesantia: 25,
    activo: true,
    fechaInicio: new Date('2024-01-01'),
    fechaTermino: new Date('2025-12-31'),
  };

  const { data, isLoading } = useAllianceUsers(alianzaId!, params);
  const createMutation = useCreateAllianceUser(alianzaId!);
  const updateMutation = useUpdateAllianceUser(alianzaId!);
  const blockMutation = useBlockAllianceUser(alianzaId!);
  const unblockMutation = useUnblockAllianceUser(alianzaId!);
  const resetPasswordMutation = useResetAllianceUserPassword(alianzaId!);
  const resendInvitationMutation = useResendAllianceInvitation(alianzaId!);
  const revokeSessionsMutation = useRevokeAlliancePortalSessions(alianzaId!);
  const deleteMutation = useDeleteAllianceUser(alianzaId!);

  const handleExport = () => {
    if (!data?.users) return;
    
    const csvContent = [
      'Nombre,Email,Teléfono,Rol,Estado,Último Acceso,Creación',
      ...data.users.map(user => [
        user.name,
        user.email,
        user.phone,
        user.role === 'ALIANZA_ADMIN' ? 'Administrador' : 'Operador',
        user.state === 'ACTIVE' ? 'Activo' : user.state === 'BLOCKED' ? 'Bloqueado' : 'Pendiente',
        user.lastPortalLoginAt || 'Nunca',
        user.createdAt
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `usuarios-alianza-${alianzaId}-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  if (!alianzaId) return null;

  return (
    <div className="space-y-6">
      {/* Alliance Information Header */}
      <Card className="border-l-4 border-l-primary shadow-sm">
        <CardContent className="p-6">
          <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Building2 className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-foreground">{alianza.nombre}</h2>
                {alianza.descripcion && (
                  <p className="text-sm text-muted-foreground mt-1">{alianza.descripcion}</p>
                )}
              </div>
            </div>
            <Badge 
              variant={alianza.activo ? 'default' : 'destructive'} 
              className="text-sm px-3 py-1"
            >
              {alianza.activo ? '✓ Activa' : '✕ Inactiva'}
            </Badge>
          </div>

          <Separator className="my-4" />

          {/* Alliance Details Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
              <Mail className="h-5 w-5 text-primary mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Email</p>
                <p className="text-sm font-medium text-foreground truncate">{alianza.contacto.email}</p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
              <Phone className="h-5 w-5 text-primary mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Teléfono</p>
                <p className="text-sm font-medium text-foreground">{alianza.contacto.fono}</p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
              <MapPin className="h-5 w-5 text-primary mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Dirección</p>
                <p className="text-sm font-medium text-foreground">{alianza.direccion}</p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-lg bg-accent/10 hover:bg-accent/20 transition-colors border border-accent/20">
              <Percent className="h-5 w-5 text-accent mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Comisión Degravamen</p>
                <p className="text-sm font-bold text-accent">{alianza.comisionDegravamen}%</p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-lg bg-accent/10 hover:bg-accent/20 transition-colors border border-accent/20">
              <Percent className="h-5 w-5 text-accent mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Comisión Cesantía</p>
                <p className="text-sm font-bold text-accent">{alianza.comisionCesantia}%</p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
              <Calendar className="h-5 w-5 text-primary mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Vigencia</p>
                <p className="text-sm font-medium text-foreground">
                  {new Date(alianza.fechaInicio).toLocaleDateString('es-CL')} - {new Date(alianza.fechaTermino).toLocaleDateString('es-CL')}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Users Table */}
      <AllianceUsersTable
      users={data?.users || []}
      total={data?.total || 0}
      page={data?.page || 1}
      pageSize={data?.pageSize || 10}
      params={params}
      onParamsChange={setParams}
      onCreateUser={createMutation.mutate}
      onEditUser={(userId, data) => updateMutation.mutate({ userId, input: data })}
      onBlockUser={(userId, note) => blockMutation.mutate({ userId, note })}
      onUnblockUser={unblockMutation.mutate}
      onResetPassword={resetPasswordMutation.mutate}
      onResendInvitation={resendInvitationMutation.mutate}
      onRevokeSessions={revokeSessionsMutation.mutate}
      onDeleteUser={deleteMutation.mutate}
      onExport={handleExport}
      loading={isLoading}
      alianceName={alianceName}
    />
    </div>
  );
}