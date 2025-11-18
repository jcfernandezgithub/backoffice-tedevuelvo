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
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Loader2, UserPlus, Mail, Phone, Shield } from 'lucide-react';
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
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <div className="p-2 rounded-lg bg-primary/10">
              <UserPlus className="h-5 w-5 text-primary" />
            </div>
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
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            {/* Información Personal */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <UserPlus className="h-4 w-4" />
                <span>Información Personal</span>
              </div>
              
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium">Nombre completo</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Ej: Juan Pérez García" 
                        {...field}
                        disabled={loading}
                        className="h-11"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <Separator />

            {/* Datos de Contacto */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Mail className="h-4 w-4" />
                <span>Datos de Contacto</span>
              </div>

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium">Email</FormLabel>
                    <FormControl>
                      <Input 
                        type="email"
                        placeholder="usuario@alianza.com" 
                        {...field}
                        disabled={loading}
                        className="h-11"
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
                    <FormLabel className="text-sm font-medium">Teléfono</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input 
                          placeholder="+56 9 1234 5678" 
                          {...field}
                          disabled={loading}
                          className="h-11 pl-10"
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <Separator />

            {/* Permisos y Acceso */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Shield className="h-4 w-4" />
                <span>Permisos y Acceso</span>
              </div>

              <FormField
                control={form.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium">Rol en la alianza</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value} disabled={loading}>
                      <FormControl>
                        <SelectTrigger className="h-11">
                          <SelectValue placeholder="Selecciona un rol" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="ALIANZA_ADMIN">
                          <div className="flex flex-col py-1">
                            <span className="font-medium">Administrador</span>
                            <span className="text-xs text-muted-foreground">
                              Gestión completa de solicitudes y usuarios
                            </span>
                          </div>
                        </SelectItem>
                        <SelectItem value="ALIANZA_OPERADOR">
                          <div className="flex flex-col py-1">
                            <span className="font-medium">Operador</span>
                            <span className="text-xs text-muted-foreground">
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

              <Alert className="border-primary/20 bg-primary/5">
                <Mail className="h-4 w-4 text-primary" />
                <AlertDescription className="text-sm">
                  El usuario recibirá un correo de bienvenida con instrucciones para acceder al Portal de Alianzas.
                </AlertDescription>
              </Alert>

              <Alert>
                <AlertDescription className="text-xs text-muted-foreground">
                  <strong>Acceso:</strong> Portal de Alianzas únicamente. Los usuarios de alianza no pueden acceder al backoffice.
                </AlertDescription>
              </Alert>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={loading}
                className="h-11"
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={loading} className="h-11">
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