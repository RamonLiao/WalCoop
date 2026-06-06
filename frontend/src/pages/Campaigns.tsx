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
import { Empty, Skeleton, StatusTag, ImportIdBar, Addr } from '../components/common';
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
      // Tatum read node may lag fullnode finality; re-fetch once shortly after.
      setTimeout(() => { invalidate('campaigns'); }, 1500);
      toast.push('Campaign created (awaiting payment)');
      setSelected([]);
    } catch (e) {
      toast.push((e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="panel">
      <h3>Create a campaign</h3>
      <p className="meta" style={{ marginTop: 4 }}>Pick the datasets you want to use and name the model provider.</p>
      <div className="mt-m">
        <AddressSelect label="Model provider" value={provider} onChange={setProvider} />
      </div>
      <div className="field">
        <label>Select datasets ({selected.length})</label>
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
          {(!datasets || datasets.length === 0) && <span className="meta">No datasets in the marketplace yet.</span>}
        </div>
      </div>
      <div className="row between">
        <span className="meta">Floor total <strong>{toSui(floor)} SUI</strong></span>
        <button className="btn btn-primary" disabled={!provider.startsWith('0x') || selected.length === 0 || busy} onClick={submit}>
          {busy ? 'Creating…' : 'Create campaign'}
        </button>
      </div>
    </div>
  );
}

function CampaignCard({ c, onViewReport }: { c: Campaign; onViewReport: (id: string) => void }) {
  const client = useDataCoopClient();
  const exec = useExecute();
  const invalidate = useInvalidate();
  const toast = useToast();
  const account = useCurrentAccount();
  const { role } = useRole();
  const [amount, setAmount] = useState(toSui(c.priceFloor || 1n));
  const [capId, setCapId] = useState('');
  const [busy, setBusy] = useState(false);
  const [usageId, setUsageId] = useState<string>('');
  const [payoutIds, setPayoutIds] = useState<string[]>([]);

  const isBuyer = account?.address === c.buyer;
  const isProvider = account?.address === c.modelProvider;

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
      await invalidate('campaigns');
      setTimeout(() => { invalidate('campaigns'); }, 1500);
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
      toast.push('Paid and access licence issued');
    });

  const cancel = () =>
    run(async () => {
      await exec((tx) => client.cancelCampaign(tx, c.id));
      toast.push('Campaign cancelled, budget refunded');
    });

  const settle = () =>
    run(async () => {
      const { createdDetailed } = await exec((tx) =>
        client.settleCampaign(tx, {
          providerCapId: capId,
          campaignId: c.id,
          orderedDatasetIds: c.datasetIds,
          usageStatsHash: enc(`stats:${c.id}`),
          reportBlobId: enc(`walrus:report:${c.id}`),
        }),
      );
      // UsageRecord is frozen (Immutable); payout Coins are address-owned.
      setUsageId(createdDetailed.find((o) => o.owner === 'Immutable')?.id ?? '');
      setPayoutIds(createdDetailed.filter((o) => o.owner === 'Address').map((o) => o.id));
      toast.push('Settlement complete, revenue share recorded on-chain');
    });

  return (
    <div className="card col" style={{ gap: 12 }}>
      <div className="row between">
        <div className="col" style={{ gap: 2 }}>
          <span className="meta">Campaign</span>
          <Addr value={c.id} />
        </div>
        <StatusTag status={c.status} />
      </div>
      <div className="stat-row" style={{ gap: 10 }}>
        <div><div className="meta">Budget</div><strong>{toSui(c.budget)} SUI</strong></div>
        <div><div className="meta">Datasets</div><strong>{c.datasetIds.length}</strong></div>
        <div><div className="meta">Floor</div><strong>{toSui(c.priceFloor)} SUI</strong></div>
      </div>
      <div className="divider" />
      <div className="row between"><span className="meta">Buyer</span><Addr value={c.buyer} me={account?.address} /></div>
      <div className="row between"><span className="meta">Model provider</span><Addr value={c.modelProvider} me={account?.address} /></div>

      {role === 'brand' && isBuyer && c.status === CampaignStatus.Pending && (
        <div className="row" style={{ gap: 8 }}>
          <input className="input" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <button className="btn btn-primary btn-sm" disabled={busy} onClick={fundAndAuthorize}>Pay &amp; authorise</button>
        </div>
      )}
      {role === 'brand' && isBuyer && c.status === CampaignStatus.Active && (
        <button className="btn btn-secondary btn-sm" disabled={busy} onClick={cancel}>Cancel &amp; refund</button>
      )}
      {role === 'provider' && isProvider && c.status === CampaignStatus.Active && (
        <div className="col" style={{ gap: 8 }}>
          <CapSelect kind="ProviderCap" label="Which ProviderCap to settle with" value={capId} onChange={setCapId} />
          <button className="btn btn-primary btn-sm" disabled={busy || !capId.startsWith('0x')} onClick={settle}>Settle revenue share</button>
        </div>
      )}
      {usageId && (
        <div className="panel mt-m" style={{ background: 'var(--bg-700)' }}>
          <div className="row between">
            <div className="col" style={{ gap: 2 }}>
              <span className="meta">UsageRecord (revenue-share receipt)</span>
              <Addr value={usageId} />
            </div>
            <button className="btn btn-primary btn-sm" onClick={() => onViewReport(usageId)}>
              View revenue breakdown →
            </button>
          </div>
          {payoutIds.length > 0 && (
            <div className="meta mt-s">
              {payoutIds.length} payout(s) also sent to provider wallets (Coin objects, not receipts).
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function Campaigns({ onViewReport }: { onViewReport: (id: string) => void }) {
  const { role } = useRole();
  const account = useCurrentAccount();
  const { data: campaigns, isLoading } = useCampaigns();
  const invalidate = useInvalidate();

  return (
    <div className="grid" style={{ gap: 28 }}>
      <div className="row between wrap">
        <div>
          <h2>Campaigns</h2>
          <p className="meta">Create, pay, authorise and settle — every step auditable on-chain.</p>
        </div>
        <ImportIdBar onImport={async (id) => { addId('campaign', id); await invalidate('campaigns'); }} />
      </div>

      {role === 'brand' && (account ? <CreatePanel /> : <div className="panel meta">Connect a wallet to create a campaign.</div>)}

      {isLoading ? (
        <Skeleton rows={4} />
      ) : campaigns && campaigns.length > 0 ? (
        <div className="grid grid-cards">
          {campaigns.map((c) => (
            <CampaignCard key={c.id} c={c} onViewReport={onViewReport} />
          ))}
        </div>
      ) : (
        <Empty>No campaigns yet. {role === 'brand' ? 'Create the first one above.' : 'Import a campaign id to view it.'}</Empty>
      )}
    </div>
  );
}
