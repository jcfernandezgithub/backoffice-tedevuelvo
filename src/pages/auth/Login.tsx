import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/state/AuthContext'
import { useNavigate } from 'react-router-dom'
import { useToast } from '@/hooks/use-toast'
import { Mail, Lock, ArrowRight } from 'lucide-react'
import logoTedevuelvo from '@/assets/logo-tedevuelvo.png'

const schema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Mínimo 6 caracteres'),
})

type FormValues = z.infer<typeof schema>

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const { toast } = useToast()

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormValues>({ resolver: zodResolver(schema) })

  const getDefaultRoute = (email: string): string => {
    if (email === 'admin@tedevuelvo.cl') return '/operacion'
    if (email === 'admin@callcenter.cl') return '/gestion-callcenter'
    return '/dashboard'
  }

  const onSubmit = async (values: FormValues) => {
    try {
      await login(values.email, values.password)
      toast({ title: 'Bienvenido', description: 'Ingreso exitoso' })
      const targetRoute = getDefaultRoute(values.email)
      navigate(targetRoute, { replace: true })
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    }
  }

  return (
    <main className="min-h-screen flex">
      {/* Panel izquierdo - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary via-primary/90 to-accent relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2260%22%20height%3D%2260%22%20viewBox%3D%220%200%2060%2060%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cg%20fill%3D%22none%22%20fill-rule%3D%22evenodd%22%3E%3Cg%20fill%3D%22%23ffffff%22%20fill-opacity%3D%220.05%22%3E%3Cpath%20d%3D%22M36%2034v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6%2034v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6%204V0H4v4H0v2h4v4h2V6h4V4H6z%22%2F%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fsvg%3E')] opacity-50" />
        
        <div className="relative z-10 flex flex-col justify-center px-12 xl:px-20 text-primary-foreground">
          <div className="mb-8 animate-fade-in">
            <img 
              src={logoTedevuelvo} 
              alt="Te devuelvo" 
              className="h-20 w-auto mb-6 brightness-0 invert"
            />
            <p className="text-xl text-white/80 mb-8">
              Backoffice Administrativo
            </p>
          </div>
          
          <div className="space-y-6">
            <div className="flex items-start gap-4 animate-fade-in [animation-delay:100ms] opacity-0 [animation-fill-mode:forwards]">
              <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0 mt-1">
                <span className="text-sm font-semibold">01</span>
              </div>
              <div>
                <h3 className="font-semibold text-lg">Gestión Centralizada</h3>
                <p className="text-white/70 text-sm">Administra solicitudes, alianzas y operaciones desde un solo lugar.</p>
              </div>
            </div>
            
            <div className="flex items-start gap-4 animate-fade-in [animation-delay:200ms] opacity-0 [animation-fill-mode:forwards]">
              <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0 mt-1">
                <span className="text-sm font-semibold">02</span>
              </div>
              <div>
                <h3 className="font-semibold text-lg">Reportes en Tiempo Real</h3>
                <p className="text-white/70 text-sm">Monitorea métricas y KPIs con dashboards actualizados.</p>
              </div>
            </div>
            
            <div className="flex items-start gap-4 animate-fade-in [animation-delay:300ms] opacity-0 [animation-fill-mode:forwards]">
              <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0 mt-1">
                <span className="text-sm font-semibold">03</span>
              </div>
              <div>
                <h3 className="font-semibold text-lg">Control Total</h3>
                <p className="text-white/70 text-sm">Gestiona usuarios, permisos y configuraciones del sistema.</p>
              </div>
            </div>
          </div>
        </div>
        
        {/* Decorative circles */}
        <div className="absolute -bottom-32 -left-32 w-96 h-96 bg-white/5 rounded-full" />
        <div className="absolute -top-20 -right-20 w-72 h-72 bg-white/5 rounded-full" />
      </div>

      {/* Panel derecho - Formulario */}
      <div className="flex-1 flex items-center justify-center p-8 bg-background">
        <div className="w-full max-w-md">
          {/* Logo para móvil */}
          <div className="lg:hidden text-center mb-8 animate-fade-in">
            <img 
              src={logoTedevuelvo} 
              alt="Te devuelvo" 
              className="h-14 w-auto mx-auto mb-2"
            />
            <p className="text-muted-foreground text-sm">Backoffice Administrativo</p>
          </div>

          <div className="bg-card rounded-2xl shadow-xl border p-8 animate-scale-in">
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-foreground">Bienvenido</h2>
              <p className="text-muted-foreground mt-1">Ingresa tus credenciales para continuar</p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" aria-label="Formulario de acceso">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground" htmlFor="email">
                  Correo electrónico
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input 
                    id="email" 
                    type="email" 
                    autoComplete="email" 
                    placeholder="tu@email.com"
                    className="pl-10 h-12 bg-muted/50 border-border focus:bg-background transition-colors"
                    {...register('email')} 
                    aria-invalid={!!errors.email} 
                  />
                </div>
                {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground" htmlFor="password">
                  Contraseña
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input 
                    id="password" 
                    type="password" 
                    autoComplete="current-password" 
                    placeholder="••••••••"
                    className="pl-10 h-12 bg-muted/50 border-border focus:bg-background transition-colors"
                    {...register('password')} 
                    aria-invalid={!!errors.password} 
                  />
                </div>
                {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
              </div>

              <Button 
                type="submit" 
                className="w-full h-12 text-base font-semibold group" 
                disabled={isSubmitting} 
                variant="hero"
              >
                Ingresar
                <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
              </Button>
            </form>

            <div className="mt-8 pt-6 border-t border-border text-center">
              <p className="text-xs text-muted-foreground">
                Versión 2.2.0 • © {new Date().getFullYear()} Te devuelvo
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
