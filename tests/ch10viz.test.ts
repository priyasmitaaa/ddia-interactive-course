import { describe, expect, it } from 'vitest';
import { runPipeline, sampleLog } from '../src/viz/PipelineViz';
import { INPUT_SPLITS, hashKey, runMapReduce } from '../src/viz/MapReduceViz';
import { CELEB, EVENTS, USERS, broadcastJoin, partitionedJoin, skewedEvents, sortMergeJoin } from '../src/viz/JoinViz';
import { pJobHit, pTaskKilled, schedule } from '../src/viz/BatchFaultsViz';
import { EDGES, V, prInit, prStep, ssspInit, ssspStep } from '../src/viz/PregelViz';

describe('PipelineViz', () => {
  const log = sampleLog();
  it('the awk stage extracts the 7th field (the URL)', () => {
    expect(runPipeline(log, 1, 'url')[0]).toMatch(/^\//);
    expect(runPipeline(log, 1, 'ip')[0]).toMatch(/^\d+\.\d+\.\d+\.\d+$/);
  });
  it('the full pipeline matches a direct count', () => {
    const counts = new Map<string, number>();
    for (const l of log) { const u = l.split(/\s+/)[6]; counts.set(u, (counts.get(u) ?? 0) + 1); }
    const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
    const out = runPipeline(log, 5, 'url').map((l) => l.trim().split(/\s+/));
    expect(out.length).toBe(5);
    expect(out.map((o) => Number(o[0]))).toEqual(top.map((t) => t[1]));
    expect(out[0][1]).toBe('/favicon.ico');
  });
  it('the no-css variant drops CSS files', () => {
    expect(runPipeline(log, 5, 'url-no-css').some((l) => l.endsWith('.css'))).toBe(false);
  });
});

describe('MapReduceViz', () => {
  it('counts every URL once in total across reducers, whatever the number of reducers', () => {
    for (const R of [1, 2, 3, 4]) {
      const r = runMapReduce(INPUT_SPLITS, R);
      const all = r.reduceOut.flat();
      const keys = all.map((x) => x.k);
      expect(new Set(keys).size, `R=${R}`).toBe(keys.length);           // each key at exactly one reducer
      expect(all.reduce((a, b) => a + b.v, 0)).toBe(INPUT_SPLITS.flat().length);
      expect(all.find((x) => x.k === '/favicon.ico')!.v).toBe(4);
    }
  });
  it('each key goes to reducer hash(key) mod R, and reducer input is sorted', () => {
    const r = runMapReduce(INPUT_SPLITS, 3);
    r.reduceIn.forEach((kvs, j) => {
      kvs.forEach((kv) => expect(hashKey(kv.k) % 3).toBe(j));
      expect(kvs.map((x) => x.k)).toEqual([...kvs.map((x) => x.k)].sort((a, b) => a.localeCompare(b)));
    });
  });
});

describe('JoinViz', () => {
  const expected = EVENTS.length;
  it('all three join algorithms produce the same joined records', () => {
    const a = sortMergeJoin(EVENTS, USERS, 2).output.flat().sort();
    const b = broadcastJoin(EVENTS, USERS, 2).output.flat().sort();
    const c = partitionedJoin(EVENTS, USERS, 2).output.flat().sort();
    expect(a.length).toBe(expected);
    expect(b).toEqual(a);
    expect(c).toEqual(a);
  });
  it('secondary sort puts the user record before that user\'s events', () => {
    for (const items of sortMergeJoin(EVENTS, USERS, 2).reducers) {
      const firstForKey = new Map<number, string>();
      for (const it of items) if (!firstForKey.has(it.key)) firstForKey.set(it.key, it.kind);
      for (const kind of firstForKey.values()) expect(kind).toBe('user');
    }
  });
  it('broadcast loads the whole small table into every mapper; partitioned loads it once in total', () => {
    expect(broadcastJoin(EVENTS, USERS, 2).loaded).toBe(USERS.length * 2);
    expect(partitionedJoin(EVENTS, USERS, 2).loaded).toBe(USERS.length);
  });
  it('a linchpin key skews one reducer; the skew join evens it out and still joins correctly', () => {
    const plain = sortMergeJoin(skewedEvents(), USERS, 2);
    const fixed = sortMergeJoin(skewedEvents(), USERS, 2, true);
    const imbalance = (l: number[]) => Math.max(...l) / Math.min(...l);
    expect(imbalance(plain.load)).toBeGreaterThan(2);
    expect(imbalance(fixed.load)).toBeLessThan(imbalance(plain.load));
    expect(fixed.output.flat().sort()).toEqual(plain.output.flat().sort());
    expect(fixed.output.flat().filter((o) => o.includes('/reply/')).length).toBe(16);
    expect(CELEB % 2).toBe(1);
  });
});

describe('BatchFaultsViz', () => {
  it('reproduces the book: 100 tasks x 10 min at 5%/hour → more than 50% risk', () => {
    expect(pTaskKilled(0.05, 60)).toBeCloseTo(0.05, 10);
    expect(pJobHit(0.05, 100, 10)).toBeGreaterThan(0.5);
    expect(pJobHit(0.05, 1, 10)).toBeLessThan(0.01);
  });
  it('pipelined dataflow finishes no later than chained MapReduce, and the gap grows with stragglers', () => {
    const a = schedule({ tasks: 4, base: 5, straggler: 1, materialize: 0 });
    expect(a.dfTotal).toBeLessThanOrEqual(a.mrTotal);
    const b = schedule({ tasks: 4, base: 5, straggler: 4, materialize: 4 });
    expect(b.mrTotal - b.dfTotal).toBeGreaterThan(a.mrTotal - a.dfTotal);
  });
});

describe('PregelViz', () => {
  it('SSSP converges to the true shortest distances (checked with Bellman-Ford)', () => {
    let s = ssspInit(0);
    for (let i = 0; i < 20 && (i === 0 || s.inbox.some((m) => m.length)); i++) s = ssspStep(s);
    const d = V.map(() => Infinity); d[0] = 0;
    for (let i = 0; i < V.length; i++) for (const [f, t, w] of EDGES) if (d[f] + w < d[t]) d[t] = d[f] + w;
    expect(s.dist).toEqual(d);
    expect(s.inbox.every((m) => m.length === 0)).toBe(true);
  });
  it('PageRank keeps total rank at 1 and converges', () => {
    let p = prInit();
    for (let i = 0; i < 60; i++) p = prStep(p);
    expect(p.rank.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 6);
    const q = prStep(p);
    q.rank.forEach((r, i) => expect(Math.abs(r - p.rank[i])).toBeLessThan(1e-4));
  });
});
