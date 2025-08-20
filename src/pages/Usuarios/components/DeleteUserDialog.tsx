import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useDeleteUser } from '../hooks/useUsers';
import type { User } from '../types/userTypes';

interface DeleteUserDialogProps {
  user: User;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DeleteUserDialog({ user, open, onOpenChange }: DeleteUserDialogProps) {
  const [confirmationText, setConfirmationText] = useState('');
  const deleteUser = useDeleteUser();

  const isConfirmed = confirmationText === user.name;

  const handleDelete = async () => {
    if (!isConfirmed) return;
    
    try {
      await deleteUser.mutateAsync(user.id);
      onOpenChange(false);
      setConfirmationText('');
    } catch (error) {
      // Error handling is done in the hook
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setConfirmationText('');
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Eliminar Usuario</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="p-4 bg-muted rounded-lg">
            <p className="text-sm font-medium">Usuario: {user.name}</p>
            <p className="text-sm text-muted-foreground">{user.email}</p>
          </div>

          <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
            <p className="text-sm text-destructive font-medium mb-2">
              ⚠️ Esta acción no se puede deshacer
            </p>
            <p className="text-sm text-destructive">
              Se eliminará permanentemente el usuario y todo su historial asociado.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmation">
              Para confirmar, escribe el nombre del usuario:
            </Label>
            <Input
              id="confirmation"
              value={confirmationText}
              onChange={(e) => setConfirmationText(e.target.value)}
              placeholder={user.name}
              className="font-mono"
            />
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => handleOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button 
              variant="destructive"
              disabled={!isConfirmed || deleteUser.isPending}
              onClick={handleDelete}
            >
              Eliminar Usuario
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}