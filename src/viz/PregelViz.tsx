import { useState } from 'react';
import { Controls, Seg, Stat } from './ui';

/**
 * Chapter 10, pp. 411-414: the Pregel / bulk synchronous parallel model. In each superstep, every vertex that has
 * incoming messages runs a function with those messages, updates its in-memory state, and sends messages along its
 * edges; messages are delivered at the next superstep. Here: single-source shortest paths (vertices with no new
 * messages do no work) and PageRank (fixed number of supersteps). Vertices are hash-partitioned onto two machines.
 */

export const V = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
export const EDGES: [number, number, number][] = [ // from, to, weight
  [0, 1, 4], [0, 2, 1], [2, 1, 2], [1, 3, 1], [2, 3, 5], [3, 4, 3], [4, 5, 1], [3, 5, 8], [5, 6, 2], [6, 4, 1],
];
const POS = [[60, 90], [190, 40], [190, 150], [330, 90], [470, 40], [470, 150], [600, 95]];
export const machineOf = (v: number) => (v * 7 + 3) % 2;

export interface SsspState { dist: number[]; inbox: number[][]; superstep: number; active: number; messages: number; crossMachine: number }

export function ssspInit(src = 0): SsspState {
  const inbox = V.map(() => [] as number[]);
  inbox[src] = [0];
  return { dist: V.map(() => Infinity), inbox, superstep: 0, active: 1, messages: 0, crossMachine: 0 };
}

export function ssspStep(s: SsspState): SsspState {
  const dist = [...s.dist];
  const next = V.map(() => [] as number[]);
  let active = 0, messages = 0, cross = 0;
  V.forEach((_, v) => {
    if (!s.inbox[v].length) return;             // no messages → vertex stays halted, no work
    const best = Math.min(...s.inbox[v]);
    if (best >= dist[v]) return;
    dist[v] = best;
    active++;
    for (const [f, t, w] of EDGES) if (f === v) {
      next[t].push(best + w);
      messages++;
      if (machineOf(f) !== machineOf(t)) cross++;
    }
  });
  return { dist, inbox: next, superstep: s.superstep + 1, active, messages, crossMachine: s.crossMachine + cross };
}

export interface PrState { rank: number[]; superstep: number; messages: number; crossMachine: number }
export const prInit = (): PrState => ({ rank: V.map(() => 1 / V.length), superstep: 0, messages: 0, crossMachine: 0 });
export function prStep(s: PrState, d = 0.85): PrState {
  const incoming = V.map(() => 0);
  let messages = 0, cross = 0;
  V.forEach((_, v) => {
    const out = EDGES.filter(([f]) => f === v);
    for (const [f, t] of out) {
      incoming[t] += s.rank[v] / out.length;
      messages++;
      if (machineOf(f) !== machineOf(t)) cross++;
    }
  });
  const rank = incoming.map((x) => (1 - d) / V.length + d * x);
  return { rank, superstep: s.superstep + 1, messages, crossMachine: s.crossMachine + cross };
}

export default function PregelViz() {
  const [algo, setAlgo] = useState<'sssp' | 'pagerank'>('sssp');
  const [ss, setSs] = useState<SsspState>(ssspInit());
  const [pr, setPr] = useState<PrState>(prInit());
  const step = () => (algo === 'sssp' ? setSs(ssspStep(ss)) : setPr(prStep(pr)));
  const reset = () => { setSs(ssspInit()); setPr(prInit()); };
  const done = algo === 'sssp' && ss.superstep > 0 && ss.inbox.every((m) => !m.length);
  const label = (v: number) => (algo === 'sssp' ? (ss.dist[v] === Infinity ? '∞' : String(ss.dist[v])) : pr.rank[v].toFixed(3));
  const hasMail = (v: number) => algo === 'sssp' && ss.inbox[v].length > 0;
  return (
    <div>
      <Controls>
        <Seg value={algo} onChange={(a) => { setAlgo(a); reset(); }} options={[{ value: 'sssp', label: 'Shortest paths from A' }, { value: 'pagerank', label: 'PageRank' }]} />
        <button className="btn sm primary" onClick={step} disabled={done}>Next superstep</button>
        <button className="btn sm" onClick={reset}>Reset</button>
      </Controls>
      <svg className="dg" viewBox="0 0 660 200" role="img" aria-label="A small weighted graph processed in supersteps">
        <defs><marker id="pgArr" viewBox="0 0 10 10" refX="22" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path d="M0 0 L10 5 L0 10 z" fill="var(--ink-3)" /></marker></defs>
        {EDGES.map(([f, t, w], k) => (
          <g key={k}>
            <line x1={POS[f][0]} y1={POS[f][1]} x2={POS[t][0]} y2={POS[t][1]} stroke={machineOf(f) !== machineOf(t) ? 'var(--v-c)' : 'var(--ink-3)'} strokeWidth={1.4} markerEnd="url(#pgArr)" />
            {algo === 'sssp' && <text x={(POS[f][0] + POS[t][0]) / 2} y={(POS[f][1] + POS[t][1]) / 2 - 4} className="sub">{w}</text>}
          </g>
        ))}
        {V.map((name, v) => (
          <g key={name}>
            <circle cx={POS[v][0]} cy={POS[v][1]} r={20} className={machineOf(v) ? 'boxe' : 'boxa'} strokeWidth={hasMail(v) ? 3.5 : 1.4} stroke={hasMail(v) ? 'var(--v-d)' : undefined} />
            <text x={POS[v][0]} y={POS[v][1] - 3} textAnchor="middle" fontWeight={700}>{name}</text>
            <text x={POS[v][0]} y={POS[v][1] + 11} textAnchor="middle" style={{ fontSize: 11 }}>{label(v)}</text>
          </g>
        ))}
        <text x={10} y={194} className="sub">blue / purple = machine 1 / 2 (hash of vertex ID) · orange edges cross machines{algo === 'sssp' ? ' · red ring = has messages for the next superstep' : ''}</text>
      </svg>
      {algo === 'sssp' ? (
        <div>
          <Stat label="Superstep" value={ss.superstep} />
          <Stat label="Vertices that did work" value={ss.active} />
          <Stat label="Messages sent" value={ss.messages} />
          <Stat label="Cross-machine messages so far" value={ss.crossMachine} tone="warn" />
          {done && <Stat label="Status" value="no messages in flight — all vertices halted" tone="good" />}
        </div>
      ) : (
        <div>
          <Stat label="Superstep" value={pr.superstep} />
          <Stat label="Messages per superstep" value={pr.messages} />
          <Stat label="Cross-machine messages so far" value={pr.crossMachine} tone="warn" />
          <Stat label="Sum of ranks" value={pr.rank.reduce((a, b) => a + b, 0).toFixed(3)} />
        </div>
      )}
      <p className="small muted">Each vertex keeps its state in memory between supersteps and only reacts to new messages — "think like a vertex" (pp. 412–414). All messages from one superstep are delivered before the next begins, which is the only waiting. Hash partitioning ignores which vertices talk to each other, so many messages cross machines — one reason a single machine often beats a distributed graph job if the graph fits (p. 414).</p>
    </div>
  );
}
