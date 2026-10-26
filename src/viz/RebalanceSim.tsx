import { useMemo, useState } from 'react';
import { Controls, Seg, Stat } from './ui';

/**
 * Rebalancing (pp. 201-204): how many keys move when a node is added, under hash mod N vs a fixed
 * number of partitions (Figure 6-6) vs a consistent-hashing ring with one range per node.
 */
type Strategy = 'mod' | 'fixed' | 'ring';
const KEYS = 2000;
const PARTS = 20;

function hash(i: number) {
  let x = (i + 1) * 2654435761;
  x = (x ^ (x >>> 16)) >>> 0;
  x = Math.imul(x, 0x45d9f3b) >>> 0;
  return (x ^ (x >>> 16)) >>> 0;
}

/** fixed partitions: assign partitions round-robin initially; when adding node, steal evenly (Figure 6-6) */
function fixedAssignment(nodes: number): number[] {
  let assign = Array.from({ length: PARTS }, (_, p) => p % 4);
  for (let n = 4; n < nodes; n++) {
    const target = Math.floor(PARTS / (n + 1));
    const counts = Array(n).fill(0);
    assign.forEach((a) => counts[a]++);
    let stolen = 0;
    assign = assign.map((a) => {
      if (stolen < target && counts[a] > Math.ceil(PARTS / (n + 1))) { counts[a]--; stolen++; return n; }
      return a;
    });
    // if still short, steal from the largest
    while (stolen < target) {
      const big = counts.indexOf(Math.max(...counts));
      const idx = assign.findIndex((a) => a === big);
      assign[idx] = n; counts[big]--; stolen++;
    }
  }
  return assign;
}

function ringPoints(nodes: number) {
  // one random token per node (Cassandra < 1.2 style)
  return Array.from({ length: nodes }, (_, n) => ({ node: n, token: hash(n * 7919 + 13) }));
}
function ringOwner(h: number, pts: { node: number; token: number }[]) {
  const sorted = [...pts].sort((a, b) => a.token - b.token);
  for (const p of sorted) if (h <= p.token) return p.node;
  return sorted[0].node;
}

function owners(strategy: Strategy, nodes: number) {
  const out: number[] = [];
  if (strategy === 'mod') for (let k = 0; k < KEYS; k++) out.push(hash(k) % nodes);
  else if (strategy === 'fixed') {
    const a = fixedAssignment(nodes);
    for (let k = 0; k < KEYS; k++) out.push(a[hash(k) % PARTS]);
  } else {
    const pts = ringPoints(nodes);
    for (let k = 0; k < KEYS; k++) out.push(ringOwner(hash(k), pts));
  }
  return out;
}

export default function RebalanceSim() {
  const [strategy, setStrategy] = useState<Strategy>('fixed');
  const [nodes, setNodes] = useState(4);
  const before = useMemo(() => owners(strategy, nodes), [strategy, nodes]);
  const after = useMemo(() => owners(strategy, nodes + 1), [strategy, nodes]);
  const moved = before.filter((o, i) => o !== after[i]).length;
  const ideal = KEYS / (nodes + 1);
  const loadAfter = Array(nodes + 1).fill(0);
  after.forEach((o) => loadAfter[o]++);
  const maxLoad = Math.max(...loadAfter);
  const fixedA = strategy === 'fixed' ? fixedAssignment(nodes) : [];
  const fixedB = strategy === 'fixed' ? fixedAssignment(nodes + 1) : [];

  return (
    <div>
      <Controls>
        <Seg value={strategy} onChange={setStrategy} options={[
          { value: 'mod', label: 'hash mod N (how not to)' },
          { value: 'fixed', label: `fixed ${PARTS} partitions` },
          { value: 'ring', label: 'one hash range per node' },
        ]} />
        <span className="small muted">cluster:</span>
        <button className="btn sm" disabled={nodes <= 4} onClick={() => setNodes(nodes - 1)}>−</button>
        <b>{nodes} → {nodes + 1} nodes</b>
        <button className="btn sm" disabled={nodes >= 9} onClick={() => setNodes(nodes + 1)}>+</button>
      </Controls>
      {strategy === 'fixed' && (
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${nodes + 1}, 1fr)`, gap: 6, marginBottom: 8 }}>
          {Array.from({ length: nodes + 1 }, (_, n) => (
            <div key={n} style={{ border: '1px solid var(--line)', borderRadius: 8, padding: 6, background: 'var(--v-fill)', minHeight: 60 }}>
              <div className="small" style={{ fontWeight: 700 }}>Node {n}{n === nodes ? ' (new)' : ''}</div>
              {fixedB.map((a, p) => (a === n ? <span key={p} className={`chip ${fixedA[p] !== a ? 'd' : ''}`} style={{ fontSize: 11 }}>p{p}</span> : null))}
            </div>
          ))}
        </div>
      )}
      <svg viewBox="0 0 720 120" aria-label="Load per node after adding a node">
        {loadAfter.map((l, n) => {
          const w = 700 / (nodes + 1);
          const h = (l / Math.max(maxLoad, ideal * 1.6)) * 80;
          return (
            <g key={n}>
              <rect x={10 + n * w} y={90 - h} width={w - 10} height={h} rx={4} fill={n === nodes ? 'var(--v-b)' : 'var(--v-a)'} />
              <text x={10 + n * w + (w - 10) / 2} y={106} textAnchor="middle" fontSize={11}>node {n}: {l}</text>
            </g>
          );
        })}
        <line x1={10} x2={710} y1={90 - (ideal / Math.max(maxLoad, ideal * 1.6)) * 80} y2={90 - (ideal / Math.max(maxLoad, ideal * 1.6)) * 80} stroke="var(--v-c)" strokeDasharray="5 4" />
      </svg>
      <Stat label="Keys that must move" value={`${moved} of ${KEYS} (${Math.round((moved / KEYS) * 100)}%)`} tone={moved / KEYS > 0.5 ? 'bad' : 'good'} />
      <Stat label="Minimum possible" value={`${Math.round((1 / (nodes + 1)) * 100)}%`} />
      <Stat label="Busiest node after" value={`${(maxLoad / ideal).toFixed(2)}× fair share`} tone={maxLoad / ideal > 1.5 ? 'bad' : 'good'} />
      <div className="hint">
        {strategy === 'mod' && 'Changing N changes hash mod N for most keys: almost everything moves (p. 201–202).'}
        {strategy === 'fixed' && 'Only whole partitions move (red chips), and only to the new node; key→partition never changes (Figure 6-6). The partition count caps the cluster size.'}
        {strategy === 'ring' && 'One big random range per node: few keys move, but load is badly uneven, and the new node takes data from just one neighbour — why Cassandra abandoned it in 1.2 (p. 204).'}
      </div>
    </div>
  );
}
