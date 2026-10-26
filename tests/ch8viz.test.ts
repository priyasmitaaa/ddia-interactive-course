import { describe, expect, it } from 'vitest';
import { FATES, fateTimeline, simulateDetector } from '../src/viz/NetworkTimeoutSim';
import { driftMs, intervals, lwwFigure83, measureAcrossSync } from '../src/viz/ClockSkewLWW';
import { simulateLease } from '../src/viz/LeaseFencingSim';

describe('NetworkTimeoutSim', () => {
  it('every fault in Figure 8-1 looks the same to the client: a timeout', () => {
    for (const f of FATES) {
      const t = fateTimeline(f.value, 120);
      expect(t.clientSees, f.value).toBe(f.value === 'ok' ? 'response' : 'timeout');
    }
  });
  it('requests are processed in cases 5 and 6, and later in cases 2 and 4', () => {
    expect(fateTimeline('respLost', 120).procStart).not.toBeNull();
    expect(fateTimeline('respDelayed', 120).procStart).not.toBeNull();
    expect(fateTimeline('reqQueued', 120).procStart!).toBeGreaterThan(120);
    expect(fateTimeline('paused', 120).procStart!).toBeGreaterThan(120);
    expect(fateTimeline('reqLost', 120).procStart).toBeNull();
    expect(fateTimeline('crashed', 120).procStart).toBeNull();
  });
  it('short timeouts cause false suspicions; long ones slow detection', () => {
    const base = { load: 0.7, spikes: 0.02, adaptive: false, k: 4, seed: 3 };
    const short = simulateDetector({ ...base, timeout: 5 });
    const long = simulateDetector({ ...base, timeout: 1500 });
    expect(short.falseSuspicions).toBeGreaterThan(long.falseSuspicions);
    expect(long.falseSuspicions).toBe(0);
    expect(long.detectionDelay).toBeGreaterThan(short.detectionDelay);
  });
  it('higher load makes the same fixed timeout fire more often', () => {
    const p = { spikes: 0, timeout: 10, adaptive: false, k: 4, seed: 11 };
    expect(simulateDetector({ ...p, load: 0.9 }).falseSuspicions).toBeGreaterThan(simulateDetector({ ...p, load: 0.3 }).falseSuspicions);
  });
});

describe('ClockSkewLWW', () => {
  it('reproduces the drift numbers on p. 281', () => {
    expect(driftMs(200, 30)).toBeCloseTo(6, 6);
    expect(driftMs(200, 86400) / 1000).toBeCloseTo(17.28, 2);
  });
  it('a stepped time-of-day clock can measure a negative duration; a slewed one cannot', () => {
    expect(measureAcrossSync(200, 86396, 10, 86400, 'step').measured).toBeLessThan(0);
    expect(measureAcrossSync(200, 86396, 10, 86400, 'slew').measured).toBeGreaterThan(9.9);
  });
  it('reproduces Figure 8-3: B gets ts 42.003 < 42.004 and its increment is lost', () => {
    const r = lwwFigure83({ skew3: -3, repDelay: 1, think: 1, logical: false });
    expect(r.tsA).toBeCloseTo(42.004, 6);
    expect(r.tsB).toBeCloseTo(42.003, 6);
    expect(r.lost).toBe(true);
  });
  it('with no skew, or with logical timestamps, the causally later write wins', () => {
    expect(lwwFigure83({ skew3: 0, repDelay: 1, think: 1, logical: false }).lost).toBe(false);
    expect(lwwFigure83({ skew3: -3, repDelay: 1, think: 1, logical: true }).lost).toBe(false);
  });
  it('confidence intervals: overlap means uncertain order; commit wait guarantees later timestamps', () => {
    expect(intervals(7, 5, false).overlap).toBe(true);
    expect(intervals(7, 20, false).overlap).toBe(false);
    for (let gap = 0; gap <= 40; gap++) {
      const r = intervals(7, gap, true);
      if (r.bCouldDepend) expect(r.overlap, `gap ${gap}`).toBe(false);
    }
  });
});

describe('LeaseFencingSim', () => {
  const book = { lease: 30, pause: 15, clockOffset: 0 };
  it('Figure 8-4: without fencing, the paused client corrupts the file', () => {
    const r = simulateLease({ ...book, fencing: false });
    expect(r.corrupted).toBe(true);
    const c1Late = r.writes.find((w) => w.client === 1 && !w.insideLease)!;
    expect(c1Late.accepted).toBe(true);
    expect(r.writes.find((w) => w.client === 2)!.t).toBeLessThan(c1Late.t);
  });
  it('Figure 8-5: with fencing, token 33 is rejected after 34', () => {
    const r = simulateLease({ ...book, fencing: true });
    expect(r.corrupted).toBe(false);
    const c1Late = r.writes.find((w) => w.client === 1 && !w.insideLease)!;
    expect(c1Late.accepted).toBe(false);
    expect(c1Late.token).toBe(33);
  });
  it('a short pause is harmless, and client 1 keeps renewing', () => {
    const r = simulateLease({ ...book, pause: 2, fencing: false });
    expect(r.corrupted).toBe(false);
    expect(r.unsafeAccepted).toBe(0);
    expect(r.writes.every((w) => w.client === 1)).toBe(true);
  });
  it('a clock that is behind makes client 1 write after its lease expired, even without any pause', () => {
    const r = simulateLease({ lease: 30, pause: 0, clockOffset: -15, fencing: false });
    expect(r.unsafeAccepted).toBeGreaterThan(0);
    expect(r.corrupted).toBe(true);
    expect(simulateLease({ lease: 30, pause: 0, clockOffset: -15, fencing: true }).corrupted).toBe(false);
  });
});
