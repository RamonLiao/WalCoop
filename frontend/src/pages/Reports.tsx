import { useState } from 'react';
import { useCurrentClient } from '@mysten/dapp-kit-react';
import type { UsageRecord } from '../contracts';
import { useDataCoopClient, useExecute, useCurrentAccount } from '../hooks/useDataCoop';
import { useToast } from '../state/ToastContext';
import { getUsageRecord } from '../lib/chain';
import { short, toSui } from '../lib/format';
import { Empty, CreatedIds } from '../components/common';

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
      toast.push('已核發 ProviderCap');
      setProvider('');
    } catch (e) {
      toast.push((e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="panel">
      <h3>核發模型服務商授權 (Admin)</h3>
      <p className="meta" style={{ marginTop: 4 }}>持有 PublisherCap 的平台管理者可授權模型服務商進行結算。</p>
      <div className="field mt-m">
        <label>PublisherCap id</label>
        <input className="input mono" value={pubCap} onChange={(e) => setPubCap(e.target.value)} placeholder="0x…" />
      </div>
      <div className="field">
        <label>模型服務商地址</label>
        <input className="input mono" value={provider} onChange={(e) => setProvider(e.target.value)} placeholder="0x…" />
      </div>
      <button className="btn btn-primary" disabled={busy || !pubCap.startsWith('0x') || !provider.startsWith('0x')} onClick={grant}>
        {busy ? '核發中…' : '核發 ProviderCap'}
      </button>
      <CreatedIds label="新核發的 ProviderCap id（結算時使用）" ids={capIds} />
    </div>
  );
}

export function Reports() {
  const client = useCurrentClient();
  const account = useCurrentAccount();
  const toast = useToast();
  const [id, setId] = useState('');
  const [record, setRecord] = useState<UsageRecord | null>(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const r = await getUsageRecord(client, id.trim());
      if (!r) toast.push('找不到使用紀錄', 'error');
      setRecord(r);
    } catch (e) {
      toast.push((e as Error).message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid" style={{ gap: 28 }}>
      <div>
        <h2>使用紀錄</h2>
        <p className="meta">每筆結算都是凍結的鏈上憑證，任何人都能驗證分潤明細。</p>
      </div>

      <div className="panel">
        <div className="row" style={{ gap: 8 }}>
          <input className="input mono" placeholder="UsageRecord object id 0x…" value={id} onChange={(e) => setId(e.target.value)} />
          <button className="btn btn-secondary" disabled={!id.startsWith('0x') || loading} onClick={load}>查詢</button>
        </div>

        {record && (
          <div className="mt-l">
            <div className="row between"><span className="meta">方案</span><span className="mono">{short(record.campaignId, 6)}</span></div>
            <div className="row between mt-s"><span className="meta">報表 blob</span><span className="mono">{record.reportBlobId.length} bytes</span></div>
            <div className="divider" />
            <table className="table">
              <thead><tr><th>Dataset</th><th>分潤金額</th></tr></thead>
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
        {!record && !loading && <Empty>輸入結算後產生的 UsageRecord id 來檢視分潤。</Empty>}
      </div>

      {account && <GrantPanel />}
    </div>
  );
}
