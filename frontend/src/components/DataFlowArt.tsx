// Hero "資料路徑" — retail nodes stream data through the WalCoop core into AI.
// On-brand (TRON-style data path), CSS-animated, no external assets.
export function DataFlowArt() {
  const retail = [
    { x: 64, y: 84 },
    { x: 48, y: 200 },
    { x: 64, y: 316 },
  ];
  const core = { x: 240, y: 200 };
  const ai = { x: 414, y: 200 };
  const hexR = 46; // flat-to-flat ≈ 80px so the "WalCoop" label has side margin

  const path = (a: { x: number; y: number }, b: { x: number; y: number }) =>
    `M ${a.x} ${a.y} C ${(a.x + b.x) / 2 + 20} ${a.y}, ${(a.x + b.x) / 2 - 20} ${b.y}, ${b.x} ${b.y}`;

  return (
    <svg className="data-flow" viewBox="0 0 470 400" role="img" aria-label="Data flows from retailers through the WalCoop core into AI">
      <defs>
        <radialGradient id="coreGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#1b7fff" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#1b7fff" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="edge" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#12c3a6" />
          <stop offset="100%" stopColor="#1b7fff" />
        </linearGradient>
        <filter id="soft"><feGaussianBlur stdDeviation="6" /></filter>
      </defs>

      {/* edges retail -> core */}
      {retail.map((r, i) => (
        <g key={i}>
          <path d={path(r, core)} stroke="#23304a" strokeWidth="1.5" fill="none" />
          <path
            d={path(r, core)}
            stroke="url(#edge)"
            strokeWidth="1.8"
            fill="none"
            className="flow"
            style={{ animationDelay: `${i * 0.35}s` }}
          />
        </g>
      ))}
      {/* edge core -> AI */}
      <path d={path(core, ai)} stroke="#23304a" strokeWidth="1.5" fill="none" />
      <path d={path(core, ai)} stroke="url(#edge)" strokeWidth="2" fill="none" className="flow flow-out" />

      {/* retail nodes */}
      {retail.map((r, i) => (
        <g key={`n${i}`} className="node" style={{ animationDelay: `${i * 0.4}s` }}>
          <circle cx={r.x} cy={r.y} r="13" fill="#0d1220" stroke="#2b3445" strokeWidth="1.5" />
          <rect x={r.x - 5} y={r.y - 4} width="10" height="8" rx="1.5" fill="none" stroke="#a5aec4" strokeWidth="1.3" />
          <path d={`M ${r.x - 6} ${r.y - 4} L ${r.x} ${r.y - 8} L ${r.x + 6} ${r.y - 4}`} fill="none" stroke="#a5aec4" strokeWidth="1.3" />
        </g>
      ))}

      {/* core */}
      <circle cx={core.x} cy={core.y} r={hexR + 22} fill="url(#coreGlow)" className="core-glow" />
      <g>
        <polygon
          points={hexPoints(core.x, core.y, hexR)}
          fill="#0b1220"
          stroke="url(#edge)"
          strokeWidth="2"
        />
        <text x={core.x} y={core.y + 4.5} textAnchor="middle" className="core-label">WalCoop</text>
      </g>

      {/* AI node */}
      <circle cx={ai.x} cy={ai.y} r="22" fill="#0d1220" stroke="#1b7fff" strokeWidth="1.8" />
      <circle cx={ai.x} cy={ai.y} r="22" fill="none" stroke="#1b7fff" strokeWidth="1.8" className="ai-ring" filter="url(#soft)" />
      <text x={ai.x} y={ai.y + 5} textAnchor="middle" className="ai-label">AI</text>
    </svg>
  );
}

function hexPoints(cx: number, cy: number, r: number): string {
  return Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i - Math.PI / 6;
    return `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`;
  }).join(' ');
}
