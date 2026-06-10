import { useState } from 'react'
import { Package, FileText, Shield } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import CartasCorteWizard from './wizards/CartasCorteWizard'
import CertificadosCoberturaWizard from './wizards/CertificadosCoberturaWizard'

type ProcessTab = 'cartas' | 'certificados'

export default function ProcesosMasivosPage() {
  const [tab, setTab] = useState<ProcessTab>('cartas')

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <Package className="h-6 w-6 text-primary" />
          Procesos Masivos
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Generación masiva de documentos a partir de un archivo de carga.
        </p>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as ProcessTab)} className="space-y-4">
        <TabsList>
          <TabsTrigger value="cartas" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Cartas de Corte
          </TabsTrigger>
          <TabsTrigger value="certificados" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Certificados de Cobertura
          </TabsTrigger>
        </TabsList>

        <TabsContent value="cartas" className="mt-0">
          <CartasCorteWizard />
        </TabsContent>
        <TabsContent value="certificados" className="mt-0">
          <CertificadosCoberturaWizard />
        </TabsContent>
      </Tabs>
    </div>
  )
}