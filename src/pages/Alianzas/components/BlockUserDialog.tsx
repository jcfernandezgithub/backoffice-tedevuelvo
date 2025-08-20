import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Shield } from 'lucide-react';
import { blockUserSchema, type BlockUserInput } from '../schemas/allianceUserSchema';

interface BlockUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (note?: string) => void;
  userName: string;
}

export function BlockUserDialog({
  open,
  onOpenChange,
  onConfirm,
  userName
}: BlockUserDialogProps) {
  const form = useForm<BlockUserInput>({
    resolver: zodResolver(blockUserSchema),
    defaultValues: {
      reason: '',
    },
  });

  const handleSubmit = (data: BlockUserInput) => {
    onConfirm(data.reason || undefined);
    form.reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-amber-500" />
            Bloquear Usuario
          </DialogTitle>
          <DialogDescription>
            ¿Estás seguro que deseas bloquear a <strong>{userName}</strong>?
            <br />
            Este usuario no podrá acceder al Portal de Alianzas hasta ser desbloqueado.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Motivo del bloqueo (opcional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Ej: Violación de políticas de uso, solicitud del usuario, etc."
                      className="resize-none"
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" variant="destructive">
                Bloquear usuario
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}