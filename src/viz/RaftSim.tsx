import { useState } from 'react';
import { Controls, Seg, Stat, rng, useInterval } from './ui';

/**
 * Chapter 9, pp. 355-360: epoch numbering and quorums, in the style of Raft (terms). Five nodes; a node that hears
 * nothing from a leader for its election timeout starts an election with term + 1 and needs votes from a majority.
 * A leader's log entries are committed only once a majority has them. A node that sees a higher term steps down.
 *
 * Simplifications (not a full Raft): one tick ≈ one round of messages; messages within a network partition are
 * delivered instantly; a follower that accepts a leader simply adopts the leader's log.
 */

export interface RNode {
  id: number; up: boolean; term: number; role: 'follower' | 'candidate' | 'leader';
  votedFor: number | null; log: { term: number; v: string }[]; commit: number; timer: number;
}
export interface RaftState { nodes: RNode[]; group: number[]; tick: number; seed: number; events: string[] }

const N = 5;
const majority = Math.floor(N / 2) + 1;

const timeout = (s: RaftState, id: number) => {
  const r = rng(s.seed * 7919 + s.tick * 31 + id * 101);
  return 3 + Math.floor(r() * 4); // 3..6 ticks
};

export function initRaft(seed = 1): RaftState {
  const s: RaftState = { nodes: [], group: new Array(N).fill(0), tick: 0, seed, events: [] };
  s.nodes = Array.from({ length: N }, (_, id) => ({ id, up: true, term: 0, role: 'follower', votedFor: null, log: [], commit: 0, timer: 0 }));
  s.nodes.forEach((n) => (n.timer = timeout(s, n.id) + n.id)); // stagger the first elections
  return s;
}

const clone = (s: RaftState): RaftState => ({ ...s, group: [...s.group], events: [], nodes: s.nodes.map((n) => ({ ...n, log: [...n.log] })) });
export const reachable = (s: RaftState, a: number, b: number) => a !== b && s.nodes[a].up && s.nodes[b].up && s.group[a] === s.group[b];
const upToDate = (cand: RNode, voter: RNode) => {
  const ct = cand.log.length ? cand.log[cand.log.length - 1].term : 0;
  const vt = voter.log.length ? voter.log[voter.log.length - 1].term : 0;
  return ct > vt || (ct === vt && cand.log.length >= voter.log.length);
};
const name = (i: number) => String.fromCharCode(65 + i);

export function raftTick(prev: RaftState): RaftState {
  const s = clone(prev);
  s.tick++;
  // leaders replicate (heartbeats + log)
  for (const L of s.nodes) {
    if (!L.up || L.role !== 'leader') continue;
    for (const F of s.nodes) {
      if (!reachable(s, L.id, F.id)) continue;
      if (F.term > L.term) {
        s.events.push(`${name(L.id)} sees term ${F.term} > its term ${L.term} → steps down`);
        L.term = F.term; L.role = 'follower'; L.votedFor = null; L.timer = timeout(s, L.id);
        break;
      }
      F.term = L.term; F.role = 'follower'; F.timer = timeout(s, F.id);
      const dropped = F.log.length > L.log.length || F.log.some((e, i) => L.log[i] && L.log[i].term !== e.term);
      if (dropped) s.events.push(`${name(F.id)} discards uncommitted entries that conflict with leader ${name(L.id)}'s log`);
      F.log = [...L.log];
    }
    if (L.role !== 'leader') continue;
    // commit: highest index stored on a majority whose entry is from the leader's current term
    for (let i = L.log.length; i > L.commit; i--) {
      if (L.log[i - 1].term !== L.term) continue;
      const count = s.nodes.filter((n) => n.log.length >= i && n.log[i - 1].term === L.log[i - 1].term && (n.id === L.id || reachable(s, L.id, n.id))).length;
      if (count >= majority) { s.events.push(`${name(L.id)} commits up to entry ${i} (stored on ${count}/${N} nodes)`); L.commit = i; break; }
    }
    for (const F of s.nodes) if (reachable(s, L.id, F.id)) F.commit = Math.min(L.commit, F.log.length);
  }
  // election timers
  for (const C of s.nodes) {
    if (!C.up || C.role === 'leader') continue;
    C.timer--;
    if (C.timer > 0) continue;
    C.term++; C.role = 'candidate'; C.votedFor = C.id; C.timer = timeout(s, C.id);
    let votes = 1;
    for (const V of s.nodes) {
      if (!reachable(s, C.id, V.id)) continue;
      if (V.term > C.term) continue;
      if (V.term < C.term) { V.term = C.term; V.votedFor = null; if (V.role !== 'follower') { V.role = 'follower'; V.timer = timeout(s, V.id); } }
      if ((V.votedFor === null || V.votedFor === C.id) && upToDate(C, V)) { V.votedFor = C.id; V.timer = timeout(s, V.id); votes++; }
    }
    if (votes >= majority) {
      C.role = 'leader';
      s.events.push(`${name(C.id)} wins the election for term ${C.term} with ${votes}/${N} votes`);
    } else {
      s.events.push(`${name(C.id)} starts an election for term ${C.term} but gets only ${votes}/${N} votes`);
    }
  }
  return s;
}

export function raftWrite(prev: RaftState, leader: number, v: string): RaftState {
  const s = clone(prev);
  const L = s.nodes[leader];
  if (L.role !== 'leader' || !L.up) return prev;
  L.log.push({ term: L.term, v });
  s.events.push(`client writes "${v}" via ${name(leader)} (term ${L.term}) — not committed until a majority stores it`);
  return s;
}

export function setPartition(prev: RaftState, group: number[]): RaftState {
  const s = clone(prev); s.group = [...group]; return s;
}
export function toggleUp(prev: RaftState, id: number): RaftState {
  const s = clone(prev);
  const n = s.nodes[id];
  n.up = !n.up;
  if (n.up) { n.role = 'follower'; n.timer = timeout(s, id); } // term, vote and log survive (stable storage)
  s.events.push(n.up ? `${name(id)} restarts (term ${n.term} and log kept on disk)` : `${name(id)} crashes`);
  return s;
}

export const leaders = (s: RaftState) => s.nodes.filter((n) => n.up && n.role === 'leader');

export default function RaftSim() {
  const [s, setS] = useState<RaftState>(() => initRaft(3));
  const [log, setLog] = useState<string[]>([]);
  const [play, setPlay] = useState(false);
  const [part, setPart] = useState<'none' | 'split'>('none');
  const [w, setW] = useState(1);
  const apply = (ns: RaftState) => { setS(ns); if (ns.events.length) setLog((l) => [...l, ...ns.events.map((e) => `t${ns.tick}: ${e}`)].slice(-60)); };
  useInterval(() => apply(raftTick(s)), play ? 700 : null);
  const L = leaders(s);
  // split: the current leader (or A) plus one other node on the minority side
  const doSplit = () => {
    const lead = L[0]?.id ?? 0;
    const other = (lead + 1) % N;
    const g = new Array(N).fill(1); g[lead] = 0; g[other] = 0;
    setPart('split'); apply(setPartition(s, g));
  };
  const W = 660, H = 230;
  const pos = (i: number) => ({ x: 70 + i * 128, y: 70 });
  return (
    <div>
      <Controls>
        <button className="btn sm primary" onClick={() => setPlay(!play)}>{play ? 'Pause' : 'Run'}</button>
        <button className="btn sm" onClick={() => apply(raftTick(s))}>Step</button>
        <Seg value={part} onChange={(v) => (v === 'split' ? doSplit() : (setPart('none'), apply(setPartition(s, new Array(N).fill(0)))))} options={[{ value: 'none', label: 'Network healthy' }, { value: 'split', label: 'Partition: leader + 1 | 3' }]} />
        <button className="btn sm" onClick={() => { setS(initRaft(s.seed + 1)); setLog([]); setPart('none'); setW(1); }}>Reset</button>
      </Controls>
      <Controls>
        {L.map((l) => <button key={l.id} className="btn sm" onClick={() => { apply(raftWrite(s, l.id, `v${w}`)); setW(w + 1); }}>Client write via leader {name(l.id)} (term {l.term})</button>)}
        {!L.length && <span className="small muted">No leader right now — writes would fail. Run the simulation.</span>}
      </Controls>
      <svg className="dg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Five nodes with their terms, roles and logs">
        {s.nodes.map((n) => {
          const p = pos(n.id);
          const cls = !n.up ? 'box' : n.role === 'leader' ? 'boxb' : n.role === 'candidate' ? 'boxc' : 'boxa';
          return (
            <g key={n.id} onClick={() => apply(toggleUp(s, n.id))} style={{ cursor: 'pointer', opacity: n.up ? 1 : 0.4 }}>
              <rect x={p.x - 52} y={p.y - 46} width={104} height={92} rx={10} className={cls} strokeDasharray={s.group[n.id] === 1 ? '5 3' : undefined} />
              <text x={p.x} y={p.y - 26} textAnchor="middle" fontWeight={700}>{name(n.id)} · {n.up ? n.role : 'down'}</text>
              <text x={p.x} y={p.y - 8} textAnchor="middle" className="sub">term {n.term}</text>
              <text x={p.x} y={p.y + 10} textAnchor="middle" className="sub">group {s.group[n.id] + 1}</text>
              <text x={p.x} y={p.y + 30} textAnchor="middle" style={{ fontSize: 11 }}>log: {n.log.length ? n.log.map((e, i) => `${e.v}${i < n.commit ? '✓' : ''}`).join(' ') : '—'}</text>
            </g>
          );
        })}
        <text x={14} y={150} className="sub">✓ = committed · click a node to crash/restart it · dashed border = on the other side of the partition</text>
        <text x={14} y={175} className="sub">Entries are labelled with values; terms in the log decide which leader's entries survive.</text>
      </svg>
      <div>
        <Stat label="Tick" value={s.tick} />
        <Stat label="Leaders" value={L.length ? L.map((l) => `${name(l.id)} (term ${l.term})`).join(', ') : 'none'} tone={L.length > 1 ? 'warn' : L.length ? 'good' : undefined} />
        <Stat label="Majority" value={`${majority} of ${N}`} />
      </div>
      <div className="log">{log.map((e, i) => <div key={i}>{e}</div>)}</div>
      <p className="small muted">Try: run until a leader is elected; write v1 and see it commit. Partition the leader with one follower: the 3-node side elects a leader with a higher term. Write via BOTH leaders — only the majority side commits. Heal the network: the old leader sees the higher term, steps down, and its uncommitted entry is replaced (pp. 358–359).</p>
    </div>
  );
}
