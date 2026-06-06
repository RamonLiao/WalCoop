import { useMemo, useCallback } from 'react';
import {
  useDAppKit,
  useCurrentClient,
  useCurrentAccount,
} from '@mysten/dapp-kit-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Transaction } from '@mysten/sui/transactions';
import { DataCoopClient, PACKAGE_ID, parseMoveError } from '../contracts';
import { getDataset, getCampaign, getMany, createdObjectIds } from '../lib/chain';
import { getIds, addIds } from '../lib/registry';

export function useDataCoopClient() {
  return useMemo(() => new DataCoopClient(PACKAGE_ID), []);
}

/** Build a PTB, sign+execute, wait for finality, and surface created object ids. */
export function useExecute() {
  const dAppKit = useDAppKit();
  const client = useCurrentClient();

  return useCallback(
    async (build: (tx: Transaction) => void): Promise<{ digest: string; created: string[] }> => {
      const tx = new Transaction();
      build(tx);
      let result: any;
      try {
        result = await dAppKit.signAndExecuteTransaction({ transaction: tx });
      } catch (e) {
        throw new Error(parseMoveError(e));
      }
      if (result.FailedTransaction) {
        throw new Error(parseMoveError(result.FailedTransaction.status?.error?.message ?? 'Transaction failed'));
      }
      const digest = result.Transaction.digest as string;
      await (client as any).waitForTransaction?.({ digest });
      return { digest, created: createdObjectIds(result) };
    },
    [dAppKit, client],
  );
}

export function useDatasets() {
  const client = useCurrentClient();
  return useQuery({
    queryKey: ['datasets', PACKAGE_ID],
    queryFn: () => getMany(client, getIds('dataset'), getDataset),
  });
}

export function useCampaigns() {
  const client = useCurrentClient();
  return useQuery({
    queryKey: ['campaigns', PACKAGE_ID],
    queryFn: () => getMany(client, getIds('campaign'), getCampaign),
  });
}

export function useInvalidate() {
  const qc = useQueryClient();
  return useCallback(
    (kind: 'datasets' | 'campaigns') => qc.invalidateQueries({ queryKey: [kind, PACKAGE_ID] }),
    [qc],
  );
}

export { addIds, useCurrentAccount };
