import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usersClient } from '../services/usersClient';
import type { UserListParams, User } from '../types/userTypes';
import type { UserFormData, PasswordFormData } from '../schemas/userSchema';
import { useToast } from '@/hooks/use-toast';

const USERS_QUERY_KEY = 'users';

export function useUsers(params: UserListParams = {}) {
  return useQuery({
    queryKey: [USERS_QUERY_KEY, 'list', params],
    queryFn: () => usersClient.listUsers(params),
    staleTime: 30 * 1000, // 30 seconds
  });
}

export function useUserAudit(userId: string) {
  return useQuery({
    queryKey: [USERS_QUERY_KEY, 'audit', userId],
    queryFn: () => usersClient.getUserAudit(userId),
    enabled: !!userId,
  });
}

export function useCreateUser() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (data: UserFormData) => usersClient.createUser(data),
    onSuccess: (newUser) => {
      queryClient.invalidateQueries({ queryKey: [USERS_QUERY_KEY] });
      toast({
        title: 'Usuario creado',
        description: `${newUser.name} ha sido creado exitosamente.`
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error al crear usuario',
        description: error.message,
        variant: 'destructive'
      });
    }
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<UserFormData> }) =>
      usersClient.updateUser(id, data),
    onSuccess: (updatedUser) => {
      queryClient.invalidateQueries({ queryKey: [USERS_QUERY_KEY] });
      toast({
        title: 'Usuario actualizado',
        description: `${updatedUser.name} ha sido actualizado exitosamente.`
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error al actualizar usuario',
        description: error.message,
        variant: 'destructive'
      });
    }
  });
}

export function useBlockUser() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      usersClient.blockUser(id, reason),
    onSuccess: (user) => {
      queryClient.invalidateQueries({ queryKey: [USERS_QUERY_KEY] });
      toast({
        title: 'Usuario bloqueado',
        description: `${user.name} ha sido bloqueado exitosamente.`
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error al bloquear usuario',
        description: error.message,
        variant: 'destructive'
      });
    }
  });
}

export function useUnblockUser() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (id: string) => usersClient.unblockUser(id),
    onSuccess: (user) => {
      queryClient.invalidateQueries({ queryKey: [USERS_QUERY_KEY] });
      toast({
        title: 'Usuario desbloqueado',
        description: `${user.name} ha sido desbloqueado exitosamente.`
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error al desbloquear usuario',
        description: error.message,
        variant: 'destructive'
      });
    }
  });
}

export function useResetPassword() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ id, password }: { id: string; password?: string }) =>
      usersClient.resetPassword(id, password),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [USERS_QUERY_KEY] });
      toast({
        title: 'Contraseña actualizada',
        description: 'La contraseña ha sido actualizada exitosamente.'
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error al actualizar contraseña',
        description: error.message,
        variant: 'destructive'
      });
    }
  });
}

export function useDeleteUser() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (id: string) => usersClient.deleteUser(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [USERS_QUERY_KEY] });
      toast({
        title: 'Usuario eliminado',
        description: 'El usuario ha sido eliminado exitosamente.'
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error al eliminar usuario',
        description: error.message,
        variant: 'destructive'
      });
    }
  });
}

export function useResendInvitation() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (id: string) => usersClient.resendInvitation(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [USERS_QUERY_KEY] });
      toast({
        title: 'Invitación reenviada',
        description: 'La invitación ha sido reenviada exitosamente.'
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error al reenviar invitación',
        description: error.message,
        variant: 'destructive'
      });
    }
  });
}

export function useRevokeSessions() {
  const { toast } = useToast();

  return useMutation({
    mutationFn: (id: string) => usersClient.revokeSessions(id),
    onSuccess: () => {
      toast({
        title: 'Sesiones revocadas',
        description: 'Todas las sesiones activas han sido revocadas.'
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error al revocar sesiones',
        description: error.message,
        variant: 'destructive'
      });
    }
  });
}

export function useBulkAction() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ userIds, action }: { userIds: string[]; action: 'block' | 'unblock' }) =>
      usersClient.bulkAction(userIds, action),
    onSuccess: (_, { userIds, action }) => {
      queryClient.invalidateQueries({ queryKey: [USERS_QUERY_KEY] });
      const actionText = action === 'block' ? 'bloqueados' : 'desbloqueados';
      toast({
        title: 'Acción completada',
        description: `${userIds.length} usuarios han sido ${actionText}.`
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error en acción masiva',
        description: error.message,
        variant: 'destructive'
      });
    }
  });
}