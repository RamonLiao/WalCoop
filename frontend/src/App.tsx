import { useState } from 'react';
import { Layout, type View } from './components/Layout';
import { Landing } from './pages/Landing';
import { Marketplace } from './pages/Marketplace';
import { Campaigns } from './pages/Campaigns';
import { Reports } from './pages/Reports';
import { PACKAGE_ID } from './contracts';

export default function App() {
  const [view, setView] = useState<View>('home');
  // One-click "view settlement": jump to Reports with a UsageRecord id prefilled.
  const [reportId, setReportId] = useState<string>('');
  const viewReport = (id: string) => {
    setReportId(id);
    setView('reports');
  };

  if (view === 'home') {
    return (
      <Layout view={view} setView={setView} bleed>
        <Landing setView={setView} />
      </Layout>
    );
  }

  const sidebar = (
    <>
      {(['marketplace', 'campaigns', 'reports'] as View[]).map((v) => (
        <div
          key={v}
          className={`side-item ${view === v ? 'active' : ''}`}
          onClick={() => setView(v)}
        >
          {v === 'marketplace' ? 'Dataset Marketplace' : v === 'campaigns' ? 'Campaigns' : 'Usage Records'}
        </div>
      ))}
      <div className="divider" />
      <div className="meta" style={{ padding: '0 12px' }}>
        Package
        <div className="mono" style={{ fontSize: 11, wordBreak: 'break-all', color: 'var(--text-3)' }}>
          {PACKAGE_ID}
        </div>
      </div>
    </>
  );

  return (
    <Layout view={view} setView={setView} sidebar={sidebar}>
      {view === 'marketplace' && <Marketplace />}
      {view === 'campaigns' && <Campaigns onViewReport={viewReport} />}
      {view === 'reports' && <Reports initialId={reportId} />}
    </Layout>
  );
}
