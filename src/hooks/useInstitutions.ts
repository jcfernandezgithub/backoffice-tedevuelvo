import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  institutionsService,
  setCachedInstitutions,
  getCachedInstitutions,
  type Institution,
  type InstitutionPayload,
} from '@/services/institutionsService';

const PUBLIC_KEY = ['institutions', 'public'] as const;
const ADMIN_KEY = ['institutions', 'admin'] as const;

/** Hook público: lista activa para combos/calculadora. */
export function usePublicInstitutions() {
  const query = useQuery({
    queryKey: PUBLIC_KEY,
    queryFn: () => institutionsService.listPublic(),
    staleTime: 5 * 60 * 1000,
    placeholderData: () => {
      const cached = getCachedInstitutions();
      return cached.length > 0 ? cached : undefined;
    },
  });

  // Mantener cache sincrónica fresca para los helpers `getSafetyMargin...`
  useEffect(() => {
    if (query.data) setCachedInstitutions(query.data);
  }, [query.data]);

  return query;
}

/** Hook admin: lista completa + mutaciones CRUD. */
export function useAdminInstitutions() {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ADMIN_KEY,
    queryFn: () => institutionsService.listAdmin(),
    staleTime: 60 * 1000,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: PUBLIC_KEY });
    qc.invalidateQueries({ queryKey: ADMIN_KEY });
  };

  const createMutation = useMutation({
    mutationFn: (payload: InstitutionPayload) => institutionsService.create(payload),
    onSuccess: invalidate,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<InstitutionPayload> }) =>
      institutionsService.update(id, payload),
    onMutate: async ({ id, payload }) => {
      await qc.cancelQueries({ queryKey: ADMIN_KEY });
      const prev = qc.getQueryData<Institution[]>(ADMIN_KEY);
      if (prev) {
        qc.setQueryData<Institution[]>(
          ADMIN_KEY,
          prev.map((i) => (i.id === id ? { ...i, ...payload } : i)),
        );
      }
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(ADMIN_KEY, ctx.prev);
    },
    onSettled: invalidate,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => institutionsService.remove(id),
    onSuccess: invalidate,
  });

  return {
    ...query,
    createInstitution: createMutation.mutateAsync,
    updateInstitution: updateMutation.mutate,
    updateInstitutionAsync: updateMutation.mutateAsync,
    deleteInstitution: deleteMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}

// ─── Helpers sincrónicos para cálculos ─────────────────────────────────────

function findByInstitutionKey(key: string): Institution | undefined {
  const k = key.toLowerCase().trim();
  return getCachedInstitutions().find(
    (i) =>
      i.value.toLowerCase().trim() === k ||
      i.label.toLowerCase().trim() === k ||
      i.id.toLowerCase().trim() === k,
  );
}

/** Margen configurado para una institución (default 10%) */
export function getInstitutionMargin(
  institutionKey: string | undefined | null,
): number {
  if (!institutionKey) return 10;
  const inst = findByInstitutionKey(institutionKey);
  return inst?.margen_seguridad ?? 10;
}

/** ¿Activa/visible en la calculadora? */
export function isInstitutionActive(
  institutionKey: string | undefined | null,
): boolean {
  if (!institutionKey) return true;
  const inst = findByInstitutionKey(institutionKey);
  return inst?.active ?? true;
}