import { useState } from 'react';
import { cn } from '@/lib/utils';
import { StageObjectivesSection } from './components/StageObjectivesSection';
import { PlanCumplimientoForm } from './components/PlanCumplimientoForm';
import { TasasSection } from './components/TasasSection';
import {
  Timer,
  TrendingUp,
  Percent,
  Settings2,
  ChevronRight,
} from 'lucide-react';

// ─── Definición de la navegación ────────────────────────────────────────────

interface NavItem {
  id: string;
  label: string;
  description: string;
  icon: React.ElementType;
  group: string;
  component: React.ReactNode;
}

const NAV_ITEMS: NavItem[] = [
  {
    id: 'objetivos-etapa',
    label: 'Objetivos por etapa',
    description: 'Días máximos por transición',
    icon: Timer,
    group: 'Operación',
    component: <StageObjectivesSection />,
  },
  {
    id: 'plan-cumplimiento',
    label: 'Plan de cumplimiento',
    description: 'Metas mensuales de prima',
    icon: TrendingUp,
    group: 'Operación',
    component: <PlanCumplimientoForm />,
  },
  {
    id: 'tasas',
    label: 'Tasas de referencia',
    description: 'Cesantía y desgravamen',
    icon: Percent,
    group: 'Cálculos',
    component: <TasasSection />,
  },
];

// Agrupar los ítems por categoría
const GROUPS = NAV_ITEMS.reduce<Record<string, NavItem[]>>((acc, item) => {
  if (!acc[item.group]) acc[item.group] = [];
  acc[item.group].push(item);
  return acc;
}, {});

// ─── Componente principal ────────────────────────────────────────────────────

export default function AjustesPage() {
  const [activeId, setActiveId] = useState(NAV_ITEMS[0].id);
  const activeItem = NAV_ITEMS.find(i => i.id === activeId)!;

  return (
    <div className="flex min-h-screen bg-background">
      {/* ── Sidebar de navegación ── */}
      <aside className="w-64 shrink-0 border-r border-border/60 bg-muted/20">
        {/* Header del sidebar */}
        <div className="px-5 py-6 border-b border-border/60">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-primary/10">
              <Settings2 className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold leading-tight">Ajustes</p>
              <p className="text-xs text-muted-foreground leading-tight">Configuración del sistema</p>
            </div>
          </div>
        </div>

        {/* Grupos de navegación */}
        <nav className="p-3 space-y-5">
          {Object.entries(GROUPS).map(([group, items]) => (
            <div key={group}>
              <p className="px-2 mb-1.5 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/70">
                {group}
              </p>
              <div className="space-y-0.5">
                {items.map(item => {
                  const Icon = item.icon;
                  const isActive = activeId === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setActiveId(item.id)}
                      className={cn(
                        'w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-all duration-150',
                        isActive
                          ? 'bg-primary text-primary-foreground shadow-sm'
                          : 'text-foreground/70 hover:text-foreground hover:bg-muted'
                      )}
                    >
                      <Icon className={cn('h-4 w-4 shrink-0', isActive ? 'text-primary-foreground' : 'text-muted-foreground')} />
                      <div className="flex-1 min-w-0">
                        <p className={cn('text-sm font-medium leading-tight', isActive ? 'text-primary-foreground' : '')}>{item.label}</p>
                        <p className={cn('text-xs leading-tight truncate mt-0.5', isActive ? 'text-primary-foreground/70' : 'text-muted-foreground')}>
                          {item.description}
                        </p>
                      </div>
                      {isActive && <ChevronRight className="h-3.5 w-3.5 shrink-0 text-primary-foreground/60" />}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </aside>

      {/* ── Área de contenido ── */}
      <main className="flex-1 overflow-auto">
        {/* Breadcrumb / título de sección */}
        <div className="px-8 py-5 border-b border-border/60 bg-background sticky top-0 z-10">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <span>Ajustes</span>
            <ChevronRight className="h-3 w-3" />
            <span>{activeItem.group}</span>
            <ChevronRight className="h-3 w-3" />
            <span className="text-foreground font-medium">{activeItem.label}</span>
          </div>
          <h1 className="text-xl font-bold tracking-tight">{activeItem.label}</h1>
        </div>

        {/* Contenido de la sección activa */}
        <div className="px-8 py-8 max-w-3xl">
          {activeItem.component}
        </div>
      </main>
    </div>
  );
}
