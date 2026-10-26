import { useMemo, useState } from 'react';
import { Controls, Seg, Slider, Stat, rng } from './ui';

function percentile(sorted: number[], p: number) {
  // nearest-rank method
  const rank = Math.ceil((p / 100) * sorted.length);
  return sorted[Math.min(sorted.length - 1, Math.max(0, rank - 1))];
}

function sample(n: number, slowPct: number, seed: number) {
  const r = rng(seed);
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    // log-normal-ish body around 80ms
    const z = (r() + r() + r() + r() - 2) * 1.7;
    let v = 80 * Math.exp(0.35 * z);
    if (r() < slowPct / 100) v = 600 + r() * 2400; // GC pause, retransmit, disk fault...
    out.push(Math.round(v));
  }
  return out;
}

export default function PercentileSim() {
  const [slow, setSlow] = useState(3);
  const [seed, setSeed] = useState(3);
  const [order, setOrder] = useState<'arrival' | 'sorted'>('arrival');
  const [fan, setFan] = useState(10);
  const data = useMemo(() => sample(100, slow, seed), [slow, seed]);
  const sorted = useMemo(() => [...data].sort((a, b) => a - b), [data]);
  const mean = data.reduce((a, b) => a + b, 0) / data.length;
  const p50 = percentile(sorted, 50), p95 = percentile(sorted, 95), p99 = percentile(sorted, 99);
  const shown = order === 'sorted' ? sorted : data;
  const max = Math.max(...data, 400);
  const W = 720, H = 220, bw = W / shown.length;
  const y = (v: number) => H - (v / max) * H;

  // tail latency amplification: probability one backend call is "slow" (slower than this service's p99)
  const pSlowCall = 0.01;
  const pUserSlow = 1 - Math.pow(1 - pSlowCall, fan);
  const CW = 720, CH = 140;
  const curve = Array.from({ length: 101 }, (_, n) => [n, 1 - Math.pow(1 - pSlowCall, Math.max(1, n))] as const);

  const lines = [
    { v: mean, label: 'mean', color: 'var(--v-c)' },
    { v: p50, label: 'p50 (median)', color: 'var(--v-b)' },
    { v: p95, label: 'p95', color: 'var(--v-a)' },
    { v: p99, label: 'p99', color: 'var(--v-d)' },
  ];

  return (
    <div>
      <Controls>
        <Slider label="Slow outliers" value={slow} min={0} max={20} onChange={setSlow} fmt={(v) => `${v}%`} />
        <Seg value={order} onChange={setOrder} options={[{ value: 'arrival', label: 'Arrival order' }, { value: 'sorted', label: 'Sorted' }]} />
        <button className="btn sm" onClick={() => setSeed(seed + 1)}>New sample</button>
      </Controls>
      <svg viewBox={`0 0 ${W} ${H + 8}`} aria-label="Response times of 100 requests with mean and percentiles">
        {shown.map((v, i) => (
          <rect key={i} x={i * bw + 0.5} y={y(v)} width={bw - 1} height={H - y(v)} rx={1}
            fill={v >= p99 ? 'var(--v-d)' : v >= p95 ? 'color-mix(in srgb, var(--v-a) 55%, var(--v-muted))' : 'var(--v-muted)'} />
        ))}
        {lines.map((l) => (
          <g key={l.label}>
            <line x1={0} x2={W} y1={y(l.v)} y2={y(l.v)} stroke={l.color} strokeWidth={1.6} strokeDasharray="6 4" />
            <text x={W - 4} y={y(l.v) - 4} textAnchor="end" fontSize={12} style={{ fill: l.color, fontWeight: 600 }}>{l.label} {Math.round(l.v)} ms</text>
          </g>
        ))}
      </svg>
      <div style={{ marginTop: 6 }}>
        <Stat label="mean" value={`${Math.round(mean)} ms`} />
        <Stat label="median" value={`${p50} ms`} />
        <Stat label="p95" value={`${p95} ms`} />
        <Stat label="p99" value={`${p99} ms`} tone="bad" />
        <Stat label="requests slower than mean" value={`${data.filter((v) => v > mean).length}/100`} />
      </div>
      <div className="hint">Drag “Slow outliers” up: the median barely moves, the mean drifts upward (it describes no real request), and p95/p99 jump. Percentiles tell you how many users waited how long.</div>

      <hr style={{ border: 0, borderTop: '1px solid var(--line)', margin: '18px 0' }} />
      <div className="eyebrow">Tail latency amplification</div>
      <Controls>
        <Slider label="Backend calls per page" value={fan} min={1} max={100} onChange={setFan} />
      </Controls>
      <p className="small" style={{ margin: '4px 0 8px' }}>
        Each backend call has a 1% chance of being slower than its own p99. A page that waits for <b>{fan}</b> parallel calls is slow if <em>any</em> of them is slow:
        1 − 0.99<sup>{fan}</sup> = <b style={{ color: 'var(--bad)' }}>{(pUserSlow * 100).toFixed(1)}%</b> of page loads.
      </p>
      <svg viewBox={`0 0 ${CW} ${CH + 20}`} aria-label="Probability that a page is slow versus number of backend calls">
        <polyline fill="none" stroke="var(--v-d)" strokeWidth={2}
          points={curve.map(([n, p]) => `${(n / 100) * CW},${CH - p * CH}`).join(' ')} />
        <circle cx={(fan / 100) * CW} cy={CH - pUserSlow * CH} r={6} fill="var(--v-d)" />
        <line x1={0} x2={CW} y1={CH} y2={CH} stroke="var(--v-muted)" />
        <text x={2} y={CH + 16} fontSize={12} style={{ fill: 'var(--ink-3)' }}>1 call</text>
        <text x={CW - 2} y={CH + 16} fontSize={12} textAnchor="end" style={{ fill: 'var(--ink-3)' }}>100 calls → 63%</text>
      </svg>
    </div>
  );
}
