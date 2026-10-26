import { useState } from 'react';
import { Controls, Seg, Stat, useLog, Log } from './ui';

/**
 * Chapter 9, pp. 326-328 (Figure 9-7): two datacenters, a network interruption between them, clients that can
 * still reach their local datacenter. A linearizable (single-leader, leader in DC 1) setup must refuse writes and
 * linearizable reads in DC 2 during the interruption; a multi-leader setup stays available but isn't
 * linearizable, and concurrent writes on both sides conflict when the link comes back.
 */

export type Mode = 'single' | 'multi';
export interface CapState {
  mode: Mode;
  linkUp: boolean;
  dc: [number, number];              // value of key x in each datacenter
  pending: [number[], number[]];     // writes accepted in DC i not yet replicated to the other
  conflict: boolean;
  version: number;
}

export const initialCap = (mode: Mode): CapState => ({ mode, linkUp: true, dc: [0, 0], pending: [[], []], conflict: false, version: 0 });

export type CapAction = { kind: 'write' | 'readLin' | 'readLocal'; at: 0 | 1 } | { kind: 'toggleLink' };

export interface CapOutcome { state: CapState; text: string; tone?: 'good' | 'bad' | 'warn' | 'muted'; available: boolean; result?: number; stale?: boolean }

const CROSS = 80; // ms round trip between datacenters (illustrative)

export function capStep(s: CapState, a: CapAction): CapOutcome {
  const st: CapState = { ...s, dc: [...s.dc] as [number, number], pending: [[...s.pending[0]], [...s.pending[1]]] };
  if (a.kind === 'toggleLink') {
    st.linkUp = !st.linkUp;
    if (st.linkUp) {
      // exchange queued writes
      const p0 = st.pending[0], p1 = st.pending[1];
      if (st.mode === 'multi' && p0.length && p1.length) {
        st.conflict = true;
        st.pending = [[], []];
        return { state: st, text: `link restored: both datacenters accepted writes to x during the interruption (DC1: ${p0.join(', ')}; DC2: ${p1.join(', ')}) → CONFLICT, needs resolution (Chapter 5)`, tone: 'bad', available: true };
      }
      if (p0.length) st.dc[1] = st.dc[0];
      if (p1.length) st.dc[0] = st.dc[1];
      st.pending = [[], []];
      return { state: st, text: 'link restored: queued writes exchanged, datacenters converge', tone: 'good', available: true };
    }
    return { state: st, text: 'network interruption between the datacenters (clients can still reach their local DC)', tone: 'warn', available: true };
  }
  const here = a.at, there = (1 - a.at) as 0 | 1;
  const dcName = `DC${here + 1}`;
  if (st.mode === 'single') {
    // leader is in DC1; DC2 holds a follower
    const atLeader = here === 0;
    if (a.kind === 'readLocal') {
      const stale = st.dc[here] !== st.dc[0];
      return { state: st, text: `${dcName} client: local read x = ${st.dc[here]}${atLeader ? ' (from the leader)' : stale ? ' — STALE (follower cut off from leader)' : ' (from the follower)'}`, tone: stale ? 'warn' : undefined, available: true, result: st.dc[here], stale };
    }
    if (!atLeader && !st.linkUp) {
      return { state: st, text: `${dcName} client: ${a.kind === 'write' ? 'write' : 'linearizable read'} must go to the leader in DC1 — unreachable → ERROR (unavailable)`, tone: 'bad', available: false };
    }
    const lat = atLeader ? 1 : CROSS;
    if (a.kind === 'readLin') return { state: st, text: `${dcName} client: linearizable read via leader → x = ${st.dc[0]} (${lat} ms)`, available: true, result: st.dc[0] };
    st.version++;
    st.dc[0] = st.version;
    if (st.linkUp) st.dc[1] = st.version; else st.pending[0].push(st.version);
    return { state: st, text: `${dcName} client: write x = ${st.version} via leader (${lat} ms)${st.linkUp ? '' : ' — follower in DC2 will be behind until the link returns'}`, tone: 'good', available: true };
  }
  // multi-leader: each DC accepts writes locally
  if (a.kind === 'write') {
    st.version++;
    st.dc[here] = st.version;
    if (st.linkUp) st.dc[there] = st.version; else st.pending[here].push(st.version);
    return { state: st, text: `${dcName} client: write x = ${st.version} accepted locally (1 ms)${st.linkUp ? ', replicated asynchronously' : ', queued for replication'}`, tone: 'good', available: true };
  }
  const stale = st.dc[here] !== st.dc[there];
  return { state: st, text: `${dcName} client: read x = ${st.dc[here]} from local leader${stale ? ' — the other DC has a different value (not linearizable)' : ''}`, tone: stale ? 'warn' : undefined, available: true, result: st.dc[here], stale };
}

export default function CAPSim() {
  const [s, setS] = useState<CapState>(initialCap('single'));
  const [unavail, setUnavail] = useState(0);
  const log = useLog();
  const act = (a: CapAction) => {
    const o = capStep(s, a);
    setS(o.state);
    if (!o.available) setUnavail(unavail + 1);
    log.add(o.text, o.tone);
  };
  const switchMode = (m: Mode) => { setS(initialCap(m)); setUnavail(0); log.clear(); };
  const W = 640, H = 150;
  return (
    <div>
      <Controls>
        <Seg value={s.mode} onChange={switchMode} options={[{ value: 'single', label: 'Single-leader (linearizable)' }, { value: 'multi', label: 'Multi-leader (available)' }]} />
        <button className={`btn sm ${s.linkUp ? '' : 'primary'}`} onClick={() => act({ kind: 'toggleLink' })}>{s.linkUp ? 'Cut the link between DCs' : 'Restore the link'}</button>
      </Controls>
      <svg className="dg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Two datacenters with a link that can be interrupted">
        {[0, 1].map((i) => (
          <g key={i}>
            <rect x={i === 0 ? 20 : 380} y={20} width={240} height={90} rx={10} className={i === 0 ? 'boxa' : 'boxe'} />
            <text x={i === 0 ? 140 : 500} y={42} textAnchor="middle" fontWeight={700}>Datacenter {i + 1}</text>
            <text x={i === 0 ? 140 : 500} y={66} textAnchor="middle">{s.mode === 'single' ? (i === 0 ? 'DB leader' : 'DB follower') : 'DB leader'}</text>
            <text x={i === 0 ? 140 : 500} y={92} textAnchor="middle" fontWeight={700}>x = {s.dc[i]}</text>
          </g>
        ))}
        <line x1={260} x2={380} y1={65} y2={65} stroke={s.linkUp ? 'var(--v-b)' : 'var(--v-d)'} strokeWidth={3} strokeDasharray={s.linkUp ? undefined : '6 6'} />
        <text x={320} y={56} textAnchor="middle" fill={s.linkUp ? 'var(--v-b)' : 'var(--v-d)'} fontWeight={700}>{s.linkUp ? 'link up' : '✕ interrupted'}</text>
        {s.conflict && <text x={320} y={135} textAnchor="middle" fill="var(--v-d)" fontWeight={700}>conflicting writes to x!</text>}
      </svg>
      <Controls>
        {[0, 1].map((i) => (
          <span key={i} style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
            <b>DC{i + 1} client:</b>
            <button className="btn sm primary" onClick={() => act({ kind: 'write', at: i as 0 | 1 })}>write</button>
            <button className="btn sm" onClick={() => act({ kind: 'readLin', at: i as 0 | 1 })}>{s.mode === 'single' ? 'linearizable read' : 'read'}</button>
            {s.mode === 'single' && <button className="btn sm" onClick={() => act({ kind: 'readLocal', at: i as 0 | 1 })}>local read</button>}
          </span>
        ))}
      </Controls>
      <div>
        <Stat label="Requests refused (unavailable)" value={unavail} tone={unavail ? 'bad' : 'good'} />
        <Stat label="Datacenters agree" value={s.dc[0] === s.dc[1] && !s.conflict ? 'yes' : 'no'} tone={s.dc[0] === s.dc[1] && !s.conflict ? 'good' : 'warn'} />
      </div>
      <Log lines={log.lines} />
    </div>
  );
}
