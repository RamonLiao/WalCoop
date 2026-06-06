import type { ReactNode } from 'react';
import { ConnectButton } from '@mysten/dapp-kit-react/ui';
import { useRole, ROLE_LABELS, type Role } from '../state/RoleContext';
import { usingTatum } from '../dapp-kit';

export type View = 'home' | 'marketplace' | 'campaigns' | 'reports';

const NAV: { key: View; label: string }[] = [
  { key: 'home', label: 'Home' },
  { key: 'marketplace', label: 'Dataset Marketplace' },
  { key: 'campaigns', label: 'Campaigns' },
  { key: 'reports', label: 'Usage Records' },
];

const ROLES: Role[] = ['retailer', 'brand', 'provider'];

export function Layout({
  view,
  setView,
  sidebar,
  bleed,
  children,
}: {
  view: View;
  setView: (v: View) => void;
  sidebar?: ReactNode;
  bleed?: boolean;
  children: ReactNode;
}) {
  const { role, setRole } = useRole();

  return (
    <div className="app-shell">
      <nav className="topnav">
        <div className="container topnav-inner">
          <div className="brand" onClick={() => setView('home')} style={{ cursor: 'pointer' }}>
            <span className="dot" /> WalCoop
          </div>
          <div className="nav-links">
            {NAV.map((n) => (
              <span
                key={n.key}
                className={`nav-link ${view === n.key ? 'active' : ''}`}
                onClick={() => setView(n.key)}
              >
                {n.label}
              </span>
            ))}
          </div>
          <div className="nav-spacer" />
          {usingTatum && (
            <span className="tag tag-info" title="On-chain reads served via the Tatum gateway">
              Powered by Tatum
            </span>
          )}
          <select
            className="select"
            style={{ width: 'auto' }}
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
            title="Switch role"
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </select>
          <ConnectButton />
        </div>
      </nav>

      <main className={bleed ? 'bleed-main' : 'container section'}>
        {sidebar ? (
          <div className="with-sidebar">
            <aside className="sidebar">{sidebar}</aside>
            <div>{children}</div>
          </div>
        ) : (
          children
        )}
      </main>
    </div>
  );
}
