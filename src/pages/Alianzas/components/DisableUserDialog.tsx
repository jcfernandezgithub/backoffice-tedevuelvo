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
import { UserX } from 'lucide-react';

interface DisableUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => Promise<void>;
  userName: string;
  loading?: boolean;
}

export function DisableUserDialog({
  open,
  onOpenChange,
  onConfirm,
  userName,
  loading = false
}: DisableUserDialogProps) {
  const [confirmText, setConfirmText] = useState('');
  const canDisable = confirmText === userName;

  const handleConfirm = async () => {
    if (canDisable) {
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
            <UserX className="h-5 w-5" />
            Deshabilitar Usuario
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p>
                Esta acción deshabilitará a <strong>{userName}</strong> y ya no podrá 
                acceder al sistema hasta que sea rehabilitado.
              </p>
              
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
                <p className="text-sm text-destructive font-medium">
                  ⚠️ Advertencia
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  El usuario no podrá iniciar sesión ni realizar acciones en el portal 
                  de alianzas mientras esté deshabilitado.
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
            disabled={!canDisable || loading}
          >
            {loading ? 'Deshabilitando...' : 'Deshabilitar usuario'}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
