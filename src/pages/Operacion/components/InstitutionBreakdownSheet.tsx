import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ToggleGroup,
  ToggleGroupItem,
} from '@/components/ui/toggle-group';
import { ArrowRight, AlertTriangle, Building2 } from 'lucide-react';
import { getInstitutionDisplayName } from '@/lib/institutionHomologation';

export interface InstitutionBreakdownItem {
  institutionId: string;
  displayName: string;
  count: number;
  avgDaysInStage: number;
  overdueCount: number;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  items: InstitutionBreakdownItem[];
  /** URL params extra para navegar al listado (e.g. status, from, to) */
  baseUrlParams: Record<string, string>;
  /** Días objetivo para resaltar avgDays > objetivo */
  stageObjectiveDays?: number;
}

type SortKey = 'count' | 'avgDays' | 'overdue';

export function InstitutionBreakdownSheet({
  open,
  onOpenChange,
  title,
  description,
  items,
  baseUrlParams,
  stageObjectiveDays,
}: Props) {
  const navigate = useNavigate();
  const [sortKey, setSortKey] = useState<SortKey>('overdue');

  const sorted = useMemo(() => {
    const copy = [...items];
    copy.sort((a, b) => {
      if (sortKey === 'count') return b.count - a.count;
      if (sortKey === 'avgDays') return b.avgDaysInStage - a.avgDaysInStage;
      // overdue: primero más excedidas; empate por cantidad
      if (b.overdueCount !== a.overdueCount) return b.overdueCount - a.overdueCount;
      return b.count - a.count;
    });
    return copy;
  }, [items, sortKey]);

  const totalCount = items.reduce((s, i) => s + i.count, 0);
  const totalOverdue = items.reduce((s, i) => s + i.overdueCount, 0);

  const handleNavigate = (institutionId: string) => {
    const params = new URLSearchParams(baseUrlParams);
    params.set('institution', institutionId);
    params.set('autoSearch', 'true');
    navigate(`/refunds?${params.toString()}`);
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            {title}
          </SheetTitle>
          <SheetDescription className="flex items-center gap-3 flex-wrap">
            <span>
              <strong className="text-foreground">{totalCount}</strong> solicitudes
              en {items.length} {items.length === 1 ? 'institución' : 'instituciones'}
            </span>
            {totalOverdue > 0 && (
              <Badge variant="destructive" className="gap-1">
                <AlertTriangle className="h-3 w-3" />
                {totalOverdue} con tiempo excedido
              </Badge>
            )}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Ordenar por:</span>
          <ToggleGroup
            type="single"
            size="sm"
            value={sortKey}
            onValueChange={(v) => v && setSortKey(v as SortKey)}
          >
            <ToggleGroupItem value="overdue" className="text-xs">Más excedidas</ToggleGroupItem>
            <ToggleGroupItem value="count" className="text-xs">Cantidad</ToggleGroupItem>
            <ToggleGroupItem value="avgDays" className="text-xs">Días promedio</ToggleGroupItem>
          </ToggleGroup>
        </div>

        <div className="mt-4 rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Institución</TableHead>
                <TableHead className="text-right">Cantidad</TableHead>
                <TableHead className="text-right">Días prom.</TableHead>
                <TableHead className="text-right">Excedidas</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    No hay solicitudes para mostrar
                  </TableCell>
                </TableRow>
              ) : (
                sorted.map((item) => {
                  const isAvgOverObjective =
                    !!stageObjectiveDays && item.avgDaysInStage > stageObjectiveDays;
                  return (
                    <TableRow
                      key={item.institutionId}
                      className="cursor-pointer"
                      onClick={() => handleNavigate(item.institutionId)}
                    >
                      <TableCell className="font-medium">{item.displayName}</TableCell>
                      <TableCell className="text-right tabular-nums font-semibold">
                        {item.count}
                      </TableCell>
                      <TableCell
                        className={`text-right tabular-nums ${
                          isAvgOverObjective ? 'text-destructive font-semibold' : ''
                        }`}
                      >
                        {item.avgDaysInStage.toFixed(1)}
                      </TableCell>
                      <TableCell className="text-right">
                        {item.overdueCount > 0 ? (
                          <Badge variant="destructive" className="gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            {item.overdueCount}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleNavigate(item.institutionId);
                          }}
                        >
                          <ArrowRight className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {stageObjectiveDays && (
          <p className="text-xs text-muted-foreground mt-3">
            Tiempo objetivo de la etapa: <strong>{stageObjectiveDays} días</strong>. Los promedios
            que lo superan se resaltan en rojo.
          </p>
        )}
      </SheetContent>
    </Sheet>
  );
}

/**
 * Helper para construir el desglose por institución a partir de una lista de refunds
 * que están todos en el mismo estado (e.g. submitted).
 */
export function buildInstitutionBreakdown(
  refunds: any[],
  targetStatus: string,
  stageObjectiveDays?: number,
): InstitutionBreakdownItem[] {
  const groups = new Map<string, any[]>();
  refunds.forEach((r) => {
    const id = String(r.institutionId || 'sin-institucion');
    if (!groups.has(id)) groups.set(id, []);
    groups.get(id)!.push(r);
  });

  const now = Date.now();
  const result: InstitutionBreakdownItem[] = [];

  groups.forEach((rs, institutionId) => {
    let totalDays = 0;
    let counted = 0;
    let overdue = 0;

    rs.forEach((r) => {
      // Buscar la fecha en la que entró al estado actual (targetStatus)
      const history = r.statusHistory || [];
      const lastEntry = [...history]
        .reverse()
        .find((h: any) => (h.to?.toLowerCase?.() || h.to) === targetStatus);
      const enteredAt = lastEntry?.at || r.updatedAt || r.createdAt;
      if (!enteredAt) return;
      const days = (now - new Date(enteredAt).getTime()) / (1000 * 60 * 60 * 24);
      if (Number.isFinite(days) && days >= 0) {
        totalDays += days;
        counted++;
        if (stageObjectiveDays && days > stageObjectiveDays) overdue++;
      }
    });

    result.push({
      institutionId,
      displayName: getInstitutionDisplayName(institutionId),
      count: rs.length,
      avgDaysInStage: counted > 0 ? totalDays / counted : 0,
      overdueCount: overdue,
    });
  });

  return result;
}