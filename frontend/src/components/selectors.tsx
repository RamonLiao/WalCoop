import { useEffect, useState } from 'react';
import { useOwnedCaps, useCurrentAccount } from '../hooks/useDataCoop';
import { short } from '../lib/format';

/**
 * Dropdown of capability objects (PublisherCap / ProviderCap) owned by the
 * connected wallet, so users pick instead of pasting an id. Auto-selects the
 * sole cap when there's exactly one.
 */
export function CapSelect({
  kind,
  value,
  onChange,
  label,
}: {
  kind: 'PublisherCap' | 'ProviderCap';
  value: string;
  onChange: (id: string) => void;
  label: string;
}) {
  const { data: caps, isLoading } = useOwnedCaps(kind);
  const list = caps ?? [];

  // Auto-pick when there's exactly one and nothing chosen yet.
  useEffect(() => {
    if (!value && list.length === 1) onChange(list[0].id);
  }, [value, list, onChange]);

  return (
    <div className="field">
      <label>{label}</label>
      {isLoading ? (
        <div className="input meta">Loading…</div>
      ) : list.length === 0 ? (
        <div className="input meta">This wallet has no available {kind}</div>
      ) : (
        <select className="select" value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="" disabled>
            Select a {kind}…
          </option>
          {list.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}

/**
 * Address picker: defaults to "我自己 (connected wallet)" with a fallback to
 * manual paste. Keeps single-wallet demos one-click while staying flexible.
 */
export function AddressSelect({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (addr: string) => void;
  label: string;
}) {
  const account = useCurrentAccount();
  const me = account?.address ?? '';
  const [manual, setManual] = useState(false);

  const mode = manual || (value && value !== me) ? 'manual' : 'me';

  // Default to "me": push the connected address up so the value is real, not
  // just visually selected. Without this the parent stays '' and gates submit.
  useEffect(() => {
    if (!manual && me && value !== me) onChange(me);
  }, [manual, me, value, onChange]);

  return (
    <div className="field">
      <label>{label}</label>
      <select
        className="select"
        value={mode}
        onChange={(e) => {
          if (e.target.value === 'me') {
            setManual(false);
            onChange(me);
          } else {
            setManual(true);
            onChange('');
          }
        }}
      >
        <option value="me" disabled={!me}>
          Myself{me ? ` (${short(me)})` : ' (connect a wallet first)'}
        </option>
        <option value="manual">Enter another address manually…</option>
      </select>
      {mode === 'manual' && (
        <input
          className="input mono mt-s"
          value={value}
          onChange={(e) => onChange(e.target.value.trim())}
          placeholder="0x…"
        />
      )}
    </div>
  );
}
