import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/state/AuthContext'
import { useNavigate } from 'react-router-dom'
import { useToast } from '@/hooks/use-toast'

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

  // Determina la ruta inicial según el email del usuario
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
    <main className="min-h-screen grid place-items-center bg-gradient-to-br from-background to-muted/20">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Ingresar</CardTitle>
          <CardDescription>Backoffice Te devuelvo</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" aria-label="Formulario de acceso">
            <div>
              <label className="text-sm" htmlFor="email">Email</label>
              <Input id="email" type="email" autoComplete="email" {...register('email')} aria-invalid={!!errors.email} />
              {errors.email && <p className="text-sm text-destructive mt-1">{errors.email.message}</p>}
            </div>
            <div>
              <label className="text-sm" htmlFor="password">Contraseña</label>
              <Input id="password" type="password" autoComplete="current-password" {...register('password')} aria-invalid={!!errors.password} />
              {errors.password && <p className="text-sm text-destructive mt-1">{errors.password.message}</p>}
            </div>
            <Button type="submit" className="w-full" disabled={isSubmitting} variant="hero">Entrar</Button>
          </form>
          <div className="mt-6 pt-4 border-t text-center">
            <p className="text-xs text-muted-foreground">Versión 2.0.7</p>
          </div>
        </CardContent>
      </Card>
    </main>
  )
}
