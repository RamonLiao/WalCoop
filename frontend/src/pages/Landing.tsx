import { useRole, ROLE_LABELS, type Role } from '../state/RoleContext';
import type { View } from '../components/Layout';
import { DataFlowArt } from '../components/DataFlowArt';

const STEPS = [
  { n: '01', t: 'List your dataset', d: 'Encrypt and upload your anonymised, aggregated sales data, then register it on Sui as a verifiable data asset.' },
  { n: '02', t: 'Brands create a campaign', d: 'Pick datasets from multiple retailers, set a budget and purpose, then pay to receive a time-limited access licence.' },
  { n: '03', t: 'Settle with transparent revenue share', d: 'Once model training is done, revenue is split automatically to every data provider by on-chain rules, with tamper-proof records.' },
];

const ROLE_PITCH: Record<Role, string> = {
  retailer: 'Every record you contribute is accounted for, with a transparent and auditable revenue share.',
  brand: 'Build verifiable, comparable data partnerships across multiple retail partners.',
  provider: 'Legally source anonymised data from multiple retailers, with provenance your clients can audit.',
};

export function Landing({ setView }: { setView: (v: View) => void }) {
  const { role, setRole } = useRole();

  return (
    <>
      <section className="hero">
        <div className="container hero-inner">
          <div>
            <span className="tag tag-active">Sui + Walrus · Testnet</span>
            <h1 className="hero-title mt-s">
              <span>Turn retail data into a</span>
              <span className="hero-accent">verifiable AI asset</span>
              <span className="hero-sub">not a black-box report</span>
            </h1>
            <p className="lead">
              WalCoop is a data co-operative for retailers and brands, settling trust on Sui + Walrus.
              {' '}
              <strong>{ROLE_PITCH[role]}</strong>
            </p>
            <div className="row wrap">
              <button className="btn btn-primary" onClick={() => setView('marketplace')}>
                Explore the Dataset Marketplace
              </button>
              <button className="btn btn-secondary" onClick={() => setView('campaigns')}>
                Create a campaign
              </button>
            </div>

            <div className="mt-l">
              <div className="meta">I am a…</div>
              <div className="row wrap mt-s">
                {(Object.keys(ROLE_LABELS) as Role[]).map((r) => (
                  <button
                    key={r}
                    className={`btn btn-sm ${role === r ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setRole(r)}
                  >
                    {ROLE_LABELS[r]}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="hero-visual">
            <DataFlowArt />
            <div className="hero-visual-cap">
              <span><i className="dot-teal" /> Retailers</span>
              <span><i className="dot-blue" /> Verifiable data layer</span>
              <span><i className="dot-blue" /> AI models</span>
            </div>
          </div>
        </div>
      </section>

      <section className="container section">
        <h2>How WalCoop works</h2>
        <div className="grid grid-cards mt-l">
          {STEPS.map((s) => (
            <div key={s.n} className="card">
              <div className="value mono" style={{ color: 'var(--wc-blue)', fontSize: 22 }}>{s.n}</div>
              <h3 className="mt-s">{s.t}</h3>
              <p className="muted mt-s" style={{ marginBottom: 0 }}>{s.d}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
