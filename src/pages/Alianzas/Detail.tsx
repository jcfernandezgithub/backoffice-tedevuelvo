import { useParams, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Building2, Users, FileText } from 'lucide-react';
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
    contacto: { email: 'contacto@alianza.cl', fono: '+56 2 2345 6789' },
    direccion: 'Av. Apoquindo 1234, Las Condes',
    comision: 12.5,
    activo: true,
  };

  if (!id) return null;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{alianza.nombre}</h1>
          <p className="text-muted-foreground">Gestión de alianza y usuarios</p>
        </div>
        <Badge variant={alianza.activo ? 'default' : 'secondary'}>
          {alianza.activo ? 'Activa' : 'Inactiva'}
        </Badge>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="resumen" className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Resumen
          </TabsTrigger>
          <TabsTrigger value="usuarios" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Usuarios
            <Badge variant="secondary" className="ml-1">
              {userCount}
            </Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="resumen">
          <Card>
            <CardHeader>
              <CardTitle>Información de la Alianza</CardTitle>
              <CardDescription>
                Datos generales y configuración de la alianza
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium mb-2">Contacto</h4>
                  <p className="text-sm text-muted-foreground">
                    Email: {alianza.contacto.email}<br />
                    Teléfono: {alianza.contacto.fono}
                  </p>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Comisión</h4>
                  <p className="text-sm text-muted-foreground">
                    {alianza.comision}%
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="usuarios">
          <UsuariosTab alianceName={alianza.nombre} />
        </TabsContent>
      </Tabs>
    </div>
  );
}