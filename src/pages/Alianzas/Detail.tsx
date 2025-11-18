import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { UsuariosTab } from './tabs/Usuarios';
import { useAllianceUserCount } from './hooks/useAllianceUsers';
import { alianzasService } from '@/services/alianzasService';
import type { Alianza } from '@/types/alianzas';



export default function AlianzaDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: userCount = 0 } = useAllianceUserCount(id!);

  // Fetch real alliance data from API
  const { data: alianzasData } = useQuery({
    queryKey: ['alianzas'],
    queryFn: () => alianzasService.list({ pageSize: 100 }),
  });

  const alianza = alianzasData?.items.find((a: Alianza) => a.id === id);

  if (!id || !alianza) return null;



  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Back Button */}
      <Button
        variant="ghost"
        onClick={() => navigate('/alianzas')}
        className="gap-2"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver a Alianzas
      </Button>

      {/* Usuarios Section */}
      <UsuariosTab alianceName={alianza.nombre} alianzaData={alianza} />
    </div>
  );
}