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
        <h3>{ds.name || 'Untitled dataset'}</h3>
        {ds.listed ? <span className="tag tag-active">Listed</span> : <span className="tag tag-neutral">Unlisted</span>}
      </div>
      <div className="row wrap" style={{ gap: 6 }}>
        <span className="tag tag-info">Rev share {(ds.revShareBps / 100).toFixed(0)}%</span>
        <span className="tag tag-neutral">v{String(ds.version)}</span>
      </div>
      <div className="row between"><span className="meta">Owner</span><Addr value={ds.owner} me={me} /></div>
      <div className="divider" style={{ margin: '4px 0' }} />
      <div className="row between">
        <div>
          <div className="meta">Unit price</div>
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
      // Tatum read node may lag fullnode finality by a checkpoint; re-fetch once
      // shortly after so the new shared object reliably shows without a tab switch.
      setTimeout(() => { invalidate('datasets'); }, 1500);
      toast.push('Dataset registered on Sui');
      setName('');
    } catch (e) {
      toast.push((e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="panel">
      <h3>Register your dataset</h3>
      <p className="meta" style={{ marginTop: 4 }}>Only anonymised, aggregated data is listed; the raw PII stays inside your own systems.</p>
      <div className="mt-m">
        <div className="field">
          <label>Name</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Daily product sales summary, UK" />
        </div>
        <div className="row" style={{ gap: 12 }}>
          <div className="field" style={{ flex: 1 }}>
            <label>Unit price (SUI / use)</label>
            <input className="input" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} />
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label>Revenue share (%)</label>
            <input className="input" value={revShare} onChange={(e) => setRevShare(e.target.value)} />
          </div>
        </div>
        <button className="btn btn-primary" style={{ width: '100%' }} disabled={!name || busy} onClick={submit}>
          {busy ? 'Registering…' : 'List dataset'}
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
          <h2>Dataset Marketplace</h2>
          <p className="meta">Verifiable retail data for brands and model training.</p>
        </div>
        <ImportIdBar
          onImport={async (id) => {
            addId('dataset', id);
            await invalidate('datasets');
          }}
        />
      </div>

      {role === 'retailer' && (account ? <RegisterPanel /> : <div className="panel meta">Connect a wallet to register a dataset.</div>)}

      {isLoading ? (
        <Skeleton rows={4} />
      ) : datasets && datasets.length > 0 ? (
        <div className="grid grid-cards">
          {datasets.map((ds) => (
            <DatasetCard key={ds.id} ds={ds} me={account?.address} />
          ))}
        </div>
      ) : (
        <Empty>No datasets yet. {role === 'retailer' ? 'Register the first one above.' : 'Import an id or ask a provider to list one.'}</Empty>
      )}
    </div>
  );
}
