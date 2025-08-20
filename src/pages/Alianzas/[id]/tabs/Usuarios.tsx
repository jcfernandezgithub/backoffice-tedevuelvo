import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { AllianceUsersTable } from '../../components/AllianceUsersTable';
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
} from '../../hooks/useAllianceUsers';
import type { AllianceUserListParams } from '../../types/allianceUserTypes';

export function UsuariosTab() {
  const { id: alianzaId } = useParams<{ id: string }>();
  const [params, setParams] = useState<AllianceUserListParams>({
    page: 1,
    pageSize: 10,
  });

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
      alianceName="Alianza" // This would come from alliance data
    />
  );
}