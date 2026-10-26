import { useMemo, useState } from 'react';
import { Controls, Seg, Slider } from './ui';

/**
 * Figure 5-8 topologies and Figure 5-9's causality problem. Leader 1 inserts x=1; leader 3 updates it
 * (x=x+1) as soon as the insert arrives there. With all-to-all, a slow link 1→2 lets the update
 * overtake the insert at leader 2. In circular/star topologies, a dead node blocks propagation.
 */
type Topo = 'circular' | 'star' | 'all';
const N = 4;
const POS = [[110, 40], [330, 40], [330, 170], [110, 170]] as const;

function links(topo: Topo): [number, number][] {
  if (topo === 'circular') return [[0, 1], [1, 2], [2, 3], [3, 0]];
  if (topo === 'star') return [[0, 1], [1, 0], [0, 2], [2, 0], [0, 3], [3, 0]];
  const out: [number, number][] = [];
  for (let a = 0; a < N; a++) for (let b = 0; b < N; b++) if (a !== b) out.push([a, b]);
  return out;
}

/** earliest arrival time of a write originating at `src` at time t0, flooding along links (nodes forward). */
function arrivals(topo: Topo, src: number, t0: number, delay: (a: number, b: number) => number, dead: number | null) {
  const t: (number | null)[] = Array(N).fill(null);
  if (src === dead) return t;
  t[src] = t0;
  const L = links(topo);
  for (let iter = 0; iter < N; iter++) {
    for (const [a, b] of L) {
      if (t[a] === null || a === dead || b === dead) continue;
      // in circular/star, writes are forwarded; in all-to-all, only the origin sends (no forwarding needed)
      if (topo === 'all' && a !== src) continue;
      const cand = t[a]! + delay(a, b);
      if (t[b] === null || cand < t[b]!) t[b] = cand;
    }
  }
  return t;
}

export default function TopologySim() {
  const [topo, setTopo] = useState<Topo>('all');
  const [slow, setSlow] = useState(400);   // delay of link 1→2 (leader indices 0→1)
  const [dead, setDead] = useState<number | null>(null);
  const delay = (a: number, b: number) => (a === 0 && b === 1 ? slow : 100);

  const { ins, upd } = useMemo(() => {
    const ins = arrivals(topo, 0, 0, delay, dead);
    const updStart = ins[2];                          // leader 3 updates as soon as it sees the insert
    const upd = updStart === null ? Array(N).fill(null) : arrivals(topo, 2, updStart + 20, delay, dead);
    return { ins, upd };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topo, slow, dead]);

  const status = (i: number) => {
    if (i === dead) return { text: 'DEAD', tone: 'bad' as const };
    if (ins[i] === null && upd[i] === null) return { text: 'received nothing', tone: 'bad' as const };
    if (ins[i] === null) return { text: 'update without insert!', tone: 'bad' as const };
    if (upd[i] === null) return { text: `insert @${ins[i]}ms, no update`, tone: 'warn' as const };
    if (upd[i]! < ins[i]!) return { text: `update @${upd[i]} BEFORE insert @${ins[i]}`, tone: 'bad' as const };
    return { text: `insert @${ins[i]}, update @${upd[i]}`, tone: 'good' as const };
  };

  return (
    <div>
      <Controls>
        <Seg value={topo} onChange={setTopo} options={[{ value: 'circular', label: '(a) circular' }, { value: 'star', label: '(b) star' }, { value: 'all', label: '(c) all-to-all' }]} />
        <Slider label="delay of link L1→L2" value={slow} min={50} max={800} step={10} onChange={setSlow} fmt={(v) => `${v} ms`} />
      </Controls>
      <Controls>
        <span className="small muted">Kill a node:</span>
        {[null, 1, 3].map((d) => (
          <button key={String(d)} className={`btn sm ${dead === d ? 'primary' : ''}`} onClick={() => setDead(d)}>{d === null ? 'none' : `L${d + 1}`}</button>
        ))}
      </Controls>
      <svg viewBox="0 0 440 210">
        <defs>
          <marker id="topo-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill="var(--ink-3)" />
          </marker>
        </defs>
        {links(topo).map(([a, b], k) => {
          const [x1, y1] = POS[a], [x2, y2] = POS[b];
          const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy);
          const ox = (-dy / len) * 5, oy = (dx / len) * 5;
          const isSlow = a === 0 && b === 1;
          return <line key={k} x1={x1 + ox + dx * 0.14} y1={y1 + oy + dy * 0.14} x2={x2 + ox - dx * 0.14} y2={y2 + oy - dy * 0.14}
            stroke={a === dead || b === dead ? 'var(--v-muted)' : isSlow ? 'var(--v-d)' : 'var(--ink-3)'} strokeWidth={isSlow ? 2.2 : 1.3}
            strokeDasharray={a === dead || b === dead ? '4 4' : undefined} markerEnd="url(#topo-arrow)" />;
        })}
        {POS.map(([cx, cy], i) => {
          const s = status(i);
          return (
            <g key={i}>
              <circle cx={cx} cy={cy} r={24} fill={i === dead ? 'var(--v-muted)' : 'var(--surface)'} stroke={s.tone === 'bad' ? 'var(--v-d)' : s.tone === 'good' ? 'var(--v-b)' : 'var(--v-c)'} strokeWidth={2} />
              <text x={cx} y={cy + 5} textAnchor="middle" fontWeight={700}>L{i + 1}</text>
            </g>
          );
        })}
      </svg>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 4 }}>
        {POS.map((_, i) => {
          const s = status(i);
          return <div key={i} className="small"><b>L{i + 1}:</b> <span style={{ color: s.tone === 'bad' ? 'var(--bad)' : s.tone === 'good' ? 'var(--good)' : 'var(--warn)' }}>{s.text}</span></div>;
        })}
      </div>
      <div className="hint">L1 inserts x=1 at t=0; L3 runs “x = x + 1” 20 ms after it sees the insert. All-to-all: raise the L1→L2 delay above ~220 ms and L2 receives the update first. Circular/star: kill a node and others stop receiving writes.</div>
    </div>
  );
}
