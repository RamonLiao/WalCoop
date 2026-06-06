import { useState, type ReactNode } from 'react';
import { CampaignStatus } from '../contracts';
import { short } from '../lib/format';

/** Human-friendly address chip: short form, "(我)" if it's the connected
 * wallet, full address on hover, click to copy. */
export function Addr({ value, me }: { value: string; me?: string }) {
  const [copied, setCopied] = useState(false);
  if (!value) return <span className="meta">—</span>;
  const isMe = !!me && value.toLowerCase() === me.toLowerCase();
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      /* clipboard blocked — full value is in the title tooltip */
    }
  };
  return (
    <span
      className="mono addr-chip"
      title={`${value}（點擊複製）`}
      onClick={copy}
      style={{ cursor: 'pointer' }}
    >
      {copied ? '已複製' : short(value)}
      {isMe && <span className="tag tag-info" style={{ marginLeft: 6 }}>我</span>}
    </span>
  );
}

export function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="stat">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
    </div>
  );
}

const STATUS_META: Record<CampaignStatus, { cls: string; text: string }> = {
  [CampaignStatus.Pending]: { cls: 'tag-warn', text: '待付款' },
  [CampaignStatus.Active]: { cls: 'tag-active', text: '進行中' },
  [CampaignStatus.Settled]: { cls: 'tag-info', text: '已結算' },
  [CampaignStatus.Cancelled]: { cls: 'tag-neutral', text: '已取消' },
};

export function StatusTag({ status }: { status: CampaignStatus }) {
  const m = STATUS_META[status] ?? STATUS_META[CampaignStatus.Pending];
  return <span className={`tag ${m.cls}`}>{m.text}</span>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="center-empty">{children}</div>;
}

export function Skeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="grid" style={{ gap: 10 }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="skeleton" style={{ width: `${90 - i * 8}%` }} />
      ))}
    </div>
  );
}

/** Show newly-created object ids from a tx with a copy button, so the user
 * doesn't have to open an explorer to grab e.g. a ProviderCap / UsageRecord id. */
export function CreatedIds({ label, ids }: { label: string; ids: string[] }) {
  const [copied, setCopied] = useState<string | null>(null);
  if (ids.length === 0) return null;
  const copy = async (id: string) => {
    try {
      await navigator.clipboard.writeText(id);
      setCopied(id);
      setTimeout(() => setCopied((c) => (c === id ? null : c)), 1500);
    } catch {
      /* clipboard blocked (insecure context) — id is still selectable on screen */
    }
  };
  return (
    <div className="panel mt-m" style={{ background: 'var(--bg-700)' }}>
      <div className="meta">{label}</div>
      {ids.map((id) => (
        <div key={id} className="row between mt-s" style={{ gap: 8 }}>
          <span className="mono" style={{ wordBreak: 'break-all', fontSize: 13 }}>{id}</span>
          <button className="btn btn-secondary btn-sm" style={{ flexShrink: 0 }} onClick={() => copy(id)}>
            {copied === id ? '已複製' : '複製'}
          </button>
        </div>
      ))}
    </div>
  );
}

/** Import a shared-object id into the local discovery registry. */
export function ImportIdBar({ onImport }: { onImport: (id: string) => void }) {
  const [id, setId] = useState('');
  return (
    <div className="row" style={{ gap: 8 }}>
      <input
        className="input"
        placeholder="貼上 object id 匯入 (0x…)"
        value={id}
        onChange={(e) => setId(e.target.value)}
      />
      <button
        className="btn btn-secondary btn-sm"
        disabled={!id.startsWith('0x')}
        onClick={() => {
          onImport(id.trim());
          setId('');
        }}
      >
        匯入
      </button>
    </div>
  );
}
