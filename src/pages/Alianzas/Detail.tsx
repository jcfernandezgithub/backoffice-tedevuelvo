import { useParams, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Building2, Users, Mail, Phone, MapPin, Percent, Calendar } from 'lucide-react';
import { UsuariosTab } from './tabs/Usuarios';
import { useAllianceUserCount } from './hooks/useAllianceUsers';

export default function AlianzaDetail() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const { data: userCount = 0 } = useAllianceUserCount(id!);
  const [activeTab, setActiveTab] = useState('resumen');

  // Handle URL hash for tab selection
  useEffect(() => {
    if (location.hash === '#usuarios') {
      setActiveTab('usuarios');
    }
  }, [location.hash]);

  // Mock alliance data - in real app this would come from API
  const alianza = {
    id: id,
    nombre: id === 'AL-001' ? 'Sindicato Financiero Andes' : 'Broker Pacífico',
    descripcion: id === 'AL-001' ? 'Alianza estratégica con sindicato del sector financiero' : 'Broker especializado en seguros comerciales',
    contacto: { email: 'contacto@alianza.cl', fono: '+56 2 2345 6789' },
    direccion: 'Av. Apoquindo 1234, Las Condes',
    comision: 12.5,
    activo: true,
    logo: '/firma-cng.jpeg',
    fechaInicio: new Date('2024-01-01'),
    fechaTermino: new Date('2025-12-31'),
  };

  if (!id) return null;

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header con Logo */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row gap-6 items-start">
            {/* Logo */}
            <div className="shrink-0">
              <div className="w-24 h-24 rounded-lg border-2 border-border overflow-hidden bg-muted flex items-center justify-center">
                {alianza.logo ? (
                  <img 
                    src={alianza.logo} 
                    alt={`Logo ${alianza.nombre}`}
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <Building2 className="w-12 h-12 text-muted-foreground" />
                )}
              </div>
            </div>

            {/* Info Principal */}
            <div className="flex-1 space-y-2">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <h1 className="text-3xl font-bold">{alianza.nombre}</h1>
                  {alianza.descripcion && (
                    <p className="text-muted-foreground mt-1">{alianza.descripcion}</p>
                  )}
                </div>
                <Badge variant={alianza.activo ? 'default' : 'secondary'} className="text-sm">
                  {alianza.activo ? 'Activa' : 'Inactiva'}
                </Badge>
              </div>

              <Separator className="my-4" />

              {/* Datos de contacto y configuración en grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
                <div className="flex items-start gap-3">
                  <Mail className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">Email</p>
                    <p className="text-sm text-muted-foreground">{alianza.contacto.email}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Phone className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">Teléfono</p>
                    <p className="text-sm text-muted-foreground">{alianza.contacto.fono}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">Dirección</p>
                    <p className="text-sm text-muted-foreground">{alianza.direccion}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Percent className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">Comisión</p>
                    <p className="text-sm text-muted-foreground">{alianza.comision}%</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">Vigencia</p>
                    <p className="text-sm text-muted-foreground">
                      {alianza.fechaInicio.toLocaleDateString('es-CL')} - {alianza.fechaTermino.toLocaleDateString('es-CL')}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Users className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">Usuarios</p>
                    <p className="text-sm text-muted-foreground">{userCount} usuario{userCount !== 1 ? 's' : ''}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="usuarios" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Usuarios
            <Badge variant="secondary" className="ml-1">
              {userCount}
            </Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="usuarios">
          <UsuariosTab alianceName={alianza.nombre} />
        </TabsContent>
      </Tabs>
    </div>
  );
}