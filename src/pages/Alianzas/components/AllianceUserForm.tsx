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
import { Badge } from '@/components/ui/badge';
import { Loader2, UserPlus, Mail, Phone, Shield, UserCog } from 'lucide-react';
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
              <div className="flex items-center gap-2 pb-2">
                <div className="p-1.5 rounded-md bg-primary/10">
                  <UserPlus className="h-4 w-4 text-primary" />
                </div>
                <h3 className="text-sm font-semibold uppercase tracking-wide text-foreground">
                  Información Personal
                </h3>
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

            <Separator className="my-6" />

            {/* Datos de Contacto */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 pb-2">
                <div className="p-1.5 rounded-md bg-primary/10">
                  <Mail className="h-4 w-4 text-primary" />
                </div>
                <h3 className="text-sm font-semibold uppercase tracking-wide text-foreground">
                  Datos de Contacto
                </h3>
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

            <Separator className="my-6" />

            {/* Permisos y Acceso */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 pb-2">
                <div className="p-1.5 rounded-md bg-primary/10">
                  <Shield className="h-4 w-4 text-primary" />
                </div>
                <h3 className="text-sm font-semibold uppercase tracking-wide text-foreground">
                  Permisos y Acceso
                </h3>
              </div>

              <FormField
                control={form.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium">Rol en la alianza</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value} disabled={loading}>
                      <FormControl>
                        <SelectTrigger className="h-12 bg-background">
                          <SelectValue placeholder="Selecciona un rol" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="bg-background">
                        <SelectItem value="ALIANZA_ADMIN" className="cursor-pointer focus:bg-accent">
                          <div className="flex items-center gap-3 py-2">
                            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 shrink-0">
                              <UserCog className="h-4 w-4 text-primary" />
                            </div>
                            <div className="flex flex-col gap-0.5 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-sm text-foreground">Administrador</span>
                                <Badge variant="secondary" className="h-5 text-[10px] px-1.5 bg-primary/10 text-primary border-0">
                                  ADMIN
                                </Badge>
                              </div>
                              <span className="text-xs text-muted-foreground">
                                Gestión completa de solicitudes y usuarios
                              </span>
                            </div>
                          </div>
                        </SelectItem>
                        <SelectItem value="ALIANZA_OPERADOR" className="cursor-pointer focus:bg-accent">
                          <div className="flex items-center gap-3 py-2">
                            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted shrink-0">
                              <Shield className="h-4 w-4 text-muted-foreground" />
                            </div>
                            <div className="flex flex-col gap-0.5 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-sm text-foreground">Operador</span>
                                <Badge variant="outline" className="h-5 text-[10px] px-1.5">
                                  OPERADOR
                                </Badge>
                              </div>
                              <span className="text-xs text-muted-foreground">
                                Gestión de solicitudes únicamente
                              </span>
                            </div>
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

            <DialogFooter className="gap-2 sm:gap-0 pt-4">
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