import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  policyMinimumValueService,
  type PolicyMinimumValueConfig,
  type PolicyMinimumValuePatch,
} from '@/services/policyMinimumValueService';

export const POLICY_MIN_VALUE_KEY = ['policy-minimum-value'] as const;

export function usePolicyMinimumValueConfigs() {
  return useQuery<PolicyMinimumValueConfig[]>({
    queryKey: POLICY_MIN_VALUE_KEY,
    queryFn: policyMinimumValueService.list,
    staleTime: 60_000,
  });
}

export function usePolicyMinimumValueMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: POLICY_MIN_VALUE_KEY });

  return {
    create: useMutation({
      mutationFn: policyMinimumValueService.create,
      onSuccess: invalidate,
    }),
    update: useMutation({
      mutationFn: (v: { id: string; patch: PolicyMinimumValuePatch }) =>
        policyMinimumValueService.update(v.id, v.patch),
      onSuccess: invalidate,
    }),
    remove: useMutation({
      mutationFn: (id: string) => policyMinimumValueService.remove(id),
      onSuccess: invalidate,
    }),
  };
}