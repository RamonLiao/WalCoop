import { useEffect, useState } from 'react';
import { useCurrentClient } from '@mysten/dapp-kit-react';
import type { UsageRecord } from '../contracts';
import { useDataCoopClient, useExecute, useCurrentAccount } from '../hooks/useDataCoop';
import { useToast } from '../state/ToastContext';
import { getUsageRecord } from '../lib/chain';
import { short, toSui } from '../lib/format';
import { Empty, CreatedIds } from '../components/common';
import { CapSelect, AddressSelect } from '../components/selectors';

function GrantPanel() {
  const client = useDataCoopClient();
  const exec = useExecute();
  const toast = useToast();
  const [pubCap, setPubCap] = useState('');
  const [provider, setProvider] = useState('');
  const [busy, setBusy] = useState(false);
  const [capIds, setCapIds] = useState<string[]>([]);

  const grant = async () => {
    setBusy(true);
    try {
      const { created } = await exec((tx) => client.grantProviderCap(tx, { publisherCapId: pubCap, provider }));
      setCapIds(created);
      toast.push('ProviderCap issued');
      setProvider('');
    } catch (e) {
      toast.push((e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="panel">
      <h3>Issue a model-provider authorisation (Admin)</h3>
      <p className="meta" style={{ marginTop: 4 }}>A platform admin holding the PublisherCap can authorise a model provider to settle campaigns.</p>
      <div className="mt-m">
        <CapSelect kind="PublisherCap" label="PublisherCap (admin credential)" value={pubCap} onChange={setPubCap} />
      </div>
      <AddressSelect label="Authorise which model provider" value={provider} onChange={setProvider} />
      <button className="btn btn-primary" disabled={busy || !pubCap.startsWith('0x') || !provider.startsWith('0x')} onClick={grant}>
        {busy ? 'Issuing…' : 'Issue ProviderCap'}
      </button>
      <CreatedIds label="Newly issued ProviderCap id (used at settlement)" ids={capIds} />
    </div>
  );
}

export function Reports({ initialId = '' }: { initialId?: string }) {
  const client = useCurrentClient();
  const account = useCurrentAccount();
  const toast = useToast();
  const [id, setId] = useState('');
  const [record, setRecord] = useState<UsageRecord | null>(null);
  const [loading, setLoading] = useState(false);

  const load = async (queryId: string = id) => {
    const target = queryId.trim();
    if (!target) return;
    setLoading(true);
    try {
      const r = await getUsageRecord(client, target);
      if (!r) toast.push('Usage record not found', 'error');
      setRecord(r);
    } catch (e) {
      toast.push((e as Error).message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Arrived here via "查看分潤": prefill the id and auto-query.
  useEffect(() => {
    if (initialId) {
      setId(initialId);
      load(initialId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialId]);

  return (
    <div className="grid" style={{ gap: 28 }}>
      <div>
        <h2>Usage Records</h2>
        <p className="meta">Every settlement is a frozen on-chain receipt that anyone can verify against the revenue breakdown.</p>
      </div>

      <div className="panel">
        <div className="row" style={{ gap: 8 }}>
          <input className="input mono" placeholder="UsageRecord object id 0x…" value={id} onChange={(e) => setId(e.target.value)} />
          <button className="btn btn-secondary" disabled={!id.startsWith('0x') || loading} onClick={() => load()}>Query</button>
        </div>

        {record && (
          <div className="mt-l">
            <div className="row between"><span className="meta">Campaign</span><span className="mono">{short(record.campaignId, 6)}</span></div>
            <div className="row between mt-s"><span className="meta">Report blob</span><span className="mono">{record.reportBlobId.length} bytes</span></div>
            <div className="divider" />
            <table className="table">
              <thead><tr><th>Dataset</th><th>Revenue share</th></tr></thead>
              <tbody>
                {record.datasetIds.map((d, i) => (
                  <tr key={d}>
                    <td className="mono">{short(d, 6)}</td>
                    <td>{toSui(record.settledAmounts[i] ?? 0n)} SUI</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!record && !loading && <Empty>Enter the UsageRecord id produced at settlement to view the revenue breakdown.</Empty>}
      </div>

      {account && <GrantPanel />}
    </div>
  );
}
