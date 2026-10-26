import { useMemo, useState } from 'react';
import { Controls, Seg, Slider, Stat, rng } from './ui';

/**
 * Chapter 8, pp. 270-278.
 * Tab 1 ("see"): Figure 8-1 — six different things can go wrong with a request, and the client sees the
 * same thing in all of them: no response yet. Reveal the hidden truth afterwards.
 * Tab 2 ("timeout"): choosing a timeout. Heartbeats travel over a network whose delay is dominated by
 * queueing; the node occasionally pauses; at a known moment it really crashes. Fixed timeouts trade false
 * suspicions against detection delay; an adaptive timeout follows the observed round-trip distribution
 * (the idea behind Phi Accrual failure detectors, p. 276).
 */

export type Fate = 'ok' | 'reqLost' | 'reqQueued' | 'crashed' | 'paused' | 'respLost' | 'respDelayed';

export const FATES: { value: Fate; label: string; processed: boolean | 'later'; book: string }[] = [
  { value: 'ok', label: 'Everything works', processed: true, book: 'baseline' },
  { value: 'reqLost', label: '1. Request lost', processed: false, book: 'someone unplugged the cable' },
  { value: 'reqQueued', label: '2. Request queued', processed: 'later', book: 'network or recipient overloaded' },
  { value: 'crashed', label: '3. Node crashed', processed: false, book: 'crashed or powered down' },
  { value: 'paused', label: '4. Node paused', processed: 'later', book: 'e.g. a long GC pause' },
  { value: 'respLost', label: '5. Response lost', processed: true, book: 'e.g. a misconfigured switch' },
  { value: 'respDelayed', label: '6. Response delayed', processed: true, book: 'network or your machine overloaded' },
];

/** Times (ms) of each step for a fate, with a timeout of `timeout` ms. Normal one-way delay 20, processing 10. */
export function fateTimeline(fate: Fate, timeout: number) {
  const d = 20, p = 10;
  const reqArrive = fate === 'reqLost' ? null : fate === 'reqQueued' ? timeout + 40 : d;
  const procStart = fate === 'crashed' || reqArrive === null ? null : fate === 'paused' ? reqArrive + timeout + 20 : reqArrive;
  const procEnd = procStart === null ? null : procStart + p;
  const respArrive = procEnd === null || fate === 'respLost' ? null : fate === 'respDelayed' ? procEnd + timeout + 30 : procEnd + d;
  const clientSees = respArrive !== null && respArrive <= timeout ? 'response' : 'timeout';
  return { reqArrive, procStart, procEnd, respArrive, clientSees } as const;
}

// ---------- failure detection ----------

export interface DetectorParams {
  load: number;        // network/node utilisation 0..0.95 — drives queueing delay
  spikes: number;      // probability per heartbeat of a pause/spike (GC, VM steal, retransmission)
  timeout: number;     // fixed timeout in ms (ignored when adaptive)
  adaptive: boolean;
  k: number;           // adaptive: mean + k * stddev of recent RTTs
  seed: number;
}

export interface DetectorResult {
  rtts: number[];          // RTT of each heartbeat before the crash
  limits: number[];        // timeout in force for each heartbeat
  falseSuspicions: number; // heartbeats declared dead although the node was alive
  detectionDelay: number;  // ms from the real crash until the node is declared dead
  crashAt: number;         // index of the heartbeat that is never answered
}

export const HEARTBEAT_MS = 1000;

/**
 * One heartbeat per second for `n` seconds; the node crashes after heartbeat `crashAt`.
 * RTT = 2 x (0.5 ms propagation + queueing) + 0.2 ms processing; queueing is exponential with mean
 * 1 ms x load/(1-load) (a textbook M/M/1 shape — a simplification, not from the book). With probability
 * `spikes`, a pause of 50-800 ms is added.
 */
export function simulateDetector(p: DetectorParams, n = 300, crashAt = 240): DetectorResult {
  const r = rng(p.seed);
  const exp = (mean: number) => -mean * Math.log(1 - r());
  const qMean = p.load / (1 - p.load);
  const rtts: number[] = [];
  const limits: number[] = [];
  let falseSuspicions = 0;
  const limitNow = () => {
    if (!p.adaptive) return p.timeout;
    const recent = rtts.slice(-100);
    if (recent.length < 10) return 1000; // until enough samples: conservative default
    const mean = recent.reduce((a, b) => a + b, 0) / recent.length;
    const sd = Math.sqrt(recent.reduce((a, b) => a + (b - mean) ** 2, 0) / recent.length);
    return mean + p.k * sd;
  };
  for (let i = 0; i < Math.min(n, crashAt); i++) {
    let rtt = 2 * (0.5 + exp(qMean)) + 0.2;
    if (r() < p.spikes) rtt += 50 + r() * 750;
    const lim = limitNow();
    limits.push(lim);
    rtts.push(rtt);
    if (rtt > lim) falseSuspicions++;
  }
  // The crash happens at a uniformly random moment between two heartbeats; the next heartbeat goes unanswered.
  const sinceCrashToNextBeat = r() * HEARTBEAT_MS;
  const detectionDelay = sinceCrashToNextBeat + limitNow();
  return { rtts, limits, falseSuspicions, detectionDelay, crashAt };
}

// ---------- UI ----------

export default function NetworkTimeoutSim({ initialTab = 'see' }: { initialTab?: 'see' | 'timeout' }) {
  const [tab, setTab] = useState<'see' | 'timeout'>(initialTab);
  return (
    <div>
      <Controls>
        <Seg value={tab} onChange={setTab} options={[{ value: 'see', label: 'What the client sees' }, { value: 'timeout', label: 'Choosing a timeout' }]} />
      </Controls>
      {tab === 'see' ? <SeeTab /> : <TimeoutTab />}
    </div>
  );
}

function SeeTab() {
  const [fate, setFate] = useState<Fate>('reqLost');
  const [reveal, setReveal] = useState(false);
  const timeout = 120;
  const t = fateTimeline(fate, timeout);
  const info = FATES.find((f) => f.value === fate)!;
  const W = 640, x0 = 70, scale = (W - x0 - 20) / 300;
  const X = (ms: number) => x0 + Math.min(ms, 300) * scale;
  const yC = 40, yN = 130;
  const hidden = !reveal;
  return (
    <div>
      <Controls>
        <label>Hidden fate of the request <select value={fate} onChange={(e) => { setFate(e.target.value as Fate); setReveal(false); }}>
          {FATES.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
        </select></label>
        <button className="btn sm" onClick={() => setReveal(!reveal)}>{reveal ? 'Hide the truth' : 'Reveal what happened'}</button>
      </Controls>
      <svg className="dg" viewBox={`0 0 ${W} 190`} role="img" aria-label="Request/response timeline between client and service">
        <text x="8" y={yC + 4} fontWeight={700}>Client</text>
        <text x="8" y={yN + 4} fontWeight={700}>Service</text>
        <line x1={x0} x2={W - 10} y1={yC} y2={yC} stroke="var(--ink-3)" />
        <line x1={x0} x2={W - 10} y1={yN} y2={yN} stroke="var(--ink-3)" strokeDasharray={!hidden && fate === 'crashed' ? '4 4' : undefined} />
        <line x1={X(timeout)} x2={X(timeout)} y1={yC - 22} y2={yC + 14} stroke="var(--v-d)" strokeWidth={2} />
        <text x={X(timeout) + 4} y={yC - 12} className="sub">timeout ({timeout} ms)</text>
        {/* request */}
        {hidden ? (
          <path d={`M${X(0)} ${yC} L${X(10)} ${yC + 14}`} stroke="var(--v-a)" strokeWidth={2} fill="none" />
        ) : t.reqArrive === null ? (
          <g><path d={`M${X(0)} ${yC} L${X(10)} ${(yC + yN) / 2}`} stroke="var(--v-a)" strokeWidth={2} fill="none" /><text x={X(10) + 4} y={(yC + yN) / 2 + 5} fill="var(--v-d)" fontWeight={700}>✕ lost</text></g>
        ) : (
          <path d={`M${X(0)} ${yC} L${X(t.reqArrive)} ${yN}`} stroke="var(--v-a)" strokeWidth={2} fill="none" markerEnd="url(#arrA)" />
        )}
        <text x={X(0)} y={yC - 8} className="sub">request</text>
        {!hidden && fate === 'crashed' && <text x={X(20)} y={yN + 22} fill="var(--v-d)" fontWeight={700}>✕ node crashed</text>}
        {!hidden && t.procStart !== null && fate === 'paused' && (
          <g><rect x={X(t.reqArrive!)} y={yN - 8} width={X(t.procStart) - X(t.reqArrive!)} height={16} fill="var(--warn-soft)" stroke="var(--v-c)" /><text x={X(t.reqArrive!) + 4} y={yN + 26} className="sub">paused (GC)</text></g>
        )}
        {!hidden && t.procStart !== null && <rect x={X(t.procStart)} y={yN - 6} width={Math.max(4, X(t.procEnd!) - X(t.procStart))} height={12} fill="var(--v-b)" />}
        {/* response */}
        {!hidden && t.procEnd !== null && (t.respArrive === null ? (
          <g><path d={`M${X(t.procEnd)} ${yN} L${X(t.procEnd + 10)} ${(yC + yN) / 2}`} stroke="var(--v-b)" strokeWidth={2} fill="none" /><text x={X(t.procEnd + 10) + 4} y={(yC + yN) / 2 + 5} fill="var(--v-d)" fontWeight={700}>✕ response lost</text></g>
        ) : (
          <path d={`M${X(t.procEnd)} ${yN} L${X(t.respArrive)} ${yC}`} stroke="var(--v-b)" strokeWidth={2} fill="none" markerEnd="url(#arrB)" />
        ))}
        {t.clientSees === 'timeout' && <text x={X(timeout) + 6} y={yC + 22} fill="var(--v-d)" fontWeight={700}>??? no response</text>}
        {t.clientSees === 'response' && <text x={X(t.respArrive!) + 6} y={yC + 22} fill="var(--v-b)" fontWeight={700}>✓ response</text>}
        <defs>
          <marker id="arrA" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0 L10 5 L0 10 z" fill="var(--v-a)" /></marker>
          <marker id="arrB" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0 L10 5 L0 10 z" fill="var(--v-b)" /></marker>
        </defs>
        <text x={x0} y={180} className="sub">0 ms</text>
        <text x={W - 60} y={180} className="sub">300 ms →</text>
      </svg>
      <div>
        <Stat label="Client sees" value={t.clientSees === 'response' ? 'a response' : 'no response by the timeout'} tone={t.clientSees === 'response' ? 'good' : 'bad'} />
        {reveal && <Stat label="Truth" value={info.label + (info.value === 'ok' ? '' : ` (${info.book})`)} />}
        {reveal && <Stat label="Did the service process the request?" value={info.processed === 'later' ? 'yes — after the client gave up' : info.processed ? 'yes' : 'no'} tone={info.processed === false ? 'good' : 'warn'} />}
      </div>
      <p className="small muted">Pick each of the six faults in turn without revealing: the client's view is identical. Then reveal — in three of the six cases the request <i>was</i> (or will be) processed, so blindly retrying could apply it twice.</p>
    </div>
  );
}

function TimeoutTab() {
  const [load, setLoad] = useState(0.5);
  const [spikes, setSpikes] = useState(0.02);
  const [timeout, setTimeout_] = useState(20);
  const [adaptive, setAdaptive] = useState(false);
  const [k, setK] = useState(4);
  const [seed, setSeed] = useState(7);
  const res = useMemo(() => simulateDetector({ load, spikes, timeout, adaptive, k, seed }), [load, spikes, timeout, adaptive, k, seed]);
  const W = 640, H = 220, x0 = 48, y0 = 10, y1 = H - 28;
  const N = 300;
  const X = (i: number) => x0 + (i / N) * (W - x0 - 10);
  const logMin = Math.log10(1), logMax = Math.log10(2000);
  const Y = (ms: number) => y1 - ((Math.log10(Math.max(1, Math.min(ms, 2000))) - logMin) / (logMax - logMin)) * (y1 - y0);
  const limPath = res.limits.map((l, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)} ${Y(l).toFixed(1)}`).join(' ');
  return (
    <div>
      <Controls>
        <Slider label="Load (utilisation)" value={load} min={0} max={0.95} step={0.05} onChange={setLoad} fmt={(v) => `${Math.round(v * 100)}%`} />
        <Slider label="Pause/spike chance" value={spikes} min={0} max={0.1} step={0.005} onChange={setSpikes} fmt={(v) => `${(v * 100).toFixed(1)}%`} />
      </Controls>
      <Controls>
        <label><input type="checkbox" checked={adaptive} onChange={(e) => setAdaptive(e.target.checked)} /> adaptive timeout</label>
        {adaptive
          ? <Slider label="k (mean + k·stddev)" value={k} min={1} max={10} step={0.5} onChange={setK} />
          : <Slider label="Fixed timeout" value={timeout} min={2} max={1500} step={1} onChange={setTimeout_} fmt={(v) => `${v} ms`} />}
        <button className="btn sm" onClick={() => setSeed(seed + 1)}>New random run</button>
      </Controls>
      <svg className="dg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Heartbeat round-trip times over time with the timeout line">
        {[1, 10, 100, 1000].map((v) => (
          <g key={v}><line x1={x0} x2={W - 10} y1={Y(v)} y2={Y(v)} stroke="var(--line)" /><text x={x0 - 6} y={Y(v) + 4} textAnchor="end" className="sub">{v >= 1000 ? '1 s' : `${v} ms`}</text></g>
        ))}
        {res.rtts.map((rt, i) => (
          <circle key={i} cx={X(i)} cy={Y(rt)} r={rt > res.limits[i] ? 3.2 : 1.8} fill={rt > res.limits[i] ? 'var(--v-d)' : 'var(--v-a)'} />
        ))}
        <path d={limPath} stroke="var(--v-c)" strokeWidth={2} fill="none" />
        <line x1={X(res.crashAt)} x2={X(res.crashAt)} y1={y0} y2={y1} stroke="var(--v-d)" strokeDasharray="5 4" />
        <text x={X(res.crashAt) + 4} y={y0 + 12} fill="var(--v-d)" fontWeight={700}>node really crashes</text>
        <text x={x0} y={H - 8} className="sub">heartbeat # (one per second) →</text>
        <text x={W - 150} y={H - 8} className="sub">orange line = timeout</text>
      </svg>
      <div>
        <Stat label="False suspicions (alive node declared dead)" value={res.falseSuspicions} tone={res.falseSuspicions === 0 ? 'good' : 'bad'} />
        <Stat label="Time to detect the real crash" value={`${(res.detectionDelay / 1000).toFixed(2)} s`} tone={res.detectionDelay > 3000 ? 'warn' : 'good'} />
      </div>
      <p className="small muted">Delay model: queueing grows like load/(1−load), plus occasional pauses — a simplified illustration, not measurements. Raise the load: a timeout that was safe at 30% now fires constantly. That is the trade-off on p. 273: short timeouts suspect healthy nodes, long ones delay real failover.</p>
    </div>
  );
}
