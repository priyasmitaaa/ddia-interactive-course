import { useState } from 'react';
import { Controls, Seg, Slider, Stat } from './ui';

/**
 * Chapter 9, pp. 337-342: two users concurrently claim the username "ada" via different nodes.
 *  - "timestamps": each node stamps the claim with a Lamport timestamp. Deciding *now* is unsafe (both succeed);
 *    the lower timestamp only wins after the fact. To be safe a node must ask every other node — and if one is
 *    unreachable, it blocks.
 *  - "log": claims are appended to a totally ordered log (total order broadcast). Each node waits until its own
 *    claim is delivered back, then the FIRST claim for the name in the log wins. All nodes agree.
 */

export interface TobParams {
  mode: 'timestamps' | 'log';
  toLog: [number, number];          // delay from node 1 / node 3 to the log (sequencer), ms
  deliver: [number, number, number]; // delay from the log to node 1, 2, 3
  askAll: boolean;                  // timestamps mode: check with every node before deciding
  node2Up: boolean;
}

export interface TobResult {
  logOrder: ('X' | 'Y')[];          // X claims via node 1 (at t=10), Y via node 3 (at t=12)
  outcomeX: string; outcomeY: string;
  decidedAt: { X: number | null; Y: number | null };
  agreed: boolean;                  // the system never told both users "yours"
  blocked: boolean;
  deliveries: { node: number; who: 'X' | 'Y'; t: number }[];
}

export function tobRun(p: TobParams): TobResult {
  const claimAt = { X: 10, Y: 12 };
  if (p.mode === 'timestamps') {
    // Lamport timestamps: both nodes' counters are 0, so X gets (1, node1), Y gets (1, node3) → X wins after the fact.
    if (!p.askAll) {
      return {
        logOrder: [], outcomeX: 'success (ts (1,1))', outcomeY: 'success (ts (1,3)) — but loses after the fact!',
        decidedAt: { X: claimAt.X, Y: claimAt.Y }, agreed: false, blocked: false, deliveries: [],
      };
    }
    if (!p.node2Up) {
      return {
        logOrder: [], outcomeX: 'waiting for node 2… (blocked)', outcomeY: 'waiting for node 2… (blocked)',
        decidedAt: { X: null, Y: null }, agreed: true, blocked: true, deliveries: [],
      };
    }
    const rtt = 2 * Math.max(...p.toLog, 10);
    return {
      logOrder: [], outcomeX: 'success (lowest timestamp)', outcomeY: 'aborted: X has a lower timestamp',
      decidedAt: { X: claimAt.X + rtt, Y: claimAt.Y + rtt }, agreed: true, blocked: false, deliveries: [],
    };
  }
  // total order broadcast via a log
  const arrive = { X: claimAt.X + p.toLog[0], Y: claimAt.Y + p.toLog[1] };
  const logOrder: ('X' | 'Y')[] = arrive.X <= arrive.Y ? ['X', 'Y'] : ['Y', 'X'];
  const seqTime = { [logOrder[0]]: arrive[logOrder[0]], [logOrder[1]]: Math.max(arrive[logOrder[1]], arrive[logOrder[0]]) } as Record<'X' | 'Y', number>;
  const deliveries: TobResult['deliveries'] = [];
  for (let n = 0; n < 3; n++) {
    if (n === 1 && !p.node2Up) continue;
    // in-order delivery: the second message can't be delivered before the first
    let last = 0;
    for (const who of logOrder) {
      const t = Math.max(seqTime[who] + p.deliver[n], last);
      deliveries.push({ node: n + 1, who, t });
      last = t;
    }
  }
  const backTo = (who: 'X' | 'Y') => deliveries.find((d) => d.who === who && d.node === (who === 'X' ? 1 : 3))!.t;
  const winner = logOrder[0];
  return {
    logOrder,
    outcomeX: winner === 'X' ? 'success (first claim in the log)' : 'aborted (Y’s claim is first in the log)',
    outcomeY: winner === 'Y' ? 'success (first claim in the log)' : 'aborted (X’s claim is first in the log)',
    decidedAt: { X: backTo('X'), Y: backTo('Y') }, agreed: true, blocked: false, deliveries,
  };
}

export default function TOBSim() {
  const [mode, setMode] = useState<'timestamps' | 'log'>('timestamps');
  const [toLog1, setToLog1] = useState(15);
  const [toLog3, setToLog3] = useState(5);
  const [del, setDel] = useState<[number, number, number]>([8, 30, 12]);
  const [askAll, setAskAll] = useState(false);
  const [node2Up, setNode2Up] = useState(true);
  const r = tobRun({ mode, toLog: [toLog1, toLog3], deliver: del, askAll, node2Up });
  const W = 660, H = 210, x0 = 70;
  const T = 100;
  const X = (t: number) => x0 + (Math.min(t, T) / T) * (W - x0 - 14);
  const lane = { log: 30, 1: 85, 2: 135, 3: 185 } as Record<string, number>;
  return (
    <div>
      <Controls>
        <Seg value={mode} onChange={setMode} options={[{ value: 'timestamps', label: 'Lamport timestamps' }, { value: 'log', label: 'Total order broadcast (log)' }]} />
        <label><input type="checkbox" checked={node2Up} onChange={(e) => setNode2Up(e.target.checked)} /> node 2 reachable</label>
        {mode === 'timestamps' && <label><input type="checkbox" checked={askAll} onChange={(e) => setAskAll(e.target.checked)} /> ask every node before deciding</label>}
      </Controls>
      {mode === 'log' && (
        <Controls>
          <Slider label="node 1 → log" value={toLog1} min={1} max={40} onChange={setToLog1} fmt={(v) => `${v} ms`} />
          <Slider label="node 3 → log" value={toLog3} min={1} max={40} onChange={setToLog3} fmt={(v) => `${v} ms`} />
          <Slider label="log → node 2" value={del[1]} min={1} max={60} onChange={(v) => setDel([del[0], v, del[2]])} fmt={(v) => `${v} ms`} />
        </Controls>
      )}
      <svg className="dg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Two username claims, a log and three nodes">
        {Object.entries(lane).map(([k, y]) => (k === 'log' && mode !== 'log') ? null : (
          <g key={k}><text x={8} y={y + 4} fontWeight={700}>{k === 'log' ? 'Log' : `Node ${k}`}{k === '2' && !node2Up ? ' ✕' : ''}</text><line x1={x0} x2={W - 8} y1={y} y2={y} stroke="var(--line)" strokeDasharray={k === '2' && !node2Up ? '4 4' : undefined} /></g>
        ))}
        <circle cx={X(10)} cy={lane[1]} r={6} fill="var(--v-a)" /><text x={X(10)} y={lane[1] - 10} textAnchor="middle" style={{ fontSize: 12 }} fontWeight={700}>X claims "ada"</text>
        <circle cx={X(12)} cy={lane[3]} r={6} fill="var(--v-e)" /><text x={X(12)} y={lane[3] + 20} textAnchor="middle" style={{ fontSize: 12 }} fontWeight={700}>Y claims "ada"</text>
        {mode === 'log' && (
          <g>
            <path d={`M${X(10)} ${lane[1]} L${X(10 + toLog1)} ${lane.log}`} stroke="var(--v-a)" fill="none" />
            <path d={`M${X(12)} ${lane[3]} L${X(12 + toLog3)} ${lane.log}`} stroke="var(--v-e)" fill="none" />
            {r.logOrder.map((who, i) => (
              <g key={who}><rect x={X(i === 0 ? Math.min(10 + toLog1, 12 + toLog3) : Math.max(10 + toLog1, 12 + toLog3)) - 14} y={lane.log - 11} width={28} height={22} rx={4} className={who === 'X' ? 'boxa' : 'boxe'} />
                <text x={X(i === 0 ? Math.min(10 + toLog1, 12 + toLog3) : Math.max(10 + toLog1, 12 + toLog3))} y={lane.log + 4} textAnchor="middle" fontWeight={700} style={{ fontSize: 12 }}>#{i + 1}{who}</text></g>
            ))}
            {r.deliveries.map((d, i) => (
              <g key={i}>
                <circle cx={X(d.t)} cy={lane[d.node]} r={4} fill={d.who === 'X' ? 'var(--v-a)' : 'var(--v-e)'} />
                <text x={X(d.t)} y={lane[d.node] + (d.who === 'X' ? -8 : 16)} textAnchor="middle" className="sub">{d.who}</text>
              </g>
            ))}
          </g>
        )}
        {(['X', 'Y'] as const).map((w) => r.decidedAt[w] !== null && (
          <text key={w} x={X(r.decidedAt[w]!) + 6} y={w === 'X' ? lane[1] + 22 : lane[3] - 12} style={{ fontSize: 12 }} fontWeight={700} fill={(w === 'X' ? r.outcomeX : r.outcomeY).startsWith('success') ? 'var(--v-b)' : 'var(--v-d)'}>
            {(w === 'X' ? r.outcomeX : r.outcomeY).startsWith('success') ? '✓ decided: yours' : '✕ decided: taken'}
          </text>
        ))}
      </svg>
      <div>
        <Stat label="User X" value={r.outcomeX} tone={r.blocked ? 'warn' : r.outcomeX.startsWith('success') ? 'good' : undefined} />
        <Stat label="User Y" value={r.outcomeY} tone={r.blocked ? 'warn' : r.outcomeY.includes('after the fact') ? 'bad' : r.outcomeY.startsWith('success') ? 'good' : undefined} />
        <Stat label="Uniqueness held" value={r.agreed ? (r.blocked ? 'yes — by not deciding at all' : 'yes') : 'NO: both were told the name is theirs'} tone={r.agreed && !r.blocked ? 'good' : 'bad'} />
      </div>
      <p className="small muted">
        {mode === 'timestamps'
          ? 'Total order emerges only after you have collected all operations (p. 338). Deciding immediately breaks uniqueness; waiting for every node blocks when one is unreachable.'
          : 'The order is fixed when a message is delivered; nobody can insert an earlier claim later (p. 340). Node 2 being down doesn’t stop the others — a real log is replicated with consensus so it survives failures too.'}
      </p>
    </div>
  );
}
