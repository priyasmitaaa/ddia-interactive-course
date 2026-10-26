import { useMemo, useState } from 'react';
import { Controls, Seg, Slider, Stat } from './ui';

/**
 * Chapter 8, pp. 279-286.
 * Tab "drift": a quartz clock drifting at some ppm, corrected by NTP every interval — by stepping (time-of-day
 * clock: may jump backwards) or slewing (monotonic clock: never jumps). Measure a duration across a correction.
 * Tab "lww": Figure 8-3 — last-write-wins with timestamps from slightly skewed clocks drops a causally later write.
 * Tab "interval": clock readings as confidence intervals, and Spanner-style commit wait (pp. 285-286).
 */

// ---------- drift ----------

/** Worst-case drift (ms) accumulated between synchronisations. 200 ppm x 30 s = 6 ms; x 1 day = 17.28 s (p. 281). */
export const driftMs = (ppm: number, intervalSec: number) => (ppm * 1e-6) * intervalSec * 1000;

/**
 * Elapsed-time measurement across an NTP correction. The local clock runs fast by `ppm` and was last synced
 * at real time 0. A measurement starts at real `start` s and ends `duration` s later; a correction happens at real
 * `syncAt` s. With "step", the time-of-day clock is reset at syncAt (jumping back by the accumulated error);
 * with "slew" the correction is spread out, so readings never go backwards.
 */
export function measureAcrossSync(ppm: number, start: number, duration: number, syncAt: number, mode: 'step' | 'slew') {
  const rate = 1 + ppm * 1e-6;
  const local = (t: number) => {
    if (mode === 'slew' || t < syncAt) return t * rate; // before the step, or never stepped
    return syncAt + (t - syncAt) * rate;            // after the step: reset to true time, then drifting again
  };
  const end = start + duration;
  const measured = local(end) - local(start);
  return { measured, truth: duration, jump: mode === 'step' && start < syncAt && end >= syncAt ? -(syncAt * rate - syncAt) : 0 };
}

// ---------- LWW (Figure 8-3) ----------

export interface LwwParams {
  skew3: number;    // node 3's clock offset relative to node 1, ms (negative = behind)
  repDelay: number; // ms for node 1's write to reach node 3
  think: number;    // ms between B seeing x=1 on node 3 and B's increment
  logical: boolean; // use Lamport-style logical timestamps instead of time-of-day
}

/** Returns the two writes' timestamps, which one node 2 keeps, and whether the increment was lost. */
export function lwwFigure83(p: LwwParams) {
  const realA = 42.004;                         // seconds; node 1's clock is the reference
  const realB = realA + (p.repDelay + p.think) / 1000;
  if (p.logical) {
    // Lamport: node 1 counter 1 for A; node 3 sees ts 1, bumps to max(own,1)+1 = 2 for B.
    return { tsA: 1, tsB: 2, keep: 'B' as const, lost: false, realA, realB, minThinkToWin: 0 };
  }
  const tsA = +realA.toFixed(6);
  const tsB = +(realB + p.skew3 / 1000).toFixed(6);
  const keep = tsB > tsA ? ('B' as const) : ('A' as const); // tie: A wins (tie-break on node id, node 1 < node 3)
  // B's write wins only if think > -skew3 - repDelay (ms)
  const minThinkToWin = Math.max(0, -p.skew3 - p.repDelay);
  return { tsA, tsB, keep, lost: keep === 'A', realA, realB, minThinkToWin };
}

// ---------- confidence intervals ----------

/** TrueTime-style intervals [t-eps, t+eps]. With commit wait, A's commit becomes visible just after tA + 2*eps. */
export function intervals(eps: number, gap: number, commitWait: boolean) {
  const tA = 100, tB = tA + gap;
  const A = [tA - eps, tA + eps] as const;
  const B = [tB - eps, tB + eps] as const;
  const overlap = B[0] <= A[1];
  // A's timestamp is A.latest; with commit wait, A becomes visible only once TT.now().earliest > A.latest,
  // i.e. strictly after real time tA + 2*eps.
  const visibleAt = commitWait ? tA + 2 * eps : tA;
  const bCouldDepend = commitWait ? tB > visibleAt : tB >= visibleAt;
  return { A, B, overlap, visibleAt, bCouldDepend };
}

// ---------- UI ----------

export default function ClockSkewLWW({ initialTab = 'lww' }: { initialTab?: 'drift' | 'lww' | 'interval' }) {
  const [tab, setTab] = useState<'drift' | 'lww' | 'interval'>(initialTab);
  return (
    <div>
      <Controls>
        <Seg value={tab} onChange={setTab} options={[
          { value: 'drift', label: 'Drift & NTP' },
          { value: 'lww', label: 'Last write wins' },
          { value: 'interval', label: 'Confidence intervals' },
        ]} />
      </Controls>
      {tab === 'drift' ? <DriftTab /> : tab === 'lww' ? <LwwTab /> : <IntervalTab />}
    </div>
  );
}

const INTERVALS: { v: number; label: string }[] = [
  { v: 1, label: '1 s' }, { v: 30, label: '30 s' }, { v: 60, label: '1 min' }, { v: 3600, label: '1 h' }, { v: 86400, label: '1 day' }, { v: 7 * 86400, label: '1 week' },
];

function DriftTab() {
  const [ppm, setPpm] = useState(200);
  const [ix, setIx] = useState(1);
  const [mode, setMode] = useState<'step' | 'slew'>('step');
  const interval = INTERVALS[ix].v;
  const d = driftMs(ppm, interval);
  // a 10-second operation that straddles a sync after 1 day of drift
  const m = measureAcrossSync(ppm, 86400 - 4, 10, 86400, mode);
  const W = 640, H = 190, x0 = 40;
  const X = (t: number) => x0 + (t / 100) * (W - x0 - 10);
  // Shape of the error over time (illustrative): drift adds error; NTP corrects at each sync.
  // step: the error snaps back to 0. slew: the clock rate is adjusted, so the error shrinks gradually.
  const stepPath: string[] = [];
  const slewPath: string[] = [];
  let slewErr = 0, correcting = false;
  for (let t = 0; t <= 100; t++) {
    const stepErr = t % 25;
    if (t > 0) {
      if (t % 25 === 0) correcting = true;
      slewErr += correcting ? -1 : 1;
      if (slewErr <= 0) { slewErr = 0; correcting = false; }
    }
    stepPath.push(`${t ? 'L' : 'M'}${X(t).toFixed(1)} ${(130 - stepErr * 4).toFixed(1)}`);
    slewPath.push(`${t ? 'L' : 'M'}${X(t).toFixed(1)} ${(130 - slewErr * 4).toFixed(1)}`);
  }
  return (
    <div>
      <Controls>
        <Slider label="Quartz drift" value={ppm} min={0} max={500} step={10} onChange={setPpm} fmt={(v) => `${v} ppm`} />
        <Slider label="Resync every" value={ix} min={0} max={INTERVALS.length - 1} onChange={setIx} fmt={(v) => INTERVALS[v].label} />
      </Controls>
      <div>
        <Stat label="Worst-case drift before next sync" value={d >= 1000 ? `${(d / 1000).toFixed(2)} s` : `${d.toFixed(d < 1 ? 3 : 1)} ms`} tone={d > 100 ? 'bad' : d > 10 ? 'warn' : 'good'} />
        <span className="small muted"> Book: Google assumes 200 ppm → 6 ms at 30 s, 17 s at one day (p. 281).</span>
      </div>
      <svg className="dg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Clock error over time, corrected by stepping versus slewing">
        <line x1={x0} x2={W - 10} y1={130} y2={130} stroke="var(--ink-3)" />
        <text x={x0 - 6} y={134} textAnchor="end" className="sub">0</text>
        <text x={6} y={40} className="sub">error</text>
        {[25, 50, 75].map((t) => <g key={t}><line x1={X(t)} x2={X(t)} y1={20} y2={130} stroke="var(--line)" strokeDasharray="3 3" /><text x={X(t)} y={148} textAnchor="middle" className="sub">NTP sync</text></g>)}
        <path d={stepPath.join(' ')} stroke="var(--v-d)" strokeWidth={2} fill="none" />
        <path d={slewPath.join(' ')} stroke="var(--v-b)" strokeWidth={2} fill="none" strokeDasharray="6 3" />
        <text x={x0} y={H - 22} fill="var(--v-d)" fontWeight={700}>— step (time-of-day clock may jump)</text>
        <text x={x0 + 300} y={H - 22} fill="var(--v-b)" fontWeight={700}>- - slew (rate adjusted, max 0.05%)</text>
        <text x={x0} y={H - 4} className="sub">time → (shape only; not to scale)</text>
      </svg>
      <Controls>
        <span>Measure a 10-second operation that straddles a correction after one day without sync, using a clock corrected by</span>
        <Seg value={mode} onChange={setMode} options={[{ value: 'step', label: 'step (time-of-day)' }, { value: 'slew', label: 'slew (monotonic)' }]} />
      </Controls>
      <div>
        <Stat label="Measured duration" value={`${m.measured.toFixed(3)} s`} tone={Math.abs(m.measured - 10) > 1 ? 'bad' : 'good'} />
        <Stat label="True duration" value="10.000 s" />
        {mode === 'step' && <span className="small muted"> At {ppm} ppm the clock gained {(driftMs(ppm, 86400) / 1000).toFixed(2)} s in a day; the step sends it back, so elapsed time looks {m.measured < 0 ? 'negative' : 'too short'}.</span>}
        {mode === 'slew' && <span className="small muted"> Without a jump the measurement is off only by the drift itself — fine for timeouts (p. 281). Real NTP slews by at most 0.05% (p. 280), so a big error takes a long time to correct; here the correction is modelled as spread out.</span>}
      </div>
    </div>
  );
}

function LwwTab() {
  const [skew3, setSkew3] = useState(-3);
  const [repDelay, setRepDelay] = useState(1);
  const [think, setThink] = useState(1);
  const [logical, setLogical] = useState(false);
  const r = lwwFigure83({ skew3, repDelay, think, logical });
  const fmt = (t: number) => (logical ? String(t) : t.toFixed(3));
  const W = 640, H = 230, x0 = 70;
  const X = (ms: number) => x0 + ((ms + 2) / 16) * (W - x0 - 20); // ms after A's write
  const y1 = 40, y2 = 110, y3 = 180;
  const aMs = 0, bMs = repDelay + think, arrive2A = 3, arrive2B = bMs + 2;
  return (
    <div>
      <Controls>
        <Slider label="Node 3 clock vs node 1" value={skew3} min={-10} max={10} step={0.5} onChange={setSkew3} fmt={(v) => `${v > 0 ? '+' : ''}${v} ms`} />
        <Slider label="Replication delay 1→3" value={repDelay} min={0.5} max={5} step={0.5} onChange={setRepDelay} fmt={(v) => `${v} ms`} />
        <Slider label="B's think time" value={think} min={0} max={6} step={0.5} onChange={setThink} fmt={(v) => `${v} ms`} />
      </Controls>
      <Controls>
        <Seg value={logical ? 'l' : 'p'} onChange={(v) => setLogical(v === 'l')} options={[{ value: 'p', label: 'time-of-day timestamps' }, { value: 'l', label: 'logical counter (preview of Ch 9)' }]} />
        <button className="btn sm" onClick={() => { setSkew3(-3); setRepDelay(1); setThink(1); setLogical(false); }}>Figure 8-3 values</button>
      </Controls>
      <svg className="dg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Three nodes; a write on node 1 is replicated to node 3, incremented there, and both arrive at node 2">
        {[['Node 1', y1], ['Node 2', y2], ['Node 3', y3]].map(([n, y]) => (
          <g key={n as string}><text x={8} y={(y as number) + 4} fontWeight={700}>{n}</text><line x1={x0} x2={W - 10} y1={y as number} y2={y as number} stroke="var(--ink-3)" /></g>
        ))}
        {/* A's write on node 1 */}
        <circle cx={X(aMs)} cy={y1} r={5} fill="var(--v-a)" />
        <text x={X(aMs)} y={y1 - 10} textAnchor="middle" fill="var(--v-a)" fontWeight={700}>A: x = 1 · ts {fmt(r.tsA)}</text>
        {/* replication 1 -> 3 */}
        <path d={`M${X(aMs)} ${y1} L${X(repDelay)} ${y3}`} stroke="var(--v-a)" strokeWidth={1.6} fill="none" />
        {/* B's increment on node 3 */}
        <circle cx={X(bMs)} cy={y3} r={5} fill="var(--v-e)" />
        <text x={X(bMs)} y={y3 + 22} textAnchor="middle" fill="var(--v-e)" fontWeight={700}>B: x += 1 → 2 · ts {fmt(r.tsB)}</text>
        {/* replication to node 2 */}
        <path d={`M${X(aMs)} ${y1} L${X(arrive2A)} ${y2}`} stroke="var(--v-a)" strokeWidth={1.6} fill="none" strokeDasharray="4 3" />
        <path d={`M${X(bMs)} ${y3} L${X(arrive2B)} ${y2}`} stroke="var(--v-e)" strokeWidth={1.6} fill="none" strokeDasharray="4 3" />
        <rect x={X(Math.max(arrive2A, arrive2B)) + 6} y={y2 - 16} width={150} height={32} rx={6} className={r.lost ? 'boxd' : 'boxb'} />
        <text x={X(Math.max(arrive2A, arrive2B)) + 81} y={y2 + 5} textAnchor="middle" fontWeight={700}>LWW keeps x = {r.keep === 'B' ? 2 : 1}</text>
        <text x={x0} y={H - 6} className="sub">real time → (the true order: A, then B)</text>
      </svg>
      <div>
        <Stat label="Causally later write" value="B (it read A's x = 1)" />
        <Stat label="Winner by timestamp" value={r.keep} tone={r.lost ? 'bad' : 'good'} />
        <Stat label="Result" value={r.lost ? "B's increment silently lost" : 'correct'} tone={r.lost ? 'bad' : 'good'} />
        {!logical && skew3 < 0 && <span className="small muted"> With this skew, B's write would only win if it came ≥ {r.minThinkToWin.toFixed(1)} ms after seeing A's — writes from the slow node are dropped until the skew has elapsed (p. 284).</span>}
      </div>
    </div>
  );
}

function IntervalTab() {
  const [eps, setEps] = useState(7);
  const [gap, setGap] = useState(5);
  const [wait, setWait] = useState(false);
  const r = intervals(eps, gap, wait);
  const W = 640, H = 150, x0 = 30;
  const lo = 100 - 30, hi = 100 + 60;
  const X = (t: number) => x0 + ((t - lo) / (hi - lo)) * (W - x0 - 10);
  return (
    <div>
      <Controls>
        <Slider label="Clock uncertainty ε" value={eps} min={1} max={20} onChange={setEps} fmt={(v) => `±${v} ms`} />
        <Slider label="B starts after A by" value={gap} min={0} max={50} onChange={setGap} fmt={(v) => `${v} ms`} />
        <label><input type="checkbox" checked={wait} onChange={(e) => setWait(e.target.checked)} /> commit wait (Spanner)</label>
      </Controls>
      <svg className="dg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Two confidence intervals on a time axis">
        <line x1={x0} x2={W - 10} y1={120} y2={120} stroke="var(--ink-3)" />
        <rect x={X(r.A[0])} y={40} width={X(r.A[1]) - X(r.A[0])} height={20} rx={4} className="boxa" />
        <text x={X(r.A[0])} y={34} className="sub">A's timestamp: [{r.A[0]}, {r.A[1]}]</text>
        <rect x={X(r.B[0])} y={78} width={X(r.B[1]) - X(r.B[0])} height={20} rx={4} className="boxe" />
        <text x={X(r.B[0])} y={112} className="sub">B's timestamp: [{r.B[0]}, {r.B[1]}]</text>
        {wait && <g><line x1={X(r.visibleAt)} x2={X(r.visibleAt)} y1={30} y2={120} stroke="var(--v-c)" strokeWidth={2} /><text x={X(r.visibleAt) + 4} y={70} fill="var(--v-c)" className="sub">A's commit visible</text></g>}
      </svg>
      <div>
        <Stat label="Intervals" value={r.overlap ? 'overlap → order uncertain' : 'disjoint → B definitely after A'} tone={r.overlap ? 'bad' : 'good'} />
        {wait && <Stat label="Could B have read A's write?" value={r.bCouldDepend ? 'yes — and its interval is guaranteed later' : 'no — A was not yet visible when B started'} tone={r.bCouldDepend && r.overlap ? 'bad' : 'good'} />}
        {wait && <Stat label="Wait added to every read-write commit" value={`${2 * eps} ms`} tone="warn" />}
      </div>
      <p className="small muted">Spanner waits out the confidence interval before a commit becomes visible, so any transaction that could see it gets a strictly later timestamp (p. 286). Smaller ε means shorter waits — hence GPS receivers and atomic clocks in each datacenter (~7 ms).</p>
    </div>
  );
}
