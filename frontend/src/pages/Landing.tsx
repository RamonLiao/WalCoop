import { useRole, ROLE_LABELS, type Role } from '../state/RoleContext';
import type { View } from '../components/Layout';
import { DataFlowArt } from '../components/DataFlowArt';

const STEPS = [
  { n: '01', t: '上架你的資料集', d: '把匿名化、聚合後的銷售資料加密上傳，在 Sui 上註冊成可驗證的資料資產。' },
  { n: '02', t: '品牌建立資料方案', d: '挑選多家零售商的資料、設定預算與用途，付款後取得有期限的使用授權。' },
  { n: '03', t: '結算與透明分潤', d: '模型訓練完成後，分潤依鏈上規則自動拆給每位資料供應者，紀錄不可竄改。' },
];

const ROLE_PITCH: Record<Role, string> = {
  retailer: '把你貢獻的每一筆數據都算清楚，分潤透明可查。',
  brand: '在多家零售夥伴間建立可驗證、可比較的資料合作。',
  provider: '合法取得多家零售匿名化資料，客戶能 audit 來源。',
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
              <span>讓零售數據成為</span>
              <span className="hero-accent">可驗證的 AI 資產</span>
              <span className="hero-sub">而不是黑盒報表</span>
            </h1>
            <p className="lead">
              WalCoop 是零售與品牌的資料合作社，在 Sui + Walrus 上結算信任。
              {' '}
              <strong>{ROLE_PITCH[role]}</strong>
            </p>
            <div className="row wrap">
              <button className="btn btn-primary" onClick={() => setView('marketplace')}>
                探索 Dataset 市集
              </button>
              <button className="btn btn-secondary" onClick={() => setView('campaigns')}>
                建立資料方案
              </button>
            </div>

            <div className="mt-l">
              <div className="meta">我是…</div>
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
              <span><i className="dot-teal" /> 零售商</span>
              <span><i className="dot-blue" /> 可驗證資料層</span>
              <span><i className="dot-blue" /> AI 模型</span>
            </div>
          </div>
        </div>
      </section>

      <section className="container section">
        <h2>WalCoop 如何運作</h2>
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
