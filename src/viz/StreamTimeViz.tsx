import { useState } from 'react';
import { Controls, Seg, Slider, Stat } from './ui';

/**
 * Chapter 11, pp. 452-456.
 * Tab "time": Figure 11-7 - a web server emits a steady 10 requests/second; the stream processor is down for a while
 * and then processes its backlog. Counting per second by PROCESSING time shows a dip and an anomalous spike; counting
 * by EVENT time shows the true, steady rate. Stragglers arriving after a window was emitted are dropped or corrected.
 * Tab "windows": tumbling, hopping, sliding and session windows over the same events.
 */

export interface Ev { eventTime: number; procTime: number }

/** Steady `rate` events per second for `seconds`; processor down during [downFrom, downTo); catch-up at `catchUp`×. */
export function figure117(rate: number, seconds: number, downFrom: number, downTo: number, catchUp: number, stragglerDelay = 0): Ev[] {
  const evs: Ev[] = [];
  let backlogDone = downTo;
  for (let s = 0; s < seconds; s++) {
    for (let k = 0; k < rate; k++) {
      const eventTime = s + k / rate;
      let procTime = eventTime + 0.05;
      if (procTime >= downFrom && procTime < downTo) {
        // queued; drained at catchUp * rate per second after restart
        procTime = backlogDone;
        backlogDone += 1 / (rate * catchUp);
      } else if (procTime >= downTo && procTime < backlogDone) {
        procTime = backlogDone;
        backlogDone += 1 / (rate * catchUp);
      }
      evs.push({ eventTime, procTime });
    }
  }
  if (stragglerDelay > 0) evs.push({ eventTime: 3.5, procTime: 3.5 + stragglerDelay }); // one late mobile event
  return evs;
}

export function countPerSecond(evs: Ev[], by: 'event' | 'processing', seconds: number) {
  const c = new Array(seconds).fill(0);
  for (const e of evs) {
    const t = Math.floor(by === 'event' ? e.eventTime : e.procTime);
    if (t >= 0 && t < seconds) c[t]++;
  }
  return c;
}

/** Event-time windows emitted at watermark = max event time seen − allowedLateness. Late events: dropped or corrected. */
export function watermarkWindows(evs: Ev[], lateness: number, policy: 'drop' | 'correct') {
  const sorted = [...evs].sort((a, b) => a.procTime - b.procTime);
  const counts = new Map<number, number>();
  const emitted = new Map<number, number>();
  const corrections: { window: number; value: number }[] = [];
  let dropped = 0, maxSeen = -Infinity;
  for (const e of sorted) {
    const w = Math.floor(e.eventTime);
    if (emitted.has(w)) {
      if (policy === 'drop') { dropped++; continue; }
      counts.set(w, (counts.get(w) ?? 0) + 1);
      corrections.push({ window: w, value: counts.get(w)! });
      emitted.set(w, counts.get(w)!);
      continue;
    }
    counts.set(w, (counts.get(w) ?? 0) + 1);
    maxSeen = Math.max(maxSeen, e.eventTime);
    const watermark = maxSeen - lateness;
    for (const [win, c] of counts) if (!emitted.has(win) && win + 1 <= watermark) emitted.set(win, c);
  }
  return { emitted, dropped, corrections };
}

// ---------------- window types ----------------
export const WIN_EVENTS = [1, 2, 3.5, 4.2, 11, 12.5, 14, 23, 24, 25.5, 41, 42.5];

export function tumbling(ts: number[], size: number) {
  const m = new Map<number, number[]>();
  for (const t of ts) { const k = Math.floor(t / size) * size; m.set(k, [...(m.get(k) ?? []), t]); }
  return [...m.entries()].map(([start, evs]) => ({ start, end: start + size, evs }));
}
export function hopping(ts: number[], size: number, hop: number) {
  const out: { start: number; end: number; evs: number[] }[] = [];
  const max = Math.max(...ts);
  for (let start = Math.floor((Math.min(...ts) - size) / hop) * hop + hop; start <= max; start += hop) {
    const evs = ts.filter((t) => t >= start && t < start + size);
    if (evs.length) out.push({ start, end: start + size, evs });
  }
  return out;
}
/** Sliding: for each event, the window of events within `size` before it. */
export function sliding(ts: number[], size: number) {
  return ts.map((t) => ({ start: t - size, end: t, evs: ts.filter((u) => u > t - size && u <= t) }));
}
export function sessions(ts: number[], gap: number) {
  const out: { start: number; end: number; evs: number[] }[] = [];
  for (const t of [...ts].sort((a, b) => a - b)) {
    const last = out[out.length - 1];
    if (last && t - last.evs[last.evs.length - 1] <= gap) { last.evs.push(t); last.end = t; } else out.push({ start: t, end: t, evs: [t] });
  }
  return out;
}

export default function StreamTimeViz({ initialTab = 'time' }: { initialTab?: 'time' | 'windows' }) {
  const [tab, setTab] = useState(initialTab);
  return (
    <div>
      <Controls>
        <Seg value={tab} onChange={setTab} options={[{ value: 'time', label: 'Event time vs processing time' }, { value: 'windows', label: 'Window types' }]} />
      </Controls>
      {tab === 'time' ? <TimeTab /> : <WindowsTab />}
    </div>
  );
}

function TimeTab() {
  const [down, setDown] = useState(5);
  const [catchUp, setCatchUp] = useState(3);
  const [straggler, setStraggler] = useState(true);
  const [lateness, setLateness] = useState(0.5);
  const [policy, setPolicy] = useState<'drop' | 'correct'>('drop');
  const seconds = 20;
  const evs = figure117(10, seconds, 6, 6 + down, catchUp, straggler ? 9 : 0);
  const byProc = countPerSecond(evs, 'processing', seconds);
  const byEvent = countPerSecond(evs, 'event', seconds);
  const wm = watermarkWindows(evs, lateness, policy);
  const W = 640, H = 150, x0 = 30;
  const maxY = Math.max(...byProc, ...byEvent, 12);
  const X = (s: number) => x0 + (s / seconds) * (W - x0 - 10);
  const bar = (counts: number[], y0: number, cls: string) => counts.map((c, s) => <rect key={s} x={X(s) + 1} y={y0 - (c / maxY) * 55} width={(W - x0 - 10) / seconds - 2} height={(c / maxY) * 55} className={cls} />);
  return (
    <div>
      <Controls>
        <Slider label="Processor down for" value={down} min={0} max={8} onChange={setDown} fmt={(v) => `${v} s`} />
        <Slider label="Catch-up speed" value={catchUp} min={1.5} max={6} step={0.5} onChange={setCatchUp} fmt={(v) => `${v}×`} />
        <label><input type="checkbox" checked={straggler} onChange={(e) => setStraggler(e.target.checked)} /> one event (t=3.5 s) arrives 9 s late</label>
      </Controls>
      <svg className="dg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Requests per second counted by processing time and by event time">
        <text x={x0} y={12} className="sub">counted by PROCESSING time</text>
        {bar(byProc, 68, 'boxd')}
        <text x={x0} y={84} className="sub">counted by EVENT time (the true rate)</text>
        {bar(byEvent, 140, 'boxb')}
        <rect x={X(6)} y={14} width={X(6 + down) - X(6)} height={56} fill="var(--warn-soft)" opacity={0.6} />
      </svg>
      <Controls>
        <Slider label="Watermark lateness allowance" value={lateness} min={0} max={10} step={0.5} onChange={setLateness} fmt={(v) => `${v} s`} />
        <Seg value={policy} onChange={setPolicy} options={[{ value: 'drop', label: 'ignore stragglers' }, { value: 'correct', label: 'publish corrections' }]} />
      </Controls>
      <div>
        <Stat label="Peak per second by processing time" value={Math.max(...byProc)} tone="bad" />
        <Stat label="True rate" value="10/s steady" tone="good" />
        <Stat label="Straggler events dropped" value={wm.dropped} tone={wm.dropped ? 'warn' : 'good'} />
        <Stat label="Corrections published" value={wm.corrections.length} />
      </div>
      <p className="small muted">Redeploying the processor creates a fake dip and spike when you window by processing time (Figure 11-7). Event-time windows fix that but raise a new question: when is a window complete? A watermark ("no more events older than t") lets you emit, but a delayed mobile event can still arrive afterwards — ignore it (and count drops), or publish a corrected value (p. 455).</p>
    </div>
  );
}

function WindowsTab() {
  const [kind, setKind] = useState<'tumbling' | 'hopping' | 'sliding' | 'session'>('tumbling');
  const ts = WIN_EVENTS;
  const wins = kind === 'tumbling' ? tumbling(ts, 10) : kind === 'hopping' ? hopping(ts, 10, 5) : kind === 'sliding' ? sliding(ts, 10) : sessions(ts, 5);
  const W = 640, x0 = 20, T = 50;
  const X = (t: number) => x0 + (t / T) * (W - x0 - 10);
  const rowH = 16;
  const H = 50 + wins.length * rowH;
  return (
    <div>
      <Controls>
        <Seg value={kind} onChange={setKind} options={[{ value: 'tumbling', label: 'Tumbling (10)' }, { value: 'hopping', label: 'Hopping (10, hop 5)' }, { value: 'sliding', label: 'Sliding (10)' }, { value: 'session', label: 'Session (gap 5)' }]} />
      </Controls>
      <svg className="dg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Events on a timeline and the windows they fall into">
        <line x1={x0} x2={W - 10} y1={30} y2={30} stroke="var(--ink-3)" />
        {[0, 10, 20, 30, 40, 50].map((t) => <text key={t} x={X(t)} y={14} textAnchor="middle" className="sub">{t}</text>)}
        {ts.map((t) => <circle key={t} cx={X(t)} cy={30} r={4} fill="var(--v-a)" />)}
        {wins.map((w, i) => (
          <g key={i}>
            <rect x={X(Math.max(0, w.start))} y={42 + i * rowH} width={Math.max(4, X(Math.min(T, w.end)) - X(Math.max(0, w.start)))} height={rowH - 4} rx={3} className="boxe" />
            <text x={X(Math.min(T, w.end)) + 6} y={42 + i * rowH + 10} className="sub">{w.evs.length} event{w.evs.length === 1 ? '' : 's'}</text>
          </g>
        ))}
      </svg>
      <p className="small muted">
        {kind === 'tumbling' && 'Fixed length, no overlap: every event in exactly one window (round the timestamp down).'}
        {kind === 'hopping' && 'Fixed length, overlapping for smoothing: computable from 5-unit tumbling windows aggregated over adjacent pairs.'}
        {kind === 'sliding' && 'All events within 10 units of each other: here, one window ending at each event. Keep a time-sorted buffer and expire old events.'}
        {kind === 'session' && 'No fixed length: a user’s events close together form a session, ended by 5 units of inactivity — sessionization for web analytics.'}
        {' '}(p. 456)
      </p>
    </div>
  );
}
