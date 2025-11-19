import { useState } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import {
  MoreHorizontal,
  Edit,
  Shield,
  ShieldCheck,
  Key,
  Mail,
  LogOut,
  Trash2,
  Eye
} from 'lucide-react';
import type { AllianceUser } from '../types/allianceUserTypes';
import { AllianceUserForm } from './AllianceUserForm';
import { BlockUserDialog } from './BlockUserDialog';
import { DisableUserDialog } from './DisableUserDialog';
import { AllianceUserDetailsDrawer } from './AllianceUserDetailsDrawer';

interface AllianceUserRowActionsProps {
  user: AllianceUser;
  onEdit: (userId: string, data: any) => void;
  onBlock: (userId: string, note?: string) => void;
  onUnblock: (userId: string) => void;
  onResetPassword: (userId: string) => void;
  onResendInvitation: (userId: string) => void;
  onRevokeSessions: (userId: string) => void;
  onDisable: (userId: string) => Promise<void>;
  onViewDetails: (userId: string) => void;
  loading?: boolean;
}

export function AllianceUserRowActions({
  user,
  onEdit,
  onBlock,
  onUnblock,
  onResetPassword,
  onResendInvitation,
  onRevokeSessions,
  onDisable,
  onViewDetails,
  loading = false
}: AllianceUserRowActionsProps) {
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showBlockDialog, setShowBlockDialog] = useState(false);
  const [showDisableDialog, setShowDisableDialog] = useState(false);
  const [showDetailsDrawer, setShowDetailsDrawer] = useState(false);
  const [isDisabling, setIsDisabling] = useState(false);

  const canBlock = user.state === 'ACTIVE';
  const canUnblock = user.state === 'BLOCKED';
  const canResendInvitation = user.state === 'PENDING';
  const canDisable = user.state === 'ACTIVE' && user.role !== 'ALIANZA_ADMIN';

  const handleEdit = (data: any) => {
    onEdit(user.id, data);
    setShowEditDialog(false);
  };

  const handleBlock = (note?: string) => {
    onBlock(user.id, note);
    setShowBlockDialog(false);
  };

  const handleDisable = async () => {
    setIsDisabling(true);
    try {
      await onDisable(user.id);
    } finally {
      setIsDisabling(false);
    }
  };

  const handleViewDetails = () => {
    onViewDetails(user.id);
    setShowDetailsDrawer(true);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            disabled={loading}
            aria-label={`Acciones para ${user.name}`}
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem onClick={handleViewDetails}>
              <Eye className="mr-2 h-4 w-4" />
              Ver detalles
            </DropdownMenuItem>
            
            <DropdownMenuItem onClick={() => setShowEditDialog(true)}>
              <Edit className="mr-2 h-4 w-4" />
              Editar usuario
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            {canBlock && (
              <DropdownMenuItem onClick={() => setShowBlockDialog(true)}>
                <Shield className="mr-2 h-4 w-4" />
                Bloquear usuario
              </DropdownMenuItem>
            )}

            {canUnblock && (
              <DropdownMenuItem onClick={() => onUnblock(user.id)}>
                <ShieldCheck className="mr-2 h-4 w-4" />
                Desbloquear usuario
              </DropdownMenuItem>
            )}

            <DropdownMenuItem onClick={() => onResetPassword(user.id)}>
              <Key className="mr-2 h-4 w-4" />
              Reiniciar contraseña
            </DropdownMenuItem>

            {canResendInvitation && (
              <DropdownMenuItem onClick={() => onResendInvitation(user.id)}>
                <Mail className="mr-2 h-4 w-4" />
                Reenviar invitación
              </DropdownMenuItem>
            )}

            <DropdownMenuItem onClick={() => onRevokeSessions(user.id)}>
              <LogOut className="mr-2 h-4 w-4" />
              Revocar sesiones
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            {canDisable && (
              <DropdownMenuItem 
                onClick={() => setShowDisableDialog(true)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Deshabilitar usuario
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

      <AllianceUserForm
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        onSubmit={handleEdit}
        user={user}
        title="Editar Usuario"
        loading={loading}
      />

      <BlockUserDialog
        open={showBlockDialog}
        onOpenChange={setShowBlockDialog}
        onConfirm={handleBlock}
        userName={user.name}
      />

      <DisableUserDialog
        open={showDisableDialog}
        onOpenChange={setShowDisableDialog}
        onConfirm={handleDisable}
        userName={user.name}
        loading={isDisabling}
      />

      <AllianceUserDetailsDrawer
        open={showDetailsDrawer}
        onOpenChange={setShowDetailsDrawer}
        user={user}
      />
    </>
  );
}