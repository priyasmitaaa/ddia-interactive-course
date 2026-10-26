import { useState } from 'react';
import { Controls, Seg, Stat } from './ui';

/**
 * Chapter 11, pp. 460-462: a consumer reads payment events from a log, adds each amount to an account balance in an
 * external database, and commits its consumer offset. It crashes at a chosen point and restarts from the last
 * committed offset. Strategies:
 *  - at-most-once  : commit offset, then write   → a crash in between loses the event
 *  - at-least-once : write, then commit offset   → a crash in between applies the event twice
 *  - idempotent    : store the offset with the value and skip events already applied (p. 461)
 *  - atomic        : write the value and the offset in ONE transaction in the same store (atomic commit)
 */

export type Strategy = 'at-most-once' | 'at-least-once' | 'idempotent' | 'atomic';
export const EVENTS = [5, 10, 20, 40, 80];

export function runConsumer(strategy: Strategy, crashBeforeEvent: number | null, crashPoint: 'between' | 'none') {
  let balance = 0;
  let appliedUpTo = -1;        // stored with the balance (idempotent/atomic)
  let committed = 0;           // consumer offset in the broker (next offset to read)
  const trace: string[] = [];
  const process = (off: number, allowCrash: boolean): 'crash' | 'ok' => {
    const amt = EVENTS[off];
    const crashHere = allowCrash && crashPoint === 'between' && crashBeforeEvent === off;
    if (strategy === 'at-most-once') {
      committed = off + 1; trace.push(`offset ${off}: committed offset first`);
      if (crashHere) { trace.push(`💥 crash before writing +${amt}`); return 'crash'; }
      balance += amt; trace.push(`offset ${off}: balance += ${amt} → ${balance}`);
    } else if (strategy === 'at-least-once') {
      balance += amt; trace.push(`offset ${off}: balance += ${amt} → ${balance}`);
      if (crashHere) { trace.push('💥 crash before committing the offset'); return 'crash'; }
      committed = off + 1;
    } else if (strategy === 'idempotent') {
      if (off <= appliedUpTo) { trace.push(`offset ${off}: already applied (stored offset ${appliedUpTo}) — skipped`); }
      else { balance += amt; appliedUpTo = off; trace.push(`offset ${off}: balance += ${amt} → ${balance}, stored offset ${off} with it`); }
      if (crashHere) { trace.push('💥 crash before committing the consumer offset'); return 'crash'; }
      committed = off + 1;
    } else {
      // one atomic transaction: balance and "next offset" together
      if (crashHere) { trace.push(`💥 crash during the transaction for offset ${off} — rolled back`); return 'crash'; }
      balance += amt; appliedUpTo = off; committed = off + 1;
      trace.push(`offset ${off}: one transaction {balance → ${balance}, next offset → ${off + 1}}`);
    }
    return 'ok';
  };
  let off = 0;
  let crashed = false;
  while (off < EVENTS.length) {
    const r = process(off, !crashed);
    if (r === 'crash') {
      crashed = true;
      off = strategy === 'atomic' ? appliedUpTo + 1 : committed;
      trace.push(`↻ restart: resume from offset ${off}`);
      continue;
    }
    off++;
  }
  const expected = EVENTS.reduce((a, b) => a + b, 0);
  return { balance, expected, trace, correct: balance === expected };
}

export default function ExactlyOnceSim() {
  const [strategy, setStrategy] = useState<Strategy>('at-least-once');
  const [crashAt, setCrashAt] = useState(2);
  const r = runConsumer(strategy, crashAt, 'between');
  return (
    <div>
      <Controls>
        <Seg value={strategy} onChange={setStrategy} options={[
          { value: 'at-most-once', label: 'commit, then write' },
          { value: 'at-least-once', label: 'write, then commit' },
          { value: 'idempotent', label: 'idempotent (offset stored with value)' },
          { value: 'atomic', label: 'atomic (one transaction)' },
        ]} />
      </Controls>
      <Controls>
        <label>Crash while handling offset <select value={crashAt} onChange={(e) => setCrashAt(Number(e.target.value))}>{EVENTS.map((_, i) => <option key={i} value={i}>{i} (+{EVENTS[i]})</option>)}</select></label>
      </Controls>
      <div className="log" style={{ maxHeight: 230 }}>{r.trace.map((t, i) => <div key={i} style={{ color: t.startsWith('💥') ? 'var(--bad)' : t.startsWith('↻') ? 'var(--warn)' : undefined }}>{t}</div>)}</div>
      <div style={{ marginTop: 6 }}>
        <Stat label="Final balance" value={r.balance} tone={r.correct ? 'good' : 'bad'} />
        <Stat label="Correct (each event exactly once)" value={r.expected} />
        <Stat label="Effect" value={r.correct ? 'exactly-once effect' : r.balance > r.expected ? 'an event applied twice' : 'an event lost'} tone={r.correct ? 'good' : 'bad'} />
      </div>
      <p className="small muted">Inside the framework, checkpoints or microbatches give exactly-once semantics; but once output leaves the processor (a database write, an email), a restart repeats the side effect (pp. 460–461). Either make all effects — output, state, offset — atomic, or make the write idempotent using the event's offset (which requires deterministic replay in the same order, and fencing on failover, p. 462).</p>
    </div>
  );
}
