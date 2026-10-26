import { useState } from 'react';
import { Controls, Seg, Stat } from './ui';

/**
 * Chapter 9, pp. 329-337.
 * Tab "hb": a space-time diagram. Click two events: are they causally ordered (happened-before) or concurrent?
 * Vector clocks answer that exactly; Lamport timestamps give a total order consistent with causality, but can't
 * tell you whether two events were concurrent.
 * Tab "lamport": Figure 9-8 — clients send writes to nodes. With "carry the max counter" on, these are Lamport
 * timestamps; off, each node just counts its own operations (like the odd/even generators on p. 335) and a
 * client's later write can get a smaller timestamp than its earlier one.
 */

// ---------- happens-before ----------

export interface Ev { id: string; p: number; t: number; kind: 'local' | 'send' | 'recv'; msg?: string; label: string }

export const HB_EVENTS: Ev[] = [
  { id: 'a1', p: 0, t: 8, kind: 'local', label: 'a' },
  { id: 'a2', p: 0, t: 24, kind: 'send', msg: 'm1', label: 'b' },
  { id: 'a3', p: 0, t: 58, kind: 'local', label: 'c' },
  { id: 'a4', p: 0, t: 90, kind: 'recv', msg: 'm3', label: 'd' },
  { id: 'b1', p: 1, t: 14, kind: 'local', label: 'e' },
  { id: 'b2', p: 1, t: 40, kind: 'recv', msg: 'm1', label: 'f' },
  { id: 'b3', p: 1, t: 50, kind: 'send', msg: 'm2', label: 'g' },
  { id: 'b4', p: 1, t: 84, kind: 'local', label: 'h' },
  { id: 'c1', p: 2, t: 20, kind: 'local', label: 'i' },
  { id: 'c2', p: 2, t: 44, kind: 'local', label: 'j' },
  { id: 'c3', p: 2, t: 66, kind: 'recv', msg: 'm2', label: 'k' },
  { id: 'c4', p: 2, t: 76, kind: 'send', msg: 'm3', label: 'l' },
];

/** Vector clocks and Lamport counters for every event (events are processed in time order). */
export function clocks(events: Ev[], nProc = 3) {
  const vc: Record<string, number[]> = {};
  const lam: Record<string, number> = {};
  const cur = Array.from({ length: nProc }, () => new Array(nProc).fill(0));
  const curL = new Array(nProc).fill(0);
  const sent: Record<string, { v: number[]; l: number }> = {};
  for (const e of [...events].sort((x, y) => x.t - y.t)) {
    const v = [...cur[e.p]];
    let l = curL[e.p];
    if (e.kind === 'recv') {
      const m = sent[e.msg!];
      for (let i = 0; i < nProc; i++) v[i] = Math.max(v[i], m.v[i]);
      l = Math.max(l, m.l);
    }
    v[e.p] += 1;
    l += 1;
    cur[e.p] = v; curL[e.p] = l;
    vc[e.id] = v; lam[e.id] = l;
    if (e.kind === 'send') sent[e.msg!] = { v, l };
  }
  return { vc, lam };
}

export function relation(a: number[], b: number[]): 'before' | 'after' | 'concurrent' | 'same' {
  const le = a.every((x, i) => x <= b[i]);
  const ge = a.every((x, i) => x >= b[i]);
  if (le && ge) return 'same';
  if (le) return 'before';
  if (ge) return 'after';
  return 'concurrent';
}

// ---------- Lamport timestamps, Figure 9-8 ----------

export interface LOp { client: 'A' | 'B'; node: 1 | 2 }
export interface LRes { client: 'A' | 'B'; node: 1 | 2; ts: [number, number] }

/** Figure 9-8's sequence: A→1, B→2 ×4, A→2, A→1, B→2 gives (1,1) (1,2)…(4,2) (5,2) (6,1) (6,2). */
export const FIG98: LOp[] = [
  { client: 'A', node: 1 }, { client: 'B', node: 2 }, { client: 'B', node: 2 }, { client: 'B', node: 2 },
  { client: 'B', node: 2 }, { client: 'A', node: 2 }, { client: 'A', node: 1 }, { client: 'B', node: 2 },
];

export function lamportRun(ops: LOp[], carry: boolean) {
  const nodeC: Record<number, number> = { 1: 0, 2: 0 };
  const clientMax: Record<string, number> = { A: 0, B: 0 };
  const res: LRes[] = [];
  for (const o of ops) {
    const base = carry ? Math.max(nodeC[o.node], clientMax[o.client]) : nodeC[o.node];
    nodeC[o.node] = base + 1;
    const ts: [number, number] = [nodeC[o.node], o.node];
    clientMax[o.client] = Math.max(clientMax[o.client], ts[0]);
    res.push({ ...o, ts });
  }
  // causality violations: a client's later operation (which saw the earlier one's result) has a smaller timestamp
  const cmp = (x: [number, number], y: [number, number]) => x[0] - y[0] || x[1] - y[1];
  const violations: [number, number][] = [];
  for (let i = 0; i < res.length; i++) for (let j = i + 1; j < res.length; j++) {
    if (res[i].client === res[j].client && cmp(res[i].ts, res[j].ts) > 0) violations.push([i, j]);
  }
  return { res, violations };
}

// ---------- UI ----------

export default function CausalityViz({ initialTab = 'hb' }: { initialTab?: 'hb' | 'lamport' }) {
  const [tab, setTab] = useState<'hb' | 'lamport'>(initialTab);
  return (
    <div>
      <Controls>
        <Seg value={tab} onChange={setTab} options={[{ value: 'hb', label: 'Happened-before' }, { value: 'lamport', label: 'Lamport timestamps (Fig 9-8)' }]} />
      </Controls>
      {tab === 'hb' ? <HbTab /> : <LamportTab />}
    </div>
  );
}

function HbTab() {
  const [sel, setSel] = useState<string[]>(['a2', 'c2']);
  const [showVc, setShowVc] = useState(true);
  const { vc, lam } = clocks(HB_EVENTS);
  const W = 660, H = 220, x0 = 60;
  const X = (t: number) => x0 + (t / 100) * (W - x0 - 20);
  const Y = (p: number) => 40 + p * 70;
  const byMsg = (m: string, k: 'send' | 'recv') => HB_EVENTS.find((e) => e.msg === m && e.kind === k)!;
  const click = (id: string) => setSel(sel.includes(id) ? sel.filter((s) => s !== id) : [...sel, id].slice(-2));
  const [x, y] = sel.map((id) => HB_EVENTS.find((e) => e.id === id)!);
  const rel = x && y ? relation(vc[x.id], vc[y.id]) : null;
  return (
    <div>
      <Controls>
        <label><input type="checkbox" checked={showVc} onChange={(e) => setShowVc(e.target.checked)} /> show vector clocks</label>
        <span className="small muted">Click two events to compare them.</span>
      </Controls>
      <svg className="dg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Three processes exchanging messages">
        {[0, 1, 2].map((p) => <g key={p}><text x={8} y={Y(p) + 4} fontWeight={700}>Node {p + 1}</text><line x1={x0} x2={W - 10} y1={Y(p)} y2={Y(p)} stroke="var(--ink-3)" /></g>)}
        {['m1', 'm2', 'm3'].map((m) => {
          const s = byMsg(m, 'send'), r = byMsg(m, 'recv');
          return <path key={m} d={`M${X(s.t)} ${Y(s.p)} L${X(r.t)} ${Y(r.p)}`} stroke="var(--v-a)" strokeWidth={1.5} fill="none" markerEnd="url(#hbArr)" />;
        })}
        <defs><marker id="hbArr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0 L10 5 L0 10 z" fill="var(--v-a)" /></marker></defs>
        {HB_EVENTS.map((e) => {
          const on = sel.includes(e.id);
          return (
            <g key={e.id} onClick={() => click(e.id)} style={{ cursor: 'pointer' }}>
              <circle cx={X(e.t)} cy={Y(e.p)} r={on ? 9 : 6} fill={on ? 'var(--v-d)' : 'var(--v-e)'} />
              <text x={X(e.t)} y={Y(e.p) - 13} textAnchor="middle" fontWeight={700}>{e.label}</text>
              <text x={X(e.t)} y={Y(e.p) + 22} textAnchor="middle" className="sub">{showVc ? `[${vc[e.id].join(',')}]` : `L=${lam[e.id]}`}</text>
            </g>
          );
        })}
      </svg>
      {x && y && (
        <div>
          <Stat label={`${x.label} vs ${y.label}`} value={rel === 'concurrent' ? 'concurrent (neither knew about the other)' : rel === 'before' ? `${x.label} happened before ${y.label}` : rel === 'after' ? `${y.label} happened before ${x.label}` : 'same event'} tone={rel === 'concurrent' ? 'warn' : 'good'} />
          <Stat label="Lamport timestamps" value={`${x.label}: ${lam[x.id]}, ${y.label}: ${lam[y.id]}`} />
          <span className="small muted"> {rel === 'concurrent' ? 'Lamport still orders them — consistent with causality, but you can’t tell from the numbers that they were concurrent (p. 337).' : 'Causally ordered events always get increasing Lamport timestamps.'}</span>
        </div>
      )}
    </div>
  );
}

function LamportTab() {
  const [ops, setOps] = useState<LOp[]>(FIG98);
  const [carry, setCarry] = useState(true);
  const { res, violations } = lamportRun(ops, carry);
  const W = 660, H = 230;
  const x0 = 80;
  const X = (i: number) => x0 + (i + 0.5) * ((W - x0 - 10) / Math.max(8, res.length));
  const lane = { A: 30, 1: 85, 2: 140, B: 195 } as Record<string, number>;
  const bad = new Set(violations.flat());
  return (
    <div>
      <Controls>
        <label><input type="checkbox" checked={carry} onChange={(e) => setCarry(e.target.checked)} /> clients and nodes carry the max counter (Lamport)</label>
      </Controls>
      <Controls>
        {(['A', 'B'] as const).map((c) => ([1, 2] as const).map((n) => (
          <button key={`${c}${n}`} className="btn sm" onClick={() => setOps([...ops, { client: c, node: n }].slice(-12))}>{c} writes to node {n}</button>
        )))}
        <button className="btn sm" onClick={() => setOps(FIG98)}>Figure 9-8</button>
        <button className="btn sm" onClick={() => setOps([])}>Clear</button>
      </Controls>
      <svg className="dg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Clients A and B sending writes to nodes 1 and 2, with timestamps">
        {Object.entries(lane).map(([k, y]) => <g key={k}><text x={8} y={y + 4} fontWeight={700}>{k === 'A' || k === 'B' ? `Client ${k}` : `Node ${k}`}</text><line x1={x0} x2={W - 8} y1={y} y2={y} stroke="var(--line)" /></g>)}
        {res.map((r, i) => (
          <g key={i}>
            <path d={`M${X(i)} ${lane[r.client]} L${X(i)} ${lane[r.node]}`} stroke={bad.has(i) ? 'var(--v-d)' : 'var(--v-a)'} strokeWidth={1.5} />
            <circle cx={X(i)} cy={lane[r.node]} r={5} fill={bad.has(i) ? 'var(--v-d)' : 'var(--v-b)'} />
            <text x={X(i)} y={lane[r.node] + (r.node === 1 ? -9 : 20)} textAnchor="middle" style={{ fontSize: 12 }} fontWeight={700} fill={bad.has(i) ? 'var(--v-d)' : undefined}>({r.ts[0]},{r.ts[1]})</text>
          </g>
        ))}
      </svg>
      <div>
        <Stat label="Client operations ordered against causality" value={violations.length} tone={violations.length ? 'bad' : 'good'} />
        {violations.slice(0, 3).map(([i, j]) => (
          <span key={`${i}-${j}`} className="small"> · client {res[i].client}: op {i + 1} got ({res[i].ts.join(',')}) but its later op {j + 1} got ({res[j].ts.join(',')})</span>
        ))}
      </div>
      <p className="small muted">Each client's operations are causally ordered (it saw the result of its previous write). With the max counter carried along, every causal dependency increases the timestamp (p. 337). Without it, the node counters drift apart — like the odd/even generators on p. 335.</p>
    </div>
  );
}
