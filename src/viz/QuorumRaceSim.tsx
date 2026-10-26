import { useState } from 'react';
import { Controls, Slider, Stat } from './ui';
import { checkLinearizable, type Op } from './linearizability';

/**
 * Chapter 9, p. 325 (Figure 9-6): strict quorums (n = 3, w = 3, r = 2) are not enough for linearizability when
 * network delays vary. The writer's x = 1 reaches the replicas at different times; reader A asks replicas 1+2,
 * reader B (who starts after A finished) asks replicas 2+3. With synchronous read repair, A writes the newest
 * value back to the stale replicas it read BEFORE returning — then any later read quorum overlaps a repaired node.
 */

export interface QuorumParams {
  d: [number, number, number]; // ms after the write starts until x = 1 reaches replica 1, 2, 3
  aStart: number;
  bStart: number;
  repair: boolean;             // synchronous read repair before returning
}

const WRITE_START = 10;
const HOP = 5; // one-way message delay between a client and a replica, for reads and repairs

export function runQuorum(p: QuorumParams) {
  const arrive = p.d.map((x) => WRITE_START + x);
  const repairedAt: (number | null)[] = [null, null, null];
  const valueAt = (i: number, t: number) => (t >= arrive[i] || (repairedAt[i] !== null && t >= repairedAt[i]!) ? 1 : 0);

  const read = (start: number, quorum: number[]) => {
    const t = start + HOP;
    const vals = quorum.map((i) => valueAt(i, t));
    const result = Math.max(...vals);
    let end = start + 2 * HOP;
    const repaired: number[] = [];
    if (p.repair && result === 1) {
      quorum.forEach((i, k) => {
        if (vals[k] === 0) { repaired.push(i); repairedAt[i] = Math.min(repairedAt[i] ?? Infinity, t + 2 * HOP); }
      });
      if (repaired.length) end = start + 4 * HOP; // wait for the repair acknowledgements
    }
    return { t, vals, result, end, repaired };
  };

  // Process the earlier reader first so that its repairs are visible to the later one.
  const first = p.aStart <= p.bStart ? 'A' : 'B';
  const rA0 = first === 'A' ? read(p.aStart, [0, 1]) : null;
  const rB = read(p.bStart, [1, 2]);
  const rA = rA0 ?? read(p.aStart, [0, 1]);
  const writeEnd = Math.max(...arrive) + HOP;
  const history: Op[] = [
    { id: 'W', client: 'Writer', kind: 'write', value: 1, ok: true, start: WRITE_START, end: writeEnd },
    { id: 'A', client: 'A', kind: 'read', value: rA.result, start: p.aStart, end: rA.end },
    { id: 'B', client: 'B', kind: 'read', value: rB.result, start: p.bStart, end: rB.end },
  ];
  const lin = checkLinearizable(history, 0).linearizable;
  return { arrive, rA, rB, writeEnd, history, linearizable: lin };
}

export default function QuorumRaceSim() {
  const [d1, setD1] = useState(5);
  const [d2, setD2] = useState(60);
  const [d3, setD3] = useState(70);
  const [aStart, setAStart] = useState(18);
  const [bStart, setBStart] = useState(40);
  const [repair, setRepair] = useState(false);
  const r = runQuorum({ d: [d1, d2, d3], aStart, bStart, repair });
  const W = 680, x0 = 84, H = 270;
  const T = Math.max(110, r.writeEnd + 10);
  const X = (t: number) => x0 + (t / T) * (W - x0 - 12);
  const lanes = { Writer: 26, R1: 82, R2: 128, R3: 174, A: 222, B: 252 } as Record<string, number>;
  const rep = (i: number) => lanes[`R${i + 1}`];
  return (
    <div>
      <Controls>
        <Slider label="x=1 reaches replica 1 after" value={d1} min={1} max={90} onChange={setD1} fmt={(v) => `${v} ms`} />
        <Slider label="replica 2" value={d2} min={1} max={90} onChange={setD2} fmt={(v) => `${v} ms`} />
        <Slider label="replica 3" value={d3} min={1} max={90} onChange={setD3} fmt={(v) => `${v} ms`} />
      </Controls>
      <Controls>
        <Slider label="Reader A starts" value={aStart} min={0} max={100} onChange={setAStart} fmt={(v) => `t=${v}`} />
        <Slider label="Reader B starts" value={bStart} min={0} max={100} onChange={setBStart} fmt={(v) => `t=${v}`} />
        <label><input type="checkbox" checked={repair} onChange={(e) => setRepair(e.target.checked)} /> synchronous read repair</label>
      </Controls>
      <svg className="dg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Writer, three replicas and two readers on a timeline">
        {Object.entries(lanes).map(([k, y]) => (
          <g key={k}><text x={8} y={y + 4} fontWeight={700}>{k.startsWith('R') ? `Replica ${k[1]}` : k === 'Writer' ? 'Writer' : `Reader ${k}`}</text><line x1={x0} x2={W - 8} y1={y} y2={y} stroke="var(--line)" /></g>
        ))}
        <rect x={X(WRITE_START)} y={lanes.Writer - 10} width={X(r.writeEnd) - X(WRITE_START)} height={20} rx={5} className="boxb" />
        <text x={X(WRITE_START) + 6} y={lanes.Writer + 4} style={{ fontSize: 11.5 }}>set x = 1 (w = 3)</text>
        {r.arrive.map((t, i) => (
          <g key={i}>
            <path d={`M${X(WRITE_START)} ${lanes.Writer + 10} L${X(t)} ${rep(i)}`} stroke="var(--v-b)" strokeWidth={1.3} fill="none" />
            <rect x={X(t)} y={rep(i) - 7} width={Math.max(0, X(T) - X(t) - 2)} height={14} fill="color-mix(in srgb, var(--v-b) 16%, transparent)" />
            <text x={X(t) + 4} y={rep(i) + 4} className="sub">x = 1</text>
          </g>
        ))}
        {(['A', 'B'] as const).map((c) => {
          const rr = c === 'A' ? r.rA : r.rB;
          const start = c === 'A' ? aStart : bStart;
          const q = c === 'A' ? [0, 1] : [1, 2];
          return (
            <g key={c}>
              <rect x={X(start)} y={lanes[c] - 10} width={X(rr.end) - X(start)} height={20} rx={5} className={rr.result === 1 ? 'boxa' : 'boxc'} />
              <text x={X(start) + 4} y={lanes[c] + 4} style={{ fontSize: 11.5 }} fontWeight={700}>get x → {rr.result}</text>
              {q.map((i, k) => (
                <g key={i}>
                  <path d={`M${X(start)} ${lanes[c] - 10} L${X(rr.t)} ${rep(i)}`} stroke={c === 'A' ? 'var(--v-a)' : 'var(--v-e)'} strokeWidth={1.2} fill="none" strokeDasharray="3 3" />
                  <circle cx={X(rr.t)} cy={rep(i)} r={4} fill={rr.vals[k] ? 'var(--v-b)' : 'var(--v-c)'} />
                  <text x={X(rr.t) + 5} y={rep(i) - 7} style={{ fontSize: 11 }} fill={c === 'A' ? 'var(--v-a)' : 'var(--v-e)'}>{c}:{rr.vals[k]}</text>
                </g>
              ))}
              {rr.repaired.map((i) => <text key={`rp${i}`} x={X(rr.t + 2 * HOP)} y={rep(i) + 18} style={{ fontSize: 11 }} fill="var(--v-a)">repaired by {c}</text>)}
            </g>
          );
        })}
      </svg>
      <div>
        <Stat label="w + r > n" value="3 + 2 > 3 ✓" tone="good" />
        <Stat label="A returned" value={r.rA.result} />
        <Stat label="B returned" value={r.rB.result} />
        <Stat label="Linearizable?" value={r.linearizable ? 'yes' : 'no — a later read saw an older value'} tone={r.linearizable ? 'good' : 'bad'} />
      </div>
      <p className="small muted">Defaults reproduce Figure 9-6. Turn on synchronous read repair: A pushes x = 1 to replica 2 before returning, so B's quorum (which must overlap A's) finds it. That fixes reads and writes, but not compare-and-set, which needs consensus (p. 325).</p>
    </div>
  );
}
