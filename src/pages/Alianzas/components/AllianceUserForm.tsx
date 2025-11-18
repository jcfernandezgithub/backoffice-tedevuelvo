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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, UserPlus, Mail, Phone, Shield, UserCog, CreditCard } from 'lucide-react';
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
      rut: user?.rut || '',
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
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="pb-4 border-b">
          <DialogTitle className="text-2xl font-bold flex items-center gap-2">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <UserPlus className="h-5 w-5 text-primary-foreground" />
            </div>
            {title || (isEditing ? 'Editar Usuario de Alianza' : 'Nuevo Usuario de Alianza')}
          </DialogTitle>
          <DialogDescription className="text-base">
            {isEditing 
              ? 'Modifica los datos del usuario de la alianza.'
              : 'Completa la información para crear un nuevo usuario que accederá al Portal de Alianzas.'
            }
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6 py-4">
            {/* Sección 1: Información Personal */}
            <Card className="border-l-4 border-l-primary">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                    <UserPlus className="h-4 w-4 text-primary" />
                  </div>
                  Información Personal
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                          Nombre Completo *
                        </FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Ej: Juan Pérez García" 
                            {...field}
                            disabled={loading}
                            className="font-medium"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="rut"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                          RUT *
                        </FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="12.345.678-9" 
                            {...field}
                            disabled={loading}
                            className="font-medium"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Sección 2: Datos de Contacto */}
            <Card className="border-l-4 border-l-primary">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Mail className="h-4 w-4 text-primary" />
                  </div>
                  Datos de Contacto
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                          Email *
                        </FormLabel>
                        <FormControl>
                          <Input 
                            type="email"
                            placeholder="usuario@alianza.com" 
                            {...field}
                            disabled={loading}
                            className="font-medium"
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
                        <FormLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                          Teléfono *
                        </FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="+56 9 1234 5678" 
                            {...field}
                            disabled={loading}
                            className="font-medium"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Sección 3: Permisos y Acceso */}
            <Card className="border-l-4 border-l-primary">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Shield className="h-4 w-4 text-primary" />
                  </div>
                  Permisos y Acceso
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        Rol en la Alianza *
                      </FormLabel>
                      <Select onValueChange={field.onChange} value={field.value} disabled={loading}>
                        <FormControl>
                          <SelectTrigger className="h-auto min-h-[44px]">
                            <SelectValue placeholder="Selecciona un rol">
                              {field.value === 'ALIANZA_ADMIN' ? (
                                <div className="flex items-center gap-2 py-1">
                                  <UserCog className="h-4 w-4" />
                                  <span className="font-medium">Administrador</span>
                                </div>
                              ) : field.value === 'ALIANZA_OPERADOR' ? (
                                <div className="flex items-center gap-2 py-1">
                                  <Shield className="h-4 w-4" />
                                  <span className="font-medium">Operador</span>
                                </div>
                              ) : null}
                            </SelectValue>
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="ALIANZA_ADMIN" className="cursor-pointer">
                            <div className="flex items-center gap-3 py-2">
                              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 shrink-0">
                                <UserCog className="h-4 w-4 text-primary" />
                              </div>
                              <div className="flex flex-col gap-0.5 flex-1">
                                <span className="font-semibold text-sm">Administrador</span>
                                <span className="text-xs text-muted-foreground">
                                  Gestión completa de solicitudes y usuarios
                                </span>
                              </div>
                            </div>
                          </SelectItem>
                          <SelectItem value="ALIANZA_OPERADOR" className="cursor-pointer">
                            <div className="flex items-center gap-3 py-2">
                              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted shrink-0">
                                <Shield className="h-4 w-4 text-muted-foreground" />
                              </div>
                              <div className="flex flex-col gap-0.5 flex-1">
                                <span className="font-semibold text-sm">Operador</span>
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
                    <strong>Notificación automática:</strong> El usuario recibirá un correo de bienvenida con instrucciones para acceder al Portal de Alianzas.
                  </AlertDescription>
                </Alert>

                <Alert className="border-muted">
                  <AlertDescription className="text-xs text-muted-foreground">
                    <strong>Nota:</strong> Los usuarios de alianza solo pueden acceder al Portal de Alianzas. No tienen permisos para acceder al backoffice administrativo.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>

            <DialogFooter className="gap-2 sm:gap-0 pt-4 border-t">
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
                {isEditing ? 'Guardar Cambios' : 'Crear Usuario'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}