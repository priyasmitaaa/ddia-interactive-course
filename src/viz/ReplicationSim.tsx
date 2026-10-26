import { useRef, useState } from 'react';
import { Controls, Log, Seg, Slider, Stat, useInterval, useLog } from './ui';

/**
 * Single-leader replication (Figures 5-1 and 5-2). A leader and two followers; each follower is
 * synchronous or asynchronous and has a network delay. The client's write is acknowledged once the
 * leader (and every synchronous follower) has it. Followers can be taken offline.
 */
type Mode = 'sync' | 'async';
interface Msg { kind: 'change' | 'ack'; to: number; from: number; idx: number; sentAt: number; arriveAt: number }
interface Pending { idx: number; startedAt: number; waitingFor: number[] }

const TICK = 50;

export default function ReplicationSim() {
  const [now, setNow] = useState(0);
  const [log, setLeaderLog] = useState<string[]>([]);
  const [applied, setApplied] = useState<[number, number]>([0, 0]); // entries applied per follower
  const [modes, setModes] = useState<[Mode, Mode]>(['sync', 'async']);
  const [delays, setDelays] = useState<[number, number]>([300, 1500]);
  const [up, setUp] = useState<[boolean, boolean]>([true, true]);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [pending, setPending] = useState<Pending[]>([]);
  const [lastLatency, setLastLatency] = useState<number | null>(null);
  const counter = useRef(1);
  const ev = useLog();

  useInterval(() => {
    const t = now + TICK;
    const arrived = msgs.filter((m) => m.arriveAt <= t).sort((a, b) => a.idx - b.idx);
    let rest = msgs.filter((m) => m.arriveAt > t);
    const newApplied: [number, number] = [...applied];
    const acks: Msg[] = [];
    for (const m of arrived) {
      if (m.kind === 'change') {
        const f = m.to;
        if (!up[f]) continue; // lost while offline; follower catches up later
        if (m.idx === newApplied[f]) {
          newApplied[f] = m.idx + 1;
          acks.push({ kind: 'ack', to: -1, from: f, idx: m.idx, sentAt: t, arriveAt: t + delays[f] });
        }
      }
    }
    // acks arriving at leader
    let newPending = pending;
    for (const m of arrived.filter((a) => a.kind === 'ack')) {
      newPending = newPending.map((p) => (p.idx === m.idx ? { ...p, waitingFor: p.waitingFor.filter((w) => w !== m.from) } : p));
    }
    const done = newPending.filter((p) => p.waitingFor.length === 0);
    for (const p of done) {
      setLastLatency(t - p.startedAt);
      ev.add(`t=${t}ms  write #${p.idx + 1} acknowledged to the client after ${t - p.startedAt} ms`, 'good');
    }
    newPending = newPending.filter((p) => p.waitingFor.length > 0);
    // the leader streams every entry the follower doesn't have yet (and isn't already in flight)
    for (const f of [0, 1]) {
      if (!up[f]) continue;
      for (let i = newApplied[f]; i < log.length; i++) {
        if (!rest.some((m) => m.kind === 'change' && m.to === f && m.idx === i)) {
          rest = [...rest, { kind: 'change', to: f, from: -1, idx: i, sentAt: t, arriveAt: t + delays[f] }];
        }
      }
    }
    setMsgs([...rest, ...acks]);
    setApplied(newApplied);
    setPending(newPending);
    setNow(t);
  }, TICK);

  const write = () => {
    const idx = log.length;
    const value = `picture_url=me-${counter.current++}.jpg`;
    setLeaderLog([...log, value]);
    const waitingFor = [0, 1].filter((f) => modes[f] === 'sync');
    if (waitingFor.length === 0) {
      setLastLatency(0);
      ev.add(`t=${now}ms  write #${idx + 1}: leader applied it and acknowledged immediately (all followers async)`, 'good');
    } else {
      setPending([...pending, { idx, startedAt: now, waitingFor }]);
      ev.add(`t=${now}ms  write #${idx + 1}: leader applied it; waiting for synchronous follower ${waitingFor.map((f) => f + 1).join(', ')}…`);
    }
  };

  const toggleUp = (f: number) => {
    const u: [boolean, boolean] = [...up];
    u[f] = !u[f];
    setUp(u);
    ev.add(`follower ${f + 1} ${u[f] ? 'is back online — catching up from its last position' : 'went OFFLINE'}`, u[f] ? 'muted' : 'bad');
  };

  const lane = (label: string, entries: number, total: number, color: string, extra?: string) => (
    <div key={label} className="row" style={{ flexWrap: 'nowrap', alignItems: 'center', margin: '6px 0' }}>
      <span style={{ width: 120, fontWeight: 650, fontSize: 14 }}>{label}</span>
      <div style={{ flex: 1, display: 'flex', gap: 3, flexWrap: 'wrap', minHeight: 26 }}>
        {Array.from({ length: total }, (_, i) => (
          <span key={i} className="chip" style={{ opacity: i < entries ? 1 : 0.25, borderColor: i < entries ? color : undefined, fontSize: 12 }}>#{i + 1}</span>
        ))}
      </div>
      <span className="small muted" style={{ width: 150, textAlign: 'right' }}>{extra}</span>
    </div>
  );

  return (
    <div>
      <Controls>
        <button className="btn sm primary" onClick={write}>Client writes (update picture)</button>
        <button className="btn sm ghost" onClick={() => { setLeaderLog([]); setApplied([0, 0]); setMsgs([]); setPending([]); setLastLatency(null); ev.clear(); counter.current = 1; }}>Reset</button>
      </Controls>
      {[0, 1].map((f) => (
        <Controls key={f}>
          <b style={{ width: 90 }}>Follower {f + 1}</b>
          <Seg value={modes[f]} onChange={(m) => { const x: [Mode, Mode] = [...modes]; x[f] = m; setModes(x); }} options={[{ value: 'sync', label: 'synchronous' }, { value: 'async', label: 'asynchronous' }]} />
          <Slider label="network delay" value={delays[f]} min={50} max={5000} step={50} onChange={(v) => { const x: [number, number] = [...delays]; x[f] = v; setDelays(x); }} fmt={(v) => `${v} ms`} />
          <button className={`btn sm ${up[f] ? '' : 'primary'}`} onClick={() => toggleUp(f)}>{up[f] ? 'Take offline' : 'Bring online'}</button>
        </Controls>
      ))}
      <div style={{ background: 'var(--v-fill)', border: '1px solid var(--line)', borderRadius: 10, padding: '6px 10px' }}>
        {lane('Leader', log.length, log.length, 'var(--v-a)', `${pending.length} write(s) waiting`)}
        {[0, 1].map((f) => lane(`Follower ${f + 1}${up[f] ? '' : ' (offline)'}`, applied[f], log.length, modes[f] === 'sync' ? 'var(--v-b)' : 'var(--v-c)',
          `lag: ${log.length - applied[f]} entr${log.length - applied[f] === 1 ? 'y' : 'ies'}`))}
      </div>
      <div style={{ marginTop: 6 }}>
        <Stat label="Last write latency" value={lastLatency === null ? '—' : `${lastLatency} ms`} tone={lastLatency !== null && lastLatency > 1000 ? 'bad' : undefined} />
        <Stat label="Writes blocked" value={pending.length} tone={pending.length ? 'warn' : undefined} />
        <Stat label="Copies of the newest write" value={log.length ? 1 + applied.filter((a) => a >= log.length).length : 0} />
      </div>
      <Log lines={ev.lines} />
      <div className="hint">Try: make follower 1 synchronous and take it offline, then write — the write can't be acknowledged. Make it asynchronous: writes are fast, but the follower falls behind. Bring it back and watch it catch up from its last position.</div>
    </div>
  );
}
