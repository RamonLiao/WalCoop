import { useState } from 'react';
import { CampaignStatus, type Campaign } from '../contracts';
import {
  useDataCoopClient,
  useExecute,
  useDatasets,
  useCampaigns,
  useInvalidate,
  useCurrentAccount,
  addIds,
} from '../hooks/useDataCoop';
import { useRole } from '../state/RoleContext';
import { useToast } from '../state/ToastContext';
import { addId } from '../lib/registry';
import { enc, short, toSui, suiToMist } from '../lib/format';
import { Empty, Skeleton, StatusTag, ImportIdBar, CreatedIds, Addr } from '../components/common';
import { CapSelect, AddressSelect } from '../components/selectors';

function CreatePanel() {
  const client = useDataCoopClient();
  const exec = useExecute();
  const invalidate = useInvalidate();
  const toast = useToast();
  const { data: datasets } = useDatasets();
  const [selected, setSelected] = useState<string[]>([]);
  const [provider, setProvider] = useState('');
  const [busy, setBusy] = useState(false);

  const toggle = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const floor = (datasets ?? [])
    .filter((d) => selected.includes(d.id))
    .reduce((acc, d) => acc + d.pricing.unitPrice, 0n);

  const submit = async () => {
    setBusy(true);
    try {
      const { created } = await exec((tx) =>
        client.createCampaign(tx, { modelProvider: provider, datasetIds: selected }),
      );
      addIds('campaign', created);
      await invalidate('campaigns');
      toast.push('資料方案已建立 (待付款)');
      setSelected([]);
    } catch (e) {
      toast.push((e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="panel">
      <h3>建立資料方案</h3>
      <p className="meta" style={{ marginTop: 4 }}>挑選要使用的資料集，並指定模型服務商。</p>
      <div className="mt-m">
        <AddressSelect label="模型服務商" value={provider} onChange={setProvider} />
      </div>
      <div className="field">
        <label>選擇資料集 ({selected.length})</label>
        <div className="grid" style={{ gap: 8, maxHeight: 220, overflow: 'auto' }}>
          {(datasets ?? []).filter((d) => d.listed).map((d) => (
            <label key={d.id} className="row between card" style={{ padding: '10px 14px', cursor: 'pointer' }}>
              <span className="row" style={{ gap: 10 }}>
                <input type="checkbox" checked={selected.includes(d.id)} onChange={() => toggle(d.id)} />
                {d.name || short(d.id)}
              </span>
              <span className="meta">{toSui(d.pricing.unitPrice)} SUI · {(d.revShareBps / 100).toFixed(0)}%</span>
            </label>
          ))}
          {(!datasets || datasets.length === 0) && <span className="meta">市集尚無資料集。</span>}
        </div>
      </div>
      <div className="row between">
        <span className="meta">底價合計 <strong>{toSui(floor)} SUI</strong></span>
        <button className="btn btn-primary" disabled={!provider.startsWith('0x') || selected.length === 0 || busy} onClick={submit}>
          {busy ? '建立中…' : '建立方案'}
        </button>
      </div>
    </div>
  );
}

function CampaignCard({ c }: { c: Campaign }) {
  const client = useDataCoopClient();
  const exec = useExecute();
  const invalidate = useInvalidate();
  const toast = useToast();
  const account = useCurrentAccount();
  const { role } = useRole();
  const [amount, setAmount] = useState(toSui(c.priceFloor || 1n));
  const [capId, setCapId] = useState('');
  const [busy, setBusy] = useState(false);
  const [usageIds, setUsageIds] = useState<string[]>([]);

  const isBuyer = account?.address === c.buyer;
  const isProvider = account?.address === c.modelProvider;

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
      await invalidate('campaigns');
    } catch (e) {
      toast.push((e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const fundAndAuthorize = () =>
    run(async () => {
      await exec((tx) => {
        client.fundCampaign(tx, { campaignId: c.id, amount: suiToMist(amount) });
        client.issueAccessTicket(tx, { campaignId: c.id, expiryMs: BigInt(Date.now() + 7 * 86400_000) });
      });
      toast.push('已付款並核發使用授權');
    });

  const cancel = () =>
    run(async () => {
      await exec((tx) => client.cancelCampaign(tx, c.id));
      toast.push('方案已取消，預算退回');
    });

  const settle = () =>
    run(async () => {
      const { created } = await exec((tx) =>
        client.settleCampaign(tx, {
          providerCapId: capId,
          campaignId: c.id,
          orderedDatasetIds: c.datasetIds,
          usageStatsHash: enc(`stats:${c.id}`),
          reportBlobId: enc(`walrus:report:${c.id}`),
        }),
      );
      setUsageIds(created);
      toast.push('結算完成，分潤已上鏈');
    });

  return (
    <div className="card col" style={{ gap: 12 }}>
      <div className="row between">
        <div className="col" style={{ gap: 2 }}>
          <span className="meta">資料方案</span>
          <Addr value={c.id} />
        </div>
        <StatusTag status={c.status} />
      </div>
      <div className="stat-row" style={{ gap: 10 }}>
        <div><div className="meta">預算</div><strong>{toSui(c.budget)} SUI</strong></div>
        <div><div className="meta">資料集</div><strong>{c.datasetIds.length}</strong></div>
        <div><div className="meta">底價</div><strong>{toSui(c.priceFloor)} SUI</strong></div>
      </div>
      <div className="divider" />
      <div className="row between"><span className="meta">買方</span><Addr value={c.buyer} me={account?.address} /></div>
      <div className="row between"><span className="meta">模型服務商</span><Addr value={c.modelProvider} me={account?.address} /></div>

      {role === 'brand' && isBuyer && c.status === CampaignStatus.Pending && (
        <div className="row" style={{ gap: 8 }}>
          <input className="input" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <button className="btn btn-primary btn-sm" disabled={busy} onClick={fundAndAuthorize}>付款並授權</button>
        </div>
      )}
      {role === 'brand' && isBuyer && c.status === CampaignStatus.Active && (
        <button className="btn btn-secondary btn-sm" disabled={busy} onClick={cancel}>取消並退款</button>
      )}
      {role === 'provider' && isProvider && c.status === CampaignStatus.Active && (
        <div className="col" style={{ gap: 8 }}>
          <CapSelect kind="ProviderCap" label="用哪個 ProviderCap 結算" value={capId} onChange={setCapId} />
          <button className="btn btn-primary btn-sm" disabled={busy || !capId.startsWith('0x')} onClick={settle}>結算分潤</button>
        </div>
      )}
      <CreatedIds label="結算產生的 UsageRecord id（到使用紀錄頁查詢）" ids={usageIds} />
    </div>
  );
}

export function Campaigns() {
  const { role } = useRole();
  const account = useCurrentAccount();
  const { data: campaigns, isLoading } = useCampaigns();
  const invalidate = useInvalidate();

  return (
    <div className="grid" style={{ gap: 28 }}>
      <div className="row between wrap">
        <div>
          <h2>資料方案</h2>
          <p className="meta">建立、付款、授權與結算，全程鏈上可查。</p>
        </div>
        <ImportIdBar onImport={async (id) => { addId('campaign', id); await invalidate('campaigns'); }} />
      </div>

      {role === 'brand' && (account ? <CreatePanel /> : <div className="panel meta">連接錢包以建立方案。</div>)}

      {isLoading ? (
        <Skeleton rows={4} />
      ) : campaigns && campaigns.length > 0 ? (
        <div className="grid grid-cards">
          {campaigns.map((c) => (
            <CampaignCard key={c.id} c={c} />
          ))}
        </div>
      ) : (
        <Empty>還沒有資料方案。{role === 'brand' ? '從上方建立第一個。' : '匯入 campaign id 查看。'}</Empty>
      )}
    </div>
  );
}
