import { describe, expect, it } from 'vitest';
import { checkLinearizable, fig92, fig94, fig96, findCulprit } from '../src/viz/linearizability';
import { runQuorum } from '../src/viz/QuorumRaceSim';
import { capStep, initialCap } from '../src/viz/CAPSim';
import { HB_EVENTS, clocks, relation, FIG98, lamportRun } from '../src/viz/CausalityViz';
import { tobRun } from '../src/viz/TOBSim';
import { run2pc } from '../src/viz/TwoPCSim';
import { initRaft, raftTick, raftWrite, setPartition, leaders, type RaftState } from '../src/viz/RaftSim';

describe('linearizability checker', () => {
  it('Figure 9-2: concurrent reads may return 0 or 1, but not flip back (Figure 9-3)', () => {
    expect(checkLinearizable(fig92(0, 0, 1)).linearizable).toBe(true);
    expect(checkLinearizable(fig92(1, 0, 1)).linearizable).toBe(true);
    expect(checkLinearizable(fig92(1, 0, 0)).linearizable).toBe(false); // A read 1, later B read 0
    expect(checkLinearizable(fig92(0, 1, 0)).linearizable).toBe(false); // B read 1, then B read 0
  });
  it("Figure 9-4: B's final read of 2 is not linearizable; 4 is", () => {
    expect(checkLinearizable(fig94(2)).linearizable).toBe(false);
    expect(findCulprit(fig94(2))).toBe('B3');
    const ok = checkLinearizable(fig94(4));
    expect(ok.linearizable).toBe(true);
    expect(ok.order.indexOf('D1')).toBeLessThan(ok.order.indexOf('A1'));
    expect(ok.order.indexOf('A1')).toBeLessThan(ok.order.indexOf('B1'));
  });
  it('Figure 9-6 is not linearizable', () => {
    expect(checkLinearizable(fig96()).linearizable).toBe(false);
  });
  it('linearization points lie inside each operation and move forward in time', () => {
    const r = checkLinearizable(fig94(4));
    const ops = fig94(4);
    let prev = -Infinity;
    for (const id of r.order) {
      const o = ops.find((x) => x.id === id)!;
      expect(r.points[id]).toBeGreaterThanOrEqual(o.start);
      expect(r.points[id]).toBeLessThanOrEqual(o.end);
      expect(r.points[id]).toBeGreaterThan(prev);
      prev = r.points[id];
    }
  });
});

describe('QuorumRaceSim', () => {
  const fig = { d: [5, 60, 70] as [number, number, number], aStart: 18, bStart: 40 };
  it('reproduces Figure 9-6 without read repair', () => {
    const r = runQuorum({ ...fig, repair: false });
    expect(r.rA.result).toBe(1);
    expect(r.rB.result).toBe(0);
    expect(r.linearizable).toBe(false);
  });
  it('synchronous read repair makes it linearizable', () => {
    const r = runQuorum({ ...fig, repair: true });
    expect(r.rB.result).toBe(1);
    expect(r.linearizable).toBe(true);
  });
  it('with read repair, every pair of reads stays linearizable', () => {
    for (let a = 0; a <= 80; a += 4) for (let b = a + 25; b <= 100; b += 5) {
      expect(runQuorum({ d: [5, 60, 70], aStart: a, bStart: b, repair: true }).linearizable, `a=${a} b=${b}`).toBe(true);
    }
  });
});

describe('CAPSim', () => {
  it('single-leader: DC2 writes fail during an interruption, local reads are stale', () => {
    let s = initialCap('single');
    s = capStep(s, { kind: 'toggleLink' }).state;
    expect(capStep(s, { kind: 'write', at: 1 }).available).toBe(false);
    expect(capStep(s, { kind: 'readLin', at: 1 }).available).toBe(false);
    s = capStep(s, { kind: 'write', at: 0 }).state;
    const local = capStep(s, { kind: 'readLocal', at: 1 });
    expect(local.available).toBe(true);
    expect(local.stale).toBe(true);
  });
  it('multi-leader: stays available, conflicts on reconnection', () => {
    let s = initialCap('multi');
    s = capStep(s, { kind: 'toggleLink' }).state;
    const w1 = capStep(s, { kind: 'write', at: 0 }); expect(w1.available).toBe(true); s = w1.state;
    const w2 = capStep(s, { kind: 'write', at: 1 }); expect(w2.available).toBe(true); s = w2.state;
    s = capStep(s, { kind: 'toggleLink' }).state;
    expect(s.conflict).toBe(true);
  });
});

describe('CausalityViz', () => {
  const { vc, lam } = clocks(HB_EVENTS);
  it('message chains create happened-before; unrelated events are concurrent', () => {
    expect(relation(vc.a2, vc.c3)).toBe('before');
    expect(relation(vc.a2, vc.c2)).toBe('concurrent');
    expect(relation(vc.c4, vc.a4)).toBe('before');
  });
  it('Lamport timestamps are consistent with causality', () => {
    for (const x of HB_EVENTS) for (const y of HB_EVENTS) {
      if (relation(vc[x.id], vc[y.id]) === 'before') expect(lam[x.id]).toBeLessThan(lam[y.id]);
    }
  });
  it('reproduces Figure 9-8', () => {
    const { res, violations } = lamportRun(FIG98, true);
    expect(res.map((r) => r.ts.join(','))).toEqual(['1,1', '1,2', '2,2', '3,2', '4,2', '5,2', '6,1', '6,2']);
    expect(violations).toEqual([]);
  });
  it('without carrying the max, a later operation can get a smaller timestamp', () => {
    expect(lamportRun(FIG98, false).violations.length).toBeGreaterThan(0);
  });
});

describe('TOBSim', () => {
  const base = { toLog: [15, 5] as [number, number], deliver: [8, 30, 12] as [number, number, number], node2Up: true };
  it('deciding immediately on timestamps lets both users win', () => {
    expect(tobRun({ ...base, mode: 'timestamps', askAll: false }).agreed).toBe(false);
  });
  it('asking every node blocks if one is unreachable', () => {
    expect(tobRun({ ...base, mode: 'timestamps', askAll: true, node2Up: false }).blocked).toBe(true);
  });
  it('with a log exactly one claim wins, the first in log order, even with node 2 down', () => {
    for (const node2Up of [true, false]) {
      const r = tobRun({ ...base, mode: 'log', askAll: false, node2Up });
      expect(r.agreed).toBe(true);
      expect([r.outcomeX, r.outcomeY].filter((o) => o.startsWith('success')).length).toBe(1);
      expect(r.logOrder[0]).toBe('Y');
    }
  });
});

describe('TwoPCSim', () => {
  it('normal 2PC commits on both', () => {
    expect(run2pc({ vote2: true, crash: 'none', onTimeout: 'wait', recover: false }).final).toEqual(['committed', 'committed']);
  });
  it('a NO vote aborts both', () => {
    expect(run2pc({ vote2: false, crash: 'none', onTimeout: 'wait', recover: false }).final).toEqual(['aborted', 'aborted']);
  });
  it('Figure 9-10: DB 1 is stuck in doubt until the coordinator recovers', () => {
    const stuck = run2pc({ vote2: true, crash: 'afterDecision', onTimeout: 'wait', recover: false });
    expect(stuck.inDoubt).toBe(true);
    expect(stuck.final).toEqual(['prepared', 'committed']);
    const rec = run2pc({ vote2: true, crash: 'afterDecision', onTimeout: 'wait', recover: true });
    expect(rec.final).toEqual(['committed', 'committed']);
  });
  it('aborting on timeout while in doubt breaks atomicity', () => {
    expect(run2pc({ vote2: true, crash: 'afterDecision', onTimeout: 'abort', recover: false }).atomic).toBe(false);
  });
});

describe('RaftSim', () => {
  const runUntil = (s: RaftState, pred: (s: RaftState) => boolean, max = 80) => {
    for (let i = 0; i < max && !pred(s); i++) s = raftTick(s);
    return s;
  };
  for (const seed of [1, 2, 3, 4, 5]) {
    it(`seed ${seed}: elects one leader and commits a write`, () => {
      let s = runUntil(initRaft(seed), (x) => leaders(x).length === 1);
      expect(leaders(s).length).toBe(1);
      s = raftWrite(s, leaders(s)[0].id, 'v1');
      s = raftTick(s);
      expect(leaders(s)[0].commit).toBe(1);
    });
    it(`seed ${seed}: minority leader can't commit; majority elects a higher term; healing discards the stale entry`, () => {
      let s = runUntil(initRaft(seed), (x) => leaders(x).length === 1);
      const old = leaders(s)[0];
      const g = new Array(5).fill(1); g[old.id] = 0; g[(old.id + 1) % 5] = 0;
      s = setPartition(s, g);
      s = runUntil(s, (x) => leaders(x).some((l) => l.term > old.term));
      const fresh = leaders(s).find((l) => l.term > old.term)!;
      expect(fresh).toBeTruthy();
      expect(g[fresh.id]).toBe(1);
      s = raftWrite(s, old.id, 'stale');
      s = raftWrite(s, fresh.id, 'good');
      for (let i = 0; i < 3; i++) s = raftTick(s);
      expect(s.nodes[old.id].commit).toBe(0);
      expect(s.nodes[fresh.id].commit).toBe(1);
      s = setPartition(s, new Array(5).fill(0));
      s = runUntil(s, (x) => leaders(x).length === 1 && x.nodes.every((n) => !n.log.some((e) => e.v === 'stale')));
      expect(leaders(s).length).toBe(1);
      expect(s.nodes.every((n) => !n.log.some((e) => e.v === 'stale'))).toBe(true);
      expect(s.nodes.every((n) => n.log.some((e) => e.v === 'good'))).toBe(true);
    });
  }
});
