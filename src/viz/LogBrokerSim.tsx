import { useState } from 'react';
import { Controls, Slider, Stat, useLog, Log } from './ui';

/**
 * Chapter 11, pp. 433-436 (Figure 11-3): a log-based message broker. A topic has partitions; producers append to a
 * partition chosen by key; each partition is an append-only log with offsets. A consumer group assigns whole partitions
 * to consumers; each consumer reads its partitions sequentially and periodically COMMITS its offset. If a consumer
 * crashes, another takes over its partitions from the last committed offset - so messages processed after that
 * commit are processed again. Old segments are deleted by retention; a consumer that falls behind loses messages.
 */

export interface LogState {
  partitions: { offset0: number; msgs: string[] }[]; // offset0 = offset of first retained message
  committed: number[];      // per partition: next offset to read, as last committed
  position: number[];       // per partition: next offset the current owner will read
  owner: number[];          // per partition: consumer index
  consumersUp: boolean[];
  processed: { p: number; off: number; msg: string; dup: boolean }[];
  seen: Set<string>;
  nextMsg: number;
}

export const keyPartition = (key: string, n: number) => [...key].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 0) % n;

export function initLog(nPart = 3, nConsumers = 2): LogState {
  return {
    partitions: Array.from({ length: nPart }, () => ({ offset0: 0, msgs: [] })),
    committed: new Array(nPart).fill(0), position: new Array(nPart).fill(0),
    owner: Array.from({ length: nPart }, (_, p) => p % nConsumers),
    consumersUp: new Array(nConsumers).fill(true),
    processed: [], seen: new Set(), nextMsg: 1,
  };
}

const clone = (s: LogState): LogState => ({
  ...s, partitions: s.partitions.map((p) => ({ ...p, msgs: [...p.msgs] })), committed: [...s.committed], position: [...s.position],
  owner: [...s.owner], consumersUp: [...s.consumersUp], processed: [...s.processed], seen: new Set(s.seen),
});

export function produce(s: LogState, key: string): LogState {
  const n = clone(s);
  const p = keyPartition(key, n.partitions.length);
  n.partitions[p].msgs.push(`${key}#${n.nextMsg++}`);
  return n;
}

/** Every live consumer processes up to `k` messages from each of its partitions. */
export function consume(s: LogState, k = 2): LogState {
  const n = clone(s);
  n.partitions.forEach((part, p) => {
    if (!n.consumersUp[n.owner[p]]) return;
    if (n.position[p] < part.offset0) n.position[p] = part.offset0;       // fell behind retention: messages lost
    for (let i = 0; i < k; i++) {
      const off = n.position[p];
      const idx = off - part.offset0;
      if (idx >= part.msgs.length) break;
      const msg = part.msgs[idx];
      const id = `${p}:${off}`;
      n.processed.push({ p, off, msg, dup: n.seen.has(id) });
      n.seen.add(id);
      n.position[p]++;
    }
  });
  return n;
}

export function commit(s: LogState): LogState {
  const n = clone(s);
  n.partitions.forEach((_, p) => { if (n.consumersUp[n.owner[p]]) n.committed[p] = n.position[p]; });
  return n;
}

/** Consumer c crashes; its partitions are reassigned to a live consumer, which resumes at the last COMMITTED offset. */
export function crashConsumer(s: LogState, c: number): LogState {
  const n = clone(s);
  n.consumersUp[c] = false;
  const live = n.consumersUp.findIndex((u) => u);
  n.partitions.forEach((_, p) => {
    if (n.owner[p] === c && live >= 0) { n.owner[p] = live; n.position[p] = n.committed[p]; }
  });
  return n;
}

export function retain(s: LogState, keep: number): LogState {
  const n = clone(s);
  n.partitions.forEach((part) => {
    const drop = Math.max(0, part.msgs.length - keep);
    part.msgs.splice(0, drop);
    part.offset0 += drop;
  });
  return n;
}

export function replayFrom(s: LogState, offset: number): LogState {
  const n = clone(s);
  n.position = n.partitions.map((part) => Math.max(part.offset0, offset));
  n.seen = new Set(); // a fresh copy of the consumer writing to a new location: duplicates are expected, not errors
  return n;
}

const KEYS = ['alice', 'bob', 'carol', 'dan', 'erin', 'frank'];

export default function LogBrokerSim() {
  const [s, setS] = useState<LogState>(() => {
    let x = initLog();
    for (let i = 0; i < 9; i++) x = produce(x, KEYS[i % KEYS.length]);
    return x;
  });
  const [keep, setKeep] = useState(8);
  const log = useLog();
  const act = (ns: LogState, msg: string, tone?: 'good' | 'bad' | 'warn' | 'muted') => { setS(ns); log.add(msg, tone); };
  const dups = s.processed.filter((x) => x.dup).length;
  return (
    <div>
      <Controls>
        <button className="btn sm primary" onClick={() => { let x = s; for (let i = 0; i < 3; i++) x = produce(x, KEYS[(x.nextMsg + i) % KEYS.length]); act(x, 'producers appended 3 messages (partition = hash(key) mod 3)', 'muted'); }}>Produce 3</button>
        <button className="btn sm primary" onClick={() => { const x = consume(s); act(x, `consumers read; processed ${x.processed.length - s.processed.length} message(s)`); }}>Consume</button>
        <button className="btn sm" onClick={() => act(commit(s), 'consumers committed their offsets', 'good')}>Commit offsets</button>
        {s.consumersUp[1] && <button className="btn sm" onClick={() => act(crashConsumer(s, 1), 'consumer 2 crashed — its partitions move to consumer 1, starting at the last COMMITTED offset', 'bad')}>Crash consumer 2</button>}
      </Controls>
      <Controls>
        <Slider label="Retention (messages kept per partition)" value={keep} min={2} max={20} onChange={setKeep} />
        <button className="btn sm" onClick={() => act(retain(s, keep), `retention: deleted old segments, keeping the newest ${keep} per partition`, 'warn')}>Apply retention</button>
        <button className="btn sm" onClick={() => act(replayFrom(s, 0), 'started a copy of the consumer from offset 0 (writing elsewhere) — reprocessing history', 'muted')}>Replay from the start</button>
      </Controls>
      <div style={{ display: 'grid', gap: 6 }}>
        {s.partitions.map((part, p) => (
          <div key={p} style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ width: 150 }} className="small"><b>Partition {p}</b> → consumer {s.owner[p] + 1}{s.consumersUp[s.owner[p]] ? '' : ' (down)'}</span>
            {part.offset0 > 0 && <span className="small muted">[{part.offset0} deleted]</span>}
            {part.msgs.map((m, i) => {
              const off = part.offset0 + i;
              const read = off < s.position[p];
              const isCommit = off === s.committed[p];
              return (
                <span key={off} title={m} style={{
                  fontFamily: 'var(--mono)', fontSize: 12, padding: '3px 6px', borderRadius: 5,
                  border: `1.5px solid ${isCommit ? 'var(--v-c)' : 'var(--line)'}`,
                  background: read ? 'color-mix(in srgb, var(--v-b) 18%, transparent)' : 'var(--surface)',
                }}>{off}</span>
              );
            })}
            <span className="small muted">read up to {s.position[p]} · committed {s.committed[p]}</span>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 6 }}>
        <Stat label="Messages processed" value={s.processed.length} />
        <Stat label="Processed twice" value={dups} tone={dups ? 'warn' : 'good'} />
        <span className="small muted"> green = read by the owner · orange border = committed offset</span>
      </div>
      <Log lines={log.lines} />
      <p className="small muted">Per-partition order is total; across partitions there is none. The broker only stores one committed offset per partition — like a replication log sequence number (p. 435). Crash after consuming but before committing, and the new owner reprocesses those messages. Retention turns the log into a huge on-disk ring buffer (p. 436).</p>
    </div>
  );
}
