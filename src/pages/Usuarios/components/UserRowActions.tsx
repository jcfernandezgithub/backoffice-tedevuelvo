import { useState } from 'react';
import { 
  Edit, 
  Lock, 
  Unlock, 
  Key, 
  Trash2, 
  LogOut, 
  Mail, 
  MoreHorizontal 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { User } from '../types/userTypes';
import { UserForm } from './UserForm';
import { PasswordForm } from './PasswordForm';
import { BlockUserForm } from './BlockUserForm';
import { DeleteUserDialog } from './DeleteUserDialog';
import { 
  useBlockUser, 
  useUnblockUser, 
  useResendInvitation, 
  useRevokeSessions 
} from '../hooks/useUsers';

interface UserRowActionsProps {
  user: User;
}

export function UserRowActions({ user }: UserRowActionsProps) {
  const [showEditForm, setShowEditForm] = useState(false);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [showBlockForm, setShowBlockForm] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const blockUser = useBlockUser();
  const unblockUser = useUnblockUser();
  const resendInvitation = useResendInvitation();
  const revokeSessions = useRevokeSessions();

  const handleBlock = () => {
    if (user.state === 'ACTIVE') {
      setShowBlockForm(true);
    } else {
      unblockUser.mutate(user.id);
    }
  };

  const handleResendInvitation = () => {
    resendInvitation.mutate(user.id);
  };

  const handleRevokeSessions = () => {
    revokeSessions.mutate(user.id);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            aria-label={`Acciones para ${user.name}`}
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={() => setShowEditForm(true)}>
            <Edit className="h-4 w-4 mr-2" />
            Editar
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem onClick={handleBlock}>
            {user.state === 'ACTIVE' ? (
              <>
                <Lock className="h-4 w-4 mr-2" />
                Bloquear
              </>
            ) : (
              <>
                <Unlock className="h-4 w-4 mr-2" />
                Desbloquear
              </>
            )}
          </DropdownMenuItem>

          <DropdownMenuItem onClick={() => setShowPasswordForm(true)}>
            <Key className="h-4 w-4 mr-2" />
            Cambiar contraseña
          </DropdownMenuItem>

          <DropdownMenuItem onClick={handleRevokeSessions}>
            <LogOut className="h-4 w-4 mr-2" />
            Revocar sesiones
          </DropdownMenuItem>

          {user.state === 'PENDING' && (
            <DropdownMenuItem onClick={handleResendInvitation}>
              <Mail className="h-4 w-4 mr-2" />
              Reenviar invitación
            </DropdownMenuItem>
          )}

          <DropdownMenuSeparator />

          <DropdownMenuItem 
            onClick={() => setShowDeleteDialog(true)}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Eliminar
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <UserForm
        user={user}
        open={showEditForm}
        onOpenChange={setShowEditForm}
      />

      <PasswordForm
        user={user}
        open={showPasswordForm}
        onOpenChange={setShowPasswordForm}
      />

      <BlockUserForm
        user={user}
        open={showBlockForm}
        onOpenChange={setShowBlockForm}
      />

      <DeleteUserDialog
        user={user}
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
      />
    </>
  );
}