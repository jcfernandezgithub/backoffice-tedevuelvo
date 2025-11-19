import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Trash2 } from 'lucide-react';

interface DeleteUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => Promise<void>;
  userName: string;
  loading?: boolean;
}

export function DeleteUserDialog({
  open,
  onOpenChange,
  onConfirm,
  userName,
  loading = false
}: DeleteUserDialogProps) {
  const [confirmText, setConfirmText] = useState('');
  const canDelete = confirmText === userName;

  const handleConfirm = async () => {
    if (canDelete) {
      await onConfirm();
      setConfirmText('');
      onOpenChange(false);
    }
  };

  const handleCancel = () => {
    setConfirmText('');
    onOpenChange(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-destructive">
            <Trash2 className="h-5 w-5" />
            Eliminar Usuario
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p>
                Esta acción <strong>no se puede deshacer</strong>. Se eliminará permanentemente 
                a <strong>{userName}</strong> y todo su historial de actividad.
              </p>
              
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
                <p className="text-sm text-destructive font-medium">
                  ⚠️ Advertencia
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Si este usuario tiene solicitudes activas o en proceso, se perderá 
                  la trazabilidad de quién las gestionó.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm-text">
                  Para confirmar, escribe el nombre completo del usuario:
                </Label>
                <Input
                  id="confirm-text"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder={userName}
                  className="font-mono"
                />
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            Cancelar
          </Button>
          <Button 
            variant="destructive" 
            onClick={handleConfirm}
            disabled={!canDelete || loading}
          >
            {loading ? 'Eliminando...' : 'Eliminar permanentemente'}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}