import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { blockUserSchema, type BlockUserFormData } from '../schemas/userSchema';
import { useBlockUser } from '../hooks/useUsers';
import type { User } from '../types/userTypes';

interface BlockUserFormProps {
  user: User;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BlockUserForm({ user, open, onOpenChange }: BlockUserFormProps) {
  const blockUser = useBlockUser();

  const form = useForm<BlockUserFormData>({
    resolver: zodResolver(blockUserSchema),
    defaultValues: {
      reason: ''
    }
  });

  const onSubmit = async (data: BlockUserFormData) => {
    try {
      await blockUser.mutateAsync({ id: user.id, reason: data.reason });
      onOpenChange(false);
      form.reset();
    } catch (error) {
      // Error handling is done in the hook
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      form.reset();
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Bloquear Usuario</DialogTitle>
        </DialogHeader>

        <div className="mb-4 p-4 bg-muted rounded-lg">
          <p className="text-sm font-medium">Usuario: {user.name}</p>
          <p className="text-sm text-muted-foreground">{user.email}</p>
        </div>

        <div className="mb-4 p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
          <p className="text-sm text-destructive">
            ⚠️ El usuario será bloqueado inmediatamente y no podrá acceder al sistema.
          </p>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Motivo del bloqueo (opcional)</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Describe el motivo del bloqueo..."
                      className="min-h-[80px]"
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end space-x-2 pt-4">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => handleOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button 
                type="submit" 
                variant="destructive"
                disabled={blockUser.isPending}
              >
                Bloquear Usuario
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}