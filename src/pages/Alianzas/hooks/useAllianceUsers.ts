import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { allianceUsersClient } from '../services/allianceUsersClient';
import type { AllianceUserListParams } from '../types/allianceUserTypes';
import type { AllianceUserInput } from '../schemas/allianceUserSchema';
import { useToast } from '@/hooks/use-toast';

export function useAllianceUsers(alianzaId: string, params: AllianceUserListParams = {}) {
  return useQuery({
    queryKey: ['allianceUsers', alianzaId, params],
    queryFn: () => allianceUsersClient.listAllianceUsers(alianzaId, params),
    enabled: !!alianzaId,
  });
}

export function useAllianceUserCount(alianzaId: string) {
  return useQuery({
    queryKey: ['allianceUserCount', alianzaId],
    queryFn: () => allianceUsersClient.countAllianceUsers(alianzaId),
    enabled: !!alianzaId,
  });
}

export function useCreateAllianceUser(alianzaId: string) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (input: AllianceUserInput) => 
      allianceUsersClient.createAllianceUser(alianzaId, input),
    onSuccess: (user) => {
      queryClient.invalidateQueries({ queryKey: ['allianceUsers', alianzaId] });
      queryClient.invalidateQueries({ queryKey: ['allianceUserCount', alianzaId] });
      toast({
        title: 'Usuario creado',
        description: user.state === 'PENDING' 
          ? `Se envió invitación a ${user.email}` 
          : `Usuario ${user.name} creado exitosamente`,
      });
    },
    onError: (error) => {
      toast({
        title: 'Error al crear usuario',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useUpdateAllianceUser(alianzaId: string) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ userId, input }: { userId: string; input: Partial<AllianceUserInput> }) =>
      allianceUsersClient.updateAllianceUser(alianzaId, userId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allianceUsers', alianzaId] });
      toast({
        title: 'Usuario actualizado',
        description: 'Los cambios se guardaron exitosamente',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error al actualizar usuario',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useBlockAllianceUser(alianzaId: string) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ userId, note }: { userId: string; note?: string }) =>
      allianceUsersClient.blockAllianceUser(alianzaId, userId, note),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allianceUsers', alianzaId] });
      toast({
        title: 'Usuario bloqueado',
        description: 'El usuario ha sido bloqueado exitosamente',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error al bloquear usuario',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useUnblockAllianceUser(alianzaId: string) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (userId: string) =>
      allianceUsersClient.unblockAllianceUser(alianzaId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allianceUsers', alianzaId] });
      toast({
        title: 'Usuario desbloqueado',
        description: 'El usuario ha sido desbloqueado exitosamente',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error al desbloquear usuario',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useResetAllianceUserPassword(alianzaId: string) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (userId: string) =>
      allianceUsersClient.resetAllianceUserPassword(alianzaId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allianceUsers', alianzaId] });
      toast({
        title: 'Contraseña reiniciada',
        description: 'Se envió un email con la nueva contraseña temporal',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error al reiniciar contraseña',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useResendAllianceInvitation(alianzaId: string) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (userId: string) =>
      allianceUsersClient.resendAllianceInvitation(alianzaId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allianceUsers', alianzaId] });
      toast({
        title: 'Invitación reenviada',
        description: 'Se reenvió la invitación al Portal de Alianzas',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error al reenviar invitación',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useRevokeAlliancePortalSessions(alianzaId: string) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (userId: string) =>
      allianceUsersClient.revokeAlliancePortalSessions(alianzaId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allianceUsers', alianzaId] });
      toast({
        title: 'Sesiones revocadas',
        description: 'Se cerraron todas las sesiones activas en el Portal',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error al revocar sesiones',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useDeleteAllianceUser(alianzaId: string) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (userId: string) =>
      allianceUsersClient.deleteAllianceUser(alianzaId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allianceUsers', alianzaId] });
      queryClient.invalidateQueries({ queryKey: ['allianceUserCount', alianzaId] });
      toast({
        title: 'Usuario eliminado',
        description: 'El usuario ha sido eliminado permanentemente',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error al eliminar usuario',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export const useDisableAllianceUser = (alianzaId: string) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (userId: string) => 
      allianceUsersClient.deleteAllianceUser(alianzaId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allianceUsers', alianzaId] });
      queryClient.invalidateQueries({ queryKey: ['allianceUserCount', alianzaId] });
      toast({
        title: 'Usuario deshabilitado',
        description: 'El usuario ha sido deshabilitado exitosamente',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error al deshabilitar usuario',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
};

export function useAllianceUserAudit(alianzaId: string, userId: string) {
  return useQuery({
    queryKey: ['allianceUserAudit', alianzaId, userId],
    queryFn: () => allianceUsersClient.getAllianceUserAudit(alianzaId, userId),
    enabled: !!alianzaId && !!userId,
  });
}