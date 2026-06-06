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
        <div className="input meta">讀取中…</div>
      ) : list.length === 0 ? (
        <div className="input meta">此錢包沒有可用的 {kind}</div>
      ) : (
        <select className="select" value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="" disabled>
            選擇一個 {kind}…
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
          我自己{me ? ` (${short(me)})` : '（請先連錢包）'}
        </option>
        <option value="manual">手動輸入其他地址…</option>
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
