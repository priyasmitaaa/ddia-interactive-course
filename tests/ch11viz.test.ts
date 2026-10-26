import { describe, expect, it } from 'vitest';
import { deliveries, overload } from '../src/viz/BrokerSim';
import { commit, consume, crashConsumer, initLog, keyPartition, produce, replayFrom, retain } from '../src/viz/LogBrokerSim';
import { CHANGELOG, compact, dualWrite, materialize } from '../src/viz/DualWriteSim';
import { cartState, handleCommand, naiveCompaction, type CartEvent } from '../src/viz/EventSourcingViz';
import { WIN_EVENTS, countPerSecond, figure117, hopping, sessions, sliding, tumbling, watermarkWindows } from '../src/viz/StreamTimeViz';
import { runConsumer } from '../src/viz/ExactlyOnceSim';

describe('BrokerSim', () => {
  it('drop loses messages, buffer grows without bound, backpressure blocks the producer', () => {
    const d = overload('drop', 12, 10, 20);
    const b = overload('buffer', 12, 10, 20);
    const p = overload('backpressure', 12, 10, 20);
    expect(d.dropped).toBeGreaterThan(0);
    expect(b.dropped).toBe(0);
    expect(b.finalQueue).toBe(60);           // 2 extra per tick × 30 ticks
    expect(p.dropped).toBe(0);
    expect(p.producerBlocked).toBeGreaterThan(0);
    expect(p.maxQueue).toBeLessThanOrEqual(20);
  });
  it('Figure 11-2: load balancing + redelivery reorders m3 and m4', () => {
    const r = deliveries('lb', true);
    expect(r.processedBy[0]).toEqual(['m2', 'm4', 'm3', 'm5']);
    expect(r.processedBy[1]).toEqual(['m1']);
  });
  it('fan-out gives every message to every consumer', () => {
    const r = deliveries('fanout', false);
    expect(r.processedBy[0]).toEqual(['m1', 'm2', 'm3', 'm4', 'm5']);
    expect(r.processedBy[1]).toEqual(['m1', 'm2', 'm3', 'm4', 'm5']);
  });
});

describe('LogBrokerSim', () => {
  const build = () => { let s = initLog(); for (let i = 0; i < 12; i++) s = produce(s, ['a', 'b', 'c', 'd'][i % 4]); return s; };
  it('same key always lands in the same partition, preserving per-key order', () => {
    const s = build();
    const p = keyPartition('a', 3);
    const aMsgs = s.partitions[p].msgs.filter((m) => m.startsWith('a#')).map((m) => Number(m.split('#')[1]));
    expect(aMsgs).toEqual([...aMsgs].sort((x, y) => x - y));
    for (let q = 0; q < 3; q++) if (q !== p) expect(s.partitions[q].msgs.some((m) => m.startsWith('a#'))).toBe(false);
  });
  it('a crash after consuming but before committing causes reprocessing; committing first avoids it', () => {
    let s = consume(build(), 2);
    s = crashConsumer(s, 1);
    s = consume(s, 10);
    expect(s.processed.some((x) => x.dup)).toBe(true);
    let t = commit(consume(build(), 2));
    t = consume(crashConsumer(t, 1), 10);
    expect(t.processed.some((x) => x.dup)).toBe(false);
  });
  it('retention deletes old messages and a lagging consumer skips them', () => {
    let s = retain(build(), 2);
    expect(s.partitions.every((p) => p.msgs.length <= 2)).toBe(true);
    s = consume(s, 10);
    expect(s.processed.length).toBeLessThan(12);
    expect(s.processed.every((x) => x.off >= s.partitions[x.p].offset0)).toBe(true);
  });
  it('replay re-reads history without changing the log', () => {
    let s = commit(consume(build(), 10));
    const before = JSON.stringify(s.partitions);
    s = consume(replayFrom(s, 0), 10);
    expect(JSON.stringify(s.partitions)).toBe(before);
    expect(s.processed.length).toBe(24);
  });
});

describe('DualWriteSim', () => {
  it('Figure 11-4: interleaved dual writes diverge; CDC always converges', () => {
    expect(dualWrite('A-first', 'B-first', false).consistent).toBe(false);
    expect(dualWrite('A-first', 'A-first', false).consistent).toBe(true);
    for (const a of ['A-first', 'B-first'] as const) for (const b of ['A-first', 'B-first'] as const) {
      expect(dualWrite(a, b, true).consistent).toBe(true);
    }
  });
  it('a failed write in a dual-write also diverges', () => {
    expect(dualWrite('A-first', 'B-first', false, true).consistent).toBe(false);
  });
  it('compaction keeps the latest value per key, drops tombstones, and rebuilds the same state', () => {
    const c = compact(CHANGELOG);
    expect(c.length).toBe(3);
    expect(materialize(c)).toEqual(materialize(CHANGELOG));
    expect(materialize(c)['user:2']).toBeUndefined();
  });
});

describe('EventSourcingViz', () => {
  it('derives state by replaying events', () => {
    const evs: CartEvent[] = [{ type: 'ItemAdded', item: 'book', qty: 1 }, { type: 'ItemAdded', item: 'book', qty: 1 }, { type: 'ItemAdded', item: 'mug', qty: 1 }, { type: 'ItemRemoved', item: 'mug' }];
    expect(cartState(evs).items).toEqual({ book: 2 });
  });
  it('commands are validated before becoming events', () => {
    expect(handleCommand([], { type: 'CheckedOut' }).ok).toBe(false);
    expect(handleCommand([{ type: 'ItemAdded', item: 'lamp', qty: 1 }], { type: 'ItemAdded', item: 'lamp', qty: 1 }).ok).toBe(false);
  });
  it('last-event-per-key compaction breaks event-sourced state', () => {
    const evs: CartEvent[] = [{ type: 'ItemAdded', item: 'book', qty: 1 }, { type: 'ItemAdded', item: 'book', qty: 1 }];
    expect(cartState(naiveCompaction(evs)).items).not.toEqual(cartState(evs).items);
  });
});

describe('StreamTimeViz', () => {
  it('Figure 11-7: processing-time counts spike after a restart; event-time counts stay steady', () => {
    const evs = figure117(10, 20, 6, 11, 3);
    const proc = countPerSecond(evs, 'processing', 20);
    const ev = countPerSecond(evs, 'event', 20);
    expect(Math.max(...proc)).toBeGreaterThan(20);
    expect(Math.min(...proc.slice(6, 11))).toBe(0);
    expect(ev.every((c) => c === 10)).toBe(true);
  });
  it('a straggler is dropped with a small lateness allowance, included with a big one', () => {
    const evs = figure117(10, 20, 6, 6, 3, 9);
    expect(watermarkWindows(evs, 0.5, 'drop').dropped).toBe(1);
    expect(watermarkWindows(evs, 0.5, 'correct').corrections.length).toBe(1);
    expect(watermarkWindows(evs, 10, 'drop').dropped).toBe(0);
  });
  it('window types', () => {
    const t = tumbling(WIN_EVENTS, 10);
    expect(t.reduce((a, w) => a + w.evs.length, 0)).toBe(WIN_EVENTS.length);        // each event exactly once
    expect(hopping(WIN_EVENTS, 10, 5).reduce((a, w) => a + w.evs.length, 0)).toBe(WIN_EVENTS.length * 2); // overlap
    expect(sliding(WIN_EVENTS, 10).length).toBe(WIN_EVENTS.length);
    expect(sessions(WIN_EVENTS, 5).map((s) => s.evs.length)).toEqual([4, 3, 3, 2]);
  });
});

describe('ExactlyOnceSim', () => {
  it('commit-then-write loses an event; write-then-commit duplicates one; idempotent and atomic are exact', () => {
    for (let crash = 0; crash < 5; crash++) {
      const amo = runConsumer('at-most-once', crash, 'between');
      const alo = runConsumer('at-least-once', crash, 'between');
      expect(amo.balance).toBeLessThan(amo.expected);
      expect(alo.balance).toBeGreaterThan(alo.expected);
      expect(runConsumer('idempotent', crash, 'between').correct).toBe(true);
      expect(runConsumer('atomic', crash, 'between').correct).toBe(true);
    }
  });
});
