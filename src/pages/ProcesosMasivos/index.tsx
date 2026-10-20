import { useState } from 'react'
import { Package, FileText, Shield, Wallet, Landmark } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import CartasCorteWizard from './wizards/CartasCorteWizard'
import CertificadosCoberturaWizard from './wizards/CertificadosCoberturaWizard'
import PagosMasivosWizard from './wizards/PagosMasivosWizard'
import IngresoBancarioWizard from './wizards/IngresoBancarioWizard'

type ProcessTab = 'cartas' | 'certificados' | 'pagos' | 'ingreso'

export default function ProcesosMasivosPage() {
  const [tab, setTab] = useState<ProcessTab>('cartas')
  const [ingresoBusy, setIngresoBusy] = useState(false)

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <Package className="h-6 w-6 text-primary" />
          Procesos Masivos
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Generación masiva de documentos y actualización masiva de estados a partir de un archivo de carga.
        </p>
      </div>

      <Tabs value={tab} onValueChange={(v) => { if (!ingresoBusy) setTab(v as ProcessTab) }} className="space-y-4">
        <TabsList className="flex flex-wrap h-auto justify-start">
          <TabsTrigger disabled={ingresoBusy} value="cartas" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Cartas de Corte
          </TabsTrigger>
          <TabsTrigger disabled={ingresoBusy} value="certificados" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Certificados de Cobertura
          </TabsTrigger>
          <TabsTrigger disabled={ingresoBusy} value="pagos" className="flex items-center gap-2">
            <Wallet className="h-4 w-4" />
            Pagos (carga_tdv)
          </TabsTrigger>
          <TabsTrigger value="ingreso" className="flex items-center gap-2"><Landmark className="h-4 w-4" />Ingreso bancario</TabsTrigger>
        </TabsList>

        <TabsContent value="cartas" className="mt-0">
          <CartasCorteWizard />
        </TabsContent>
        <TabsContent value="certificados" className="mt-0">
          <CertificadosCoberturaWizard />
        </TabsContent>
        <TabsContent value="pagos" className="mt-0">
          <PagosMasivosWizard />
        </TabsContent>
        <TabsContent forceMount value="ingreso" className="mt-0 data-[state=inactive]:hidden">
          <IngresoBancarioWizard onBusyChange={setIngresoBusy} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
