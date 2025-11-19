import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { 
  User, 
  Mail, 
  Phone, 
  Shield, 
  Calendar, 
  Clock,
  Key,
  ExternalLink
} from 'lucide-react';
import type { AllianceUser } from '../types/allianceUserTypes';
import { useAllianceUserAudit } from '../hooks/useAllianceUsers';

interface AllianceUserDetailsDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: AllianceUser;
}

export function AllianceUserDetailsDrawer({
  open,
  onOpenChange,
  user
}: AllianceUserDetailsDrawerProps) {
  const { data: auditEvents = [] } = useAllianceUserAudit(user.alianzaId, user.id);

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'No disponible';
    return format(new Date(dateString), "dd 'de' MMMM 'de' yyyy 'a las' HH:mm", { 
      locale: es 
    });
  };

  const formatDateShort = (dateString?: string) => {
    if (!dateString) return 'No disponible';
    return format(new Date(dateString), "dd/MM/yyyy HH:mm", { locale: es });
  };

  const getStateDisplay = (state: AllianceUser['state']) => {
    switch (state) {
      case 'ACTIVE':
        return <Badge variant="default" className="bg-green-100 text-green-800">Activo</Badge>;
      case 'BLOCKED':
        return <Badge variant="destructive">Bloqueado</Badge>;
      case 'PENDING':
        return <Badge variant="secondary">Pendiente activación</Badge>;
      default:
        return <Badge variant="outline">{state}</Badge>;
    }
  };

  const getRoleDisplay = (role: AllianceUser['role']) => {
    return role === 'ALIANZA_ADMIN' ? 'Administrador' : 'Operador';
  };

  const getEventTypeDisplay = (type: string) => {
    switch (type) {
      case 'USER_CREATED': return 'Usuario creado';
      case 'INVITATION_SENT': return 'Invitación enviada';
      case 'INVITATION_RESENT': return 'Invitación reenviada';
      case 'INVITATION_ACCEPTED': return 'Invitación aceptada';
      case 'BLOCK': return 'Usuario bloqueado';
      case 'UNBLOCK': return 'Usuario desbloqueado';
      case 'PASSWORD_RESET': return 'Contraseña reiniciada';
      case 'ROLE_CHANGED': return 'Rol cambiado';
      case 'SESSIONS_REVOKED': return 'Sesiones revocadas';
      case 'USER_DELETED': return 'Usuario eliminado';
      default: return type;
    }
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[90vh]">
        <DrawerHeader>
          <DrawerTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            {user.name}
          </DrawerTitle>
          <DrawerDescription>
            Detalles del usuario de alianza y historial de actividad
          </DrawerDescription>
        </DrawerHeader>

        <div className="px-4 pb-4 space-y-6 overflow-y-auto">
          {/* User Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-4 w-4" />
                Información del Usuario
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">Email:</span>
                    <span>{user.email}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Shield className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">Rol:</span>
                    <span>{getRoleDisplay(user.role)}</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-medium">Estado:</span>
                    {getStateDisplay(user.state)}
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <ExternalLink className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">Acceso:</span>
                    <span className="text-muted-foreground">Portal de Alianzas</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Access Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Información de Acceso
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2 text-sm">
                <div>
                  <span className="font-medium">Último acceso al Portal:</span>
                  <div className="text-muted-foreground mt-1">
                    {formatDate(user.lastPortalLoginAt)}
                  </div>
                </div>
                
                <Separator />
                
                <div>
                  <span className="font-medium">Contraseña cambiada:</span>
                  <div className="text-muted-foreground mt-1">
                    {formatDate(user.passwordLastChangedAt)}
                  </div>
                </div>

                <Separator />

                <div>
                  <span className="font-medium">Usuario creado:</span>
                  <div className="text-muted-foreground mt-1">
                    {formatDate(user.createdAt)}
                  </div>
                </div>
              </div>

              {user.invitation && (
                <div className="bg-muted/50 p-3 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Mail className="h-4 w-4" />
                    <span className="font-medium text-sm">Estado de Invitación</span>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Estado: <Badge variant="secondary">{user.invitation.status}</Badge>
                    <br />
                    Enviada: {formatDateShort(user.invitation.sentAt)}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Security Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-4 w-4" />
                Seguridad
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span>Autenticación de dos factores (2FA):</span>
                  <Badge variant="outline">No configurado</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span>Sesiones activas estimadas:</span>
                  <span className="text-muted-foreground">
                    {user.state === 'ACTIVE' ? 'Hasta 3 dispositivos' : 'Ninguna'}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Audit History */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Historial de Actividad
              </CardTitle>
            </CardHeader>
            <CardContent>
              {auditEvents.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  No hay actividad registrada.
                </p>
              ) : (
                <div className="space-y-3">
                  {auditEvents.slice(0, 10).map((event) => (
                    <div 
                      key={event.id} 
                      className="flex items-start gap-3 p-3 border rounded-lg"
                    >
                      <div className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium text-sm">
                            {getEventTypeDisplay(event.type)}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {formatDateShort(event.at)}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Ejecutado por: {event.actor.name} ({event.actor.role})
                        </div>
                        {event.note && (
                          <div className="text-xs text-muted-foreground mt-1 italic">
                            {event.note}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  
                  {auditEvents.length > 10 && (
                    <p className="text-xs text-muted-foreground text-center pt-2">
                      Mostrando los últimos 10 eventos
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </DrawerContent>
    </Drawer>
  );
}