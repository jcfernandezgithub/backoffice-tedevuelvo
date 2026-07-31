import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ratesService,
  setRatesCache,
  getBankCesantiaRates,
  getTdvCesantiaRates,
  getBankRateMatrix,
  type BankRatesResponse,
  type TeDevuelvoRatesResponse,
  type BankRateMatrixResponse,
} from '@/services/ratesService';

export const RATES_KEYS = {
  bank: ['rates', 'bank-cesantia'] as const,
  tdv: ['rates', 'tdv-cesantia'] as const,
  matrix: ['rates', 'bank-matrix'] as const,
};

const STALE = 5 * 60 * 1000;

export function useBankCesantiaRates() {
  const query = useQuery<BankRatesResponse>({
    queryKey: RATES_KEYS.bank,
    queryFn: () => ratesService.listBankRates(),
    staleTime: STALE,
    placeholderData: () => getBankCesantiaRates(),
  });
  useEffect(() => {
    if (query.data) setRatesCache('bank', query.data);
  }, [query.data]);
  return query;
}

export function useTdvCesantiaRates() {
  const query = useQuery<TeDevuelvoRatesResponse>({
    queryKey: RATES_KEYS.tdv,
    queryFn: () => ratesService.listTeDevuelvoRates(),
    staleTime: STALE,
    placeholderData: () => getTdvCesantiaRates(),
  });
  useEffect(() => {
    if (query.data) setRatesCache('tdv', query.data);
  }, [query.data]);
  return query;
}

export function useBankRateMatrix() {
  const query = useQuery<BankRateMatrixResponse>({
    queryKey: RATES_KEYS.matrix,
    queryFn: () => ratesService.listBankRateMatrix(),
    staleTime: STALE,
    placeholderData: () => getBankRateMatrix(),
  });
  useEffect(() => {
    if (query.data) setRatesCache('matrix', query.data);
  }, [query.data]);
  return query;
}

/** Precarga las tasas desde la API para alimentar la cache sincrónica usada por los cálculos. */
export function usePreloadRates() {
  useBankCesantiaRates();
  useTdvCesantiaRates();
  useBankRateMatrix();
}

export function useRatesMutations() {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: RATES_KEYS.bank });
    qc.invalidateQueries({ queryKey: RATES_KEYS.tdv });
    qc.invalidateQueries({ queryKey: RATES_KEYS.matrix });
  };

  return {
    createBank: useMutation({ mutationFn: ratesService.createBankRate, onSuccess: invalidate }),
    updateBankRange: useMutation({
      mutationFn: (v: { bankName: string; rangeName: string; patch: { desde?: number; hasta?: number | null; tasa_mensual?: number } }) =>
        ratesService.updateBankRange(v.bankName, v.rangeName, v.patch),
      onSuccess: invalidate,
    }),
    deleteBank: useMutation({ mutationFn: (bankName: string) => ratesService.deleteBankRate(bankName), onSuccess: invalidate }),

    createTdv: useMutation({ mutationFn: ratesService.createTeDevuelvoRate, onSuccess: invalidate }),
    updateTdvRange: useMutation({
      mutationFn: (v: { name: string; rangeName: string; patch: { desde?: number; hasta?: number | null; tasa_mensual?: number } }) =>
        ratesService.updateTeDevuelvoRange(v.name, v.rangeName, v.patch),
      onSuccess: invalidate,
    }),
    deleteTdv: useMutation({ mutationFn: (name: string) => ratesService.deleteTeDevuelvoRate(name), onSuccess: invalidate }),

    createMatrix: useMutation({ mutationFn: ratesService.createBankRateMatrix, onSuccess: invalidate }),
    updateMatrixRate: useMutation({
      mutationFn: (v: { bankName: string; ageGroup: string; amount: number; term: number; tasa: number }) =>
        ratesService.updateMatrixRate(v.bankName, v.ageGroup, v.amount, v.term, v.tasa),
      onSuccess: invalidate,
    }),
  };
}
