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
import { Loader2, UserPlus, Mail, Shield, UserCog, CheckCircle2, Key, RefreshCw, Copy } from 'lucide-react';
import { allianceUserSchema, type AllianceUserInput } from '../schemas/allianceUserSchema';
import type { AllianceUser } from '../types/allianceUserTypes';
import { generateSecurePassword } from '@/lib/passwordGenerator';
import { useToast } from '@/hooks/use-toast';

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
  const { toast } = useToast();
  
  const form = useForm<AllianceUserInput>({
    resolver: zodResolver(allianceUserSchema),
    defaultValues: {
      name: user?.name || '',
      rut: user?.rut || '',
      email: user?.email || '',
      password: isEditing ? '' : generateSecurePassword(),
      role: user?.role || 'ALIANZA_OPERADOR',
    },
  });

  const handleSubmit = (data: AllianceUserInput) => {
    // Remove password from data when editing
    const submitData = isEditing 
      ? { ...data, password: undefined }
      : data;
    onSubmit(submitData);
    if (!loading) {
      form.reset();
      onOpenChange(false);
    }
  };

  const handleRegeneratePassword = () => {
    const newPassword = generateSecurePassword();
    form.setValue('password', newPassword);
    toast({
      title: 'Contraseña regenerada',
      description: 'Se ha generado una nueva contraseña segura.',
    });
  };

  const handleCopyPassword = async () => {
    const password = form.getValues('password');
    try {
      await navigator.clipboard.writeText(password);
      toast({
        title: 'Contraseña copiada',
        description: 'La contraseña se copió al portapapeles.',
      });
    } catch (error) {
      toast({
        title: 'Error al copiar',
        description: 'No se pudo copiar la contraseña al portapapeles.',
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto">
        <DialogHeader className="pb-3 border-b">
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <UserPlus className="h-4 w-4 text-primary-foreground" />
            </div>
            {title || (isEditing ? 'Editar Usuario de Alianza' : 'Nuevo Usuario de Alianza')}
          </DialogTitle>
          <DialogDescription className="text-sm">
            {isEditing 
              ? 'Modifica los datos del usuario de la alianza.'
              : 'Completa la información para crear un nuevo usuario que accederá al Portal de Alianzas.'
            }
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 py-2">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Sección 1: Información Personal */}
              <Card className="border-l-4 border-l-primary">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-primary/10 flex items-center justify-center">
                      <UserPlus className="h-3.5 w-3.5 text-primary" />
                    </div>
                    Información Personal
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
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
                            className="font-medium h-10"
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
                          <div className="relative">
                            <Input 
                              placeholder="12.345.678-9" 
                              {...field}
                              disabled={loading}
                              className="font-medium h-10"
                              onChange={(e) => {
                                field.onChange(e);
                                // Trigger validation on change
                                form.trigger('rut');
                              }}
                            />
                            {field.value && !form.formState.errors.rut && field.value.length >= 11 && (
                              <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-green-500" />
                            )}
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>

              {/* Sección 2: Datos de Contacto */}
              <Card className="border-l-4 border-l-primary">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Mail className="h-3.5 w-3.5 text-primary" />
                    </div>
                    Datos de Contacto
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
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
                            className="font-medium h-10"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Password field - only shown when creating */}
                  {!isEditing && (
                    <FormField
                      control={form.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                            Contraseña *
                          </FormLabel>
                          <FormControl>
                            <div className="space-y-2">
                              <div className="relative">
                                <Input 
                                  type="text"
                                  placeholder="Contraseña generada automáticamente" 
                                  {...field}
                                  disabled={loading}
                                  className="font-medium h-10 font-mono text-sm pr-10"
                                />
                                <Key className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={handleRegeneratePassword}
                                  disabled={loading}
                                  className="flex-1 h-8 text-xs"
                                >
                                  <RefreshCw className="h-3 w-3 mr-1.5" />
                                  Regenerar
                                </Button>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={handleCopyPassword}
                                  disabled={loading}
                                  className="flex-1 h-8 text-xs"
                                >
                                  <Copy className="h-3 w-3 mr-1.5" />
                                  Copiar
                                </Button>
                              </div>
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </CardContent>
              </Card>

              {/* Sección 3: Permisos y Acceso */}
              <Card className="border-l-4 border-l-primary">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Shield className="h-3.5 w-3.5 text-primary" />
                    </div>
                    Permisos y Acceso
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
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
                            <SelectTrigger className="h-10">
                              <SelectValue placeholder="Selecciona un rol">
                                {field.value === 'ALIANZA_ADMIN' ? (
                                  <div className="flex items-center gap-2">
                                    <UserCog className="h-3.5 w-3.5" />
                                    <span className="font-medium text-sm">Administrador</span>
                                  </div>
                                ) : field.value === 'ALIANZA_OPERADOR' ? (
                                  <div className="flex items-center gap-2">
                                    <Shield className="h-3.5 w-3.5" />
                                    <span className="font-medium text-sm">Operador</span>
                                  </div>
                                ) : null}
                              </SelectValue>
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="ALIANZA_ADMIN" className="cursor-pointer focus:bg-primary/10">
                              <div className="flex items-center gap-2.5 py-1.5">
                                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 shrink-0">
                                  <UserCog className="h-3.5 w-3.5 text-primary" />
                                </div>
                                <div className="flex flex-col gap-0.5">
                                  <span className="font-semibold text-sm text-foreground">Administrador</span>
                                  <span className="text-xs text-muted-foreground">
                                    Gestión completa
                                  </span>
                                </div>
                              </div>
                            </SelectItem>
                            <SelectItem value="ALIANZA_OPERADOR" className="cursor-pointer focus:bg-muted">
                              <div className="flex items-center gap-2.5 py-1.5">
                                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted shrink-0">
                                  <Shield className="h-3.5 w-3.5 text-muted-foreground" />
                                </div>
                                <div className="flex flex-col gap-0.5">
                                  <span className="font-semibold text-sm text-foreground">Operador</span>
                                  <span className="text-xs text-muted-foreground">
                                    Solo solicitudes
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
                </CardContent>
              </Card>
            </div>

            {/* Alertas Informativas */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Alert className="border-primary/20 bg-primary/5">
                <Mail className="h-4 w-4 text-primary" />
                <AlertDescription className="text-xs">
                  <strong>Notificación:</strong> Se enviará correo de bienvenida automáticamente.
                </AlertDescription>
              </Alert>

              <Alert className="border-muted">
                <AlertDescription className="text-xs text-muted-foreground">
                  <strong>Acceso:</strong> Portal de Alianzas únicamente (no backoffice).
                </AlertDescription>
              </Alert>
            </div>

            <DialogFooter className="gap-2 sm:gap-0 pt-3 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={loading}
                className="h-10"
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={loading} className="h-10">
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