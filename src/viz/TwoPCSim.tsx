import { useState } from 'react';
import { Controls, Seg, Stat } from './ui';

/**
 * Chapter 9, pp. 346-350: two-phase commit with a coordinator and two participants (Figures 9-9 and 9-10).
 * Choose DB 2's vote, where the coordinator crashes, what an in-doubt participant does on a timeout, and
 * whether the coordinator recovers. Step through and watch participant states and locks.
 */

export type PState = 'active' | 'prepared' | 'committed' | 'aborted';
export type Crash = 'none' | 'beforePrepare' | 'afterVotes' | 'afterDecision';
export interface TpcParams { vote2: boolean; crash: Crash; onTimeout: 'wait' | 'abort'; recover: boolean }
export interface TpcStep { text: string; coord: string; log: string | null; p: [PState, PState]; tone?: 'good' | 'bad' | 'warn' }

const locked = (s: PState) => s === 'active' || s === 'prepared';

export function run2pc(p: TpcParams): { steps: TpcStep[]; atomic: boolean; final: [PState, PState]; inDoubt: boolean } {
  const steps: TpcStep[] = [];
  let ps: [PState, PState] = ['active', 'active'];
  let coord = 'running';
  let log: string | null = null;
  const push = (text: string, tone?: TpcStep['tone']) => steps.push({ text, coord, log, p: [...ps] as [PState, PState], tone });

  push('Application writes data on DB 1 and DB 2 inside one global transaction (ID 4711). Both hold row locks.');
  if (p.crash === 'beforePrepare') {
    coord = 'crashed';
    push('Coordinator crashes before sending any prepare request.', 'bad');
    ps = ['aborted', 'aborted'];
    push('Neither participant has voted, so each may safely abort on its own after a timeout. Locks released.', 'good');
    if (p.recover) { coord = 'recovered'; push('Coordinator recovers: no commit record in its log for 4711 → aborted. Nothing to do.'); }
    return { steps, atomic: true, final: ps, inDoubt: false };
  }
  ps = ['prepared', p.vote2 ? 'prepared' : 'aborted'];
  push(`Phase 1: coordinator sends PREPARE. DB 1 writes everything to disk and votes YES (it gives up the right to abort). DB 2 votes ${p.vote2 ? 'YES' : 'NO (e.g. a constraint violation) and aborts its part'}.`, p.vote2 ? undefined : 'warn');
  if (p.crash === 'afterVotes') {
    coord = 'crashed';
    push('Coordinator crashes after collecting votes, BEFORE writing its decision to disk.', 'bad');
    if (p.onTimeout === 'abort') {
      ps = ps.map((s) => (s === 'prepared' ? 'aborted' : s)) as [PState, PState];
      push('Prepared participants time out and abort unilaterally. (This breaks 2PC’s promise — it happens to be consistent here only because no decision was made.)', 'warn');
    } else {
      push('Prepared participants are IN DOUBT: they must not commit or abort alone. Their locks stay held.', 'warn');
    }
    if (p.recover) {
      coord = 'recovered';
      ps = ps.map((s) => (s === 'prepared' ? 'aborted' : s)) as [PState, PState];
      push('Coordinator recovers, finds no decision for 4711 in its log → sends ABORT. In-doubt participants abort; locks released.', 'good');
    }
    const inDoubt = ps.includes('prepared');
    return { steps, atomic: ps[0] === ps[1] || inDoubt, final: ps, inDoubt };
  }
  const decision = p.vote2 ? 'COMMIT' : 'ABORT';
  log = decision;
  coord = `decided ${decision}`;
  push(`Coordinator writes "${decision} 4711" to its log on disk — the commit point. There is no going back now.`, 'good');
  const outcome: PState = p.vote2 ? 'committed' : 'aborted';
  ps = [ps[0], outcome];
  push(`Phase 2: coordinator sends ${decision} to DB 2 → DB 2 ${outcome}, releases its locks.`);
  if (p.crash === 'afterDecision') {
    coord = 'crashed';
    push('Coordinator crashes before sending the decision to DB 1 (Figure 9-10).', 'bad');
    if (p.onTimeout === 'abort') {
      ps = ['aborted', ps[1]];
      push(`DB 1 times out and aborts unilaterally${outcome === 'committed' ? ' — but DB 2 has COMMITTED. Atomicity is violated.' : '.'}`, outcome === 'committed' ? 'bad' : 'warn');
    } else {
      push('DB 1 is IN DOUBT ("uncertain"): it voted yes, so it can’t abort; it doesn’t know the decision, so it can’t commit. It holds its locks and waits.', 'warn');
    }
    if (p.recover && ps[0] === 'prepared') {
      coord = 'recovered';
      ps = [outcome, ps[1]];
      push(`Coordinator recovers, reads "${decision} 4711" from its log and resends it → DB 1 ${outcome}, locks released.`, 'good');
    }
    const inDoubt = ps.includes('prepared');
    return { steps, atomic: inDoubt || ps[0] === ps[1], final: ps, inDoubt };
  }
  ps = [outcome, outcome];
  push(`Coordinator sends ${decision} to DB 1 → DB 1 ${outcome}. Both participants agree; all locks released.`, 'good');
  return { steps, atomic: true, final: ps, inDoubt: false };
}

const COLORS: Record<PState, string> = { active: 'box', prepared: 'boxc', committed: 'boxb', aborted: 'boxd' };

export default function TwoPCSim() {
  const [vote2, setVote2] = useState(true);
  const [crash, setCrash] = useState<Crash>('afterDecision');
  const [onTimeout, setOnTimeout] = useState<'wait' | 'abort'>('wait');
  const [recover, setRecover] = useState(false);
  const [i, setI] = useState(0);
  const r = run2pc({ vote2, crash, onTimeout, recover });
  const k = Math.min(i, r.steps.length - 1);
  const s = r.steps[k];
  const reset = <T,>(f: (v: T) => void) => (v: T) => { f(v); setI(0); };
  const W = 640, H = 170;
  return (
    <div>
      <Controls>
        <label>DB 2 votes <Seg value={vote2 ? 'yes' : 'no'} onChange={(v) => reset(setVote2)(v === 'yes')} options={[{ value: 'yes', label: 'yes' }, { value: 'no', label: 'no' }]} /></label>
        <label>Coordinator crashes <select value={crash} onChange={(e) => reset(setCrash)(e.target.value as Crash)}>
          <option value="none">never</option>
          <option value="beforePrepare">before prepare</option>
          <option value="afterVotes">after votes, before deciding</option>
          <option value="afterDecision">after deciding, mid phase 2</option>
        </select></label>
      </Controls>
      <Controls>
        <label>In-doubt participant on timeout <Seg value={onTimeout} onChange={reset(setOnTimeout)} options={[{ value: 'wait', label: 'waits (2PC)' }, { value: 'abort', label: 'aborts (unsafe)' }]} /></label>
        <label><input type="checkbox" checked={recover} onChange={(e) => reset(setRecover)(e.target.checked)} /> coordinator recovers</label>
      </Controls>
      <svg className="dg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Coordinator and two participant databases with their states">
        <rect x={230} y={10} width={180} height={56} rx={8} className={s.coord === 'crashed' ? 'boxd' : 'boxa'} />
        <text x={320} y={32} textAnchor="middle" fontWeight={700}>Coordinator</text>
        <text x={320} y={52} textAnchor="middle" className="sub">{s.coord}{s.log ? ` · log: ${s.log}` : ' · log: —'}</text>
        {[0, 1].map((j) => (
          <g key={j}>
            <rect x={j === 0 ? 60 : 400} y={100} width={180} height={56} rx={8} className={COLORS[s.p[j]]} />
            <text x={j === 0 ? 150 : 490} y={122} textAnchor="middle" fontWeight={700}>DB {j + 1}: {s.p[j]}</text>
            <text x={j === 0 ? 150 : 490} y={142} textAnchor="middle" className="sub">{locked(s.p[j]) ? '🔒 locks held' : 'locks released'}{s.p[j] === 'prepared' && s.coord === 'crashed' ? ' · in doubt' : ''}</text>
            <path className="ln" d={`M${j === 0 ? 270 : 370} 66 L${j === 0 ? 150 : 490} 100`} />
          </g>
        ))}
      </svg>
      <div className="card" style={{ padding: '10px 14px', margin: '8px 0', borderLeft: `4px solid ${s.tone === 'bad' ? 'var(--bad)' : s.tone === 'good' ? 'var(--good)' : s.tone === 'warn' ? 'var(--warn)' : 'var(--line)'}` }}>
        <b>Step {k + 1}/{r.steps.length}.</b> {s.text}
      </div>
      <Controls>
        <button className="btn sm" disabled={k === 0} onClick={() => setI(k - 1)}>← Back</button>
        <button className="btn sm primary" disabled={k === r.steps.length - 1} onClick={() => setI(k + 1)}>Next step →</button>
        <button className="btn sm" onClick={() => setI(r.steps.length - 1)}>Jump to end</button>
      </Controls>
      {k === r.steps.length - 1 && (
        <div>
          <Stat label="Atomic (all same outcome)?" value={r.inDoubt ? 'not yet — still in doubt' : r.atomic ? 'yes' : 'NO — one committed, one aborted'} tone={r.inDoubt ? 'warn' : r.atomic ? 'good' : 'bad'} />
          <Stat label="Locks still held" value={r.final.some(locked) ? 'yes — blocking other transactions' : 'no'} tone={r.final.some(locked) ? 'warn' : 'good'} />
        </div>
      )}
    </div>
  );
}
