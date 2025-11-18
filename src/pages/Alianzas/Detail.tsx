import { useParams, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Users } from 'lucide-react';
import { UsuariosTab } from './tabs/Usuarios';
import { useAllianceUserCount } from './hooks/useAllianceUsers';
import { alianzasService } from '@/services/alianzasService';
import type { Alianza } from '@/types/alianzas';


export default function AlianzaDetail() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const { data: userCount = 0 } = useAllianceUserCount(id!);
  const [activeTab, setActiveTab] = useState('resumen');

  // Fetch real alliance data from API
  const { data: alianzasData } = useQuery({
    queryKey: ['alianzas'],
    queryFn: () => alianzasService.list({ pageSize: 100 }),
  });

  const alianza = alianzasData?.items.find((a: Alianza) => a.id === id);

  // Handle URL hash for tab selection
  useEffect(() => {
    if (location.hash === '#usuarios') {
      setActiveTab('usuarios');
    }
  }, [location.hash]);

  if (!id || !alianza) return null;


  return (
    <div className="container mx-auto p-6 space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="resumen">Resumen</TabsTrigger>
          <TabsTrigger value="usuarios">
            <Users className="h-4 w-4 mr-2" />
            Usuarios
            {userCount > 0 && (
              <Badge variant="secondary" className="ml-2">
                {userCount}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="resumen" className="mt-6">
          <p className="text-muted-foreground">Contenido del resumen aquí</p>
        </TabsContent>

        <TabsContent value="usuarios" className="mt-6">
          <UsuariosTab alianceName={alianza.nombre} alianzaData={alianza} />
        </TabsContent>
      </Tabs>
    </div>
  );
}