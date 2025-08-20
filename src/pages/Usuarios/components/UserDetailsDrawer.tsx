import { Shield, ShieldCheck, Clock, Activity } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import type { User } from '../types/userTypes';
import { useUserAudit } from '../hooks/useUsers';

interface UserDetailsDrawerProps {
  user: User | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const roleLabels = {
  ADMIN: 'Administrador',
  CONSULTANT: 'Consultor'
};

const stateLabels = {
  ACTIVE: 'Activo',
  BLOCKED: 'Bloqueado',
  PENDING: 'Pendiente'
};

const stateVariants = {
  ACTIVE: 'default' as const,
  BLOCKED: 'destructive' as const,
  PENDING: 'secondary' as const
};

const eventTypeLabels = {
  LOGIN: 'Inicio de sesión',
  LOGOUT: 'Cierre de sesión',
  BLOCK: 'Usuario bloqueado',
  UNBLOCK: 'Usuario desbloqueado',
  PASSWORD_RESET: 'Contraseña cambiada',
  ROLE_CHANGED: 'Rol modificado',
  INVITATION_SENT: 'Invitación enviada',
  INVITATION_RESENT: 'Invitación reenviada',
  INVITATION_ACCEPTED: 'Invitación aceptada',
  SESSIONS_REVOKED: 'Sesiones revocadas',
  USER_CREATED: 'Usuario creado',
  USER_DELETED: 'Usuario eliminado'
};

export function UserDetailsDrawer({ user, open, onOpenChange }: UserDetailsDrawerProps) {
  const { data: auditEvents, isLoading: auditLoading } = useUserAudit(user?.id || '');

  if (!user) return null;

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('es-CL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const formatDateTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('es-CL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Detalles del Usuario</SheetTitle>
        </SheetHeader>

        <div className="space-y-6 py-6">
          {/* Basic Info */}
          <div className="space-y-4">
            <div>
              <h3 className="font-medium text-lg">{user.name}</h3>
              <p className="text-muted-foreground">{user.email}</p>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Teléfono</p>
                <p className="font-medium">{user.phone}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Perfil</p>
                <Badge variant="outline">{roleLabels[user.role]}</Badge>
              </div>
              <div>
                <p className="text-muted-foreground">Estado</p>
                <Badge variant={stateVariants[user.state]}>
                  {stateLabels[user.state]}
                </Badge>
              </div>
              <div>
                <p className="text-muted-foreground">Creado</p>
                <p className="font-medium">{formatDate(user.createdAt)}</p>
              </div>
            </div>

            <div>
              <p className="text-muted-foreground text-sm">Último acceso</p>
              <p className="font-medium">
                {user.lastLoginAt ? formatDateTime(user.lastLoginAt) : 'Nunca'}
              </p>
            </div>
          </div>

          <Separator />

          {/* Security */}
          <div className="space-y-4">
            <h4 className="font-medium flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Seguridad
            </h4>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Autenticación 2FA</span>
                </div>
                <Badge variant={user.security?.mfaEnabled ? 'default' : 'secondary'}>
                  {user.security?.mfaEnabled ? 'Activado' : 'Desactivado'}
                </Badge>
              </div>

              {user.security?.passwordLastChangedAt && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">Contraseña actualizada</span>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {formatDate(user.security.passwordLastChangedAt)}
                  </span>
                </div>
              )}

              {user.invitation && (
                <div className="p-3 bg-muted rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <Activity className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Estado de invitación</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <Badge variant="secondary">{user.invitation.status}</Badge>
                    {user.invitation.sentAt && (
                      <span className="text-xs text-muted-foreground">
                        {formatDateTime(user.invitation.sentAt)}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* Audit History */}
          <div className="space-y-4">
            <h4 className="font-medium flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Historial de Actividad
            </h4>

            <div className="space-y-3 max-h-60 overflow-y-auto">
              {auditLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                ))
              ) : auditEvents && auditEvents.length > 0 ? (
                auditEvents.slice(0, 10).map((event) => (
                  <div key={event.id} className="border-l-2 border-muted pl-3 pb-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium">
                        {eventTypeLabels[event.type] || event.type}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatDateTime(event.at)}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Por: {event.actor.name}
                    </div>
                    {event.note && (
                      <div className="text-xs text-muted-foreground mt-1">
                        {event.note}
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">
                  No hay actividad registrada
                </p>
              )}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}