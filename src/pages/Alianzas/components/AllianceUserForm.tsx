import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle,
  DialogFooter 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { 
  Form, 
  FormControl, 
  FormField, 
  FormItem, 
  FormLabel, 
  FormMessage 
} from '@/components/ui/form';
import { Loader2, UserPlus, Mail } from 'lucide-react';
import { allianceUserSchema, type AllianceUserInput } from '../schemas/allianceUserSchema';
import type { AllianceUser } from '../types/allianceUserTypes';

interface AllianceUserFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: AllianceUserInput) => void;
  loading?: boolean;
  user?: AllianceUser;
  title?: string;
}

export function AllianceUserForm({
  open,
  onOpenChange,
  onSubmit,
  loading = false,
  user,
  title
}: AllianceUserFormProps) {
  const isEditing = !!user;
  
  const form = useForm<AllianceUserInput>({
    resolver: zodResolver(allianceUserSchema),
    defaultValues: {
      name: user?.name || '',
      email: user?.email || '',
      phone: user?.phone || '',
      role: user?.role || 'ALIANZA_OPERADOR',
      sendInvitation: !isEditing,
    },
  });

  const handleSubmit = (data: AllianceUserInput) => {
    onSubmit(data);
    if (!loading) {
      form.reset();
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            {title || (isEditing ? 'Editar Usuario' : 'Nuevo Usuario de Alianza')}
          </DialogTitle>
          <DialogDescription>
            {isEditing 
              ? 'Modifica los datos del usuario de la alianza.'
              : 'Completa los datos para crear un nuevo usuario que accederá al Portal de Alianzas.'
            }
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre completo</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Ej: Juan Pérez García" 
                      {...field}
                      disabled={loading}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input 
                      type="email"
                      placeholder="usuario@alianza.com" 
                      {...field}
                      disabled={loading}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Teléfono</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="+56 9 1234 5678" 
                      {...field}
                      disabled={loading}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Rol en la alianza</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value} disabled={loading}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona un rol" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="ALIANZA_ADMIN">
                        <div className="flex flex-col">
                          <span className="font-medium">Administrador</span>
                          <span className="text-sm text-muted-foreground">
                            Gestión completa de solicitudes y usuarios
                          </span>
                        </div>
                      </SelectItem>
                      <SelectItem value="ALIANZA_OPERADOR">
                        <div className="flex flex-col">
                          <span className="font-medium">Operador</span>
                          <span className="text-sm text-muted-foreground">
                            Gestión de solicitudes únicamente
                          </span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {!isEditing && (
              <FormField
                control={form.control}
                name="sendInvitation"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        disabled={loading}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel className="flex items-center gap-2">
                        <Mail className="h-4 w-4" />
                        Enviar invitación por correo
                      </FormLabel>
                      <p className="text-sm text-muted-foreground">
                        El usuario recibirá un email para activar su cuenta en el Portal de Alianzas.
                        Si no está marcado, el usuario se creará como activo.
                      </p>
                    </div>
                  </FormItem>
                )}
              />
            )}

            <div className="bg-muted/50 p-3 rounded-lg">
              <p className="text-sm text-muted-foreground">
                <strong>Acceso:</strong> Portal de Alianzas únicamente
                <br />
                Los usuarios de alianza no pueden acceder al backoffice.
              </p>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={loading}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isEditing ? 'Guardar cambios' : 'Crear usuario'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}