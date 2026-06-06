import { useState } from 'react';
import { PricingModel, type Dataset } from '../contracts';
import { useDataCoopClient, useExecute, useDatasets, useInvalidate, useCurrentAccount, addIds } from '../hooks/useDataCoop';
import { useRole } from '../state/RoleContext';
import { useToast } from '../state/ToastContext';
import { addId } from '../lib/registry';
import { enc, toSui } from '../lib/format';
import { Empty, Skeleton, ImportIdBar, Addr } from '../components/common';

function DatasetCard({ ds, action, me }: { ds: Dataset; action?: React.ReactNode; me?: string }) {
  return (
    <div className="card hoverable col" style={{ gap: 12 }}>
      <div className="row between">
        <h3>{ds.name || '未命名資料集'}</h3>
        {ds.listed ? <span className="tag tag-active">已上架</span> : <span className="tag tag-neutral">未上架</span>}
      </div>
      <div className="row wrap" style={{ gap: 6 }}>
        <span className="tag tag-info">分潤 {(ds.revShareBps / 100).toFixed(0)}%</span>
        <span className="tag tag-neutral">v{String(ds.version)}</span>
      </div>
      <div className="row between"><span className="meta">擁有者</span><Addr value={ds.owner} me={me} /></div>
      <div className="divider" style={{ margin: '4px 0' }} />
      <div className="row between">
        <div>
          <div className="meta">單價</div>
          <div style={{ fontWeight: 600 }}>{toSui(ds.pricing.unitPrice)} SUI</div>
        </div>
        {action}
      </div>
    </div>
  );
}

function RegisterPanel() {
  const client = useDataCoopClient();
  const exec = useExecute();
  const invalidate = useInvalidate();
  const toast = useToast();
  const [name, setName] = useState('');
  const [unitPrice, setUnitPrice] = useState('1');
  const [revShare, setRevShare] = useState('50');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      const { created } = await exec((tx) =>
        client.registerDataset(tx, {
          // In production these come from the Walrus+Seal upload pipeline.
          blobId: enc(`walrus:${name}`),
          sealInnerId: enc(name),
          schemaUri: enc(`schema:${name}`),
          name,
          pricingModel: PricingModel.PerUse,
          unitPrice: BigInt(Math.round(Number(unitPrice) * 1e9)),
          revShareBps: Math.round(Number(revShare) * 100),
        }),
      );
      addIds('dataset', created);
      await invalidate('datasets');
      toast.push('Dataset 已在 Sui 上註冊');
      setName('');
    } catch (e) {
      toast.push((e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="panel">
      <h3>註冊你的資料集</h3>
      <p className="meta" style={{ marginTop: 4 }}>匿名化、聚合後的資料才會被收錄；原始 PII 留在你的系統內。</p>
      <div className="mt-m">
        <div className="field">
          <label>名稱</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="例如：每日商品銷售彙總 TW" />
        </div>
        <div className="row" style={{ gap: 12 }}>
          <div className="field" style={{ flex: 1 }}>
            <label>單價 (SUI / 次)</label>
            <input className="input" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} />
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label>分潤比例 (%)</label>
            <input className="input" value={revShare} onChange={(e) => setRevShare(e.target.value)} />
          </div>
        </div>
        <button className="btn btn-primary" style={{ width: '100%' }} disabled={!name || busy} onClick={submit}>
          {busy ? '註冊中…' : '上架資料集'}
        </button>
      </div>
    </div>
  );
}

export function Marketplace() {
  const { role } = useRole();
  const account = useCurrentAccount();
  const { data: datasets, isLoading } = useDatasets();
  const invalidate = useInvalidate();

  return (
    <div className="grid" style={{ gap: 28 }}>
      <div className="row between wrap">
        <div>
          <h2>Dataset 市集</h2>
          <p className="meta">可驗證的零售資料，供品牌與模型訓練使用。</p>
        </div>
        <ImportIdBar
          onImport={async (id) => {
            addId('dataset', id);
            await invalidate('datasets');
          }}
        />
      </div>

      {role === 'retailer' && (account ? <RegisterPanel /> : <div className="panel meta">連接錢包以註冊資料集。</div>)}

      {isLoading ? (
        <Skeleton rows={4} />
      ) : datasets && datasets.length > 0 ? (
        <div className="grid grid-cards">
          {datasets.map((ds) => (
            <DatasetCard key={ds.id} ds={ds} me={account?.address} />
          ))}
        </div>
      ) : (
        <Empty>還沒有資料集。{role === 'retailer' ? '從上方註冊第一個。' : '匯入 id 或請供應者上架。'}</Empty>
      )}
    </div>
  );
}
