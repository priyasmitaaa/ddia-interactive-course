import { useMemo, useState } from 'react';
import { Controls, Seg, Slider, Stat } from './ui';

/**
 * Chapter 8, pp. 287-295: leases, process pauses and fencing tokens (Figures 8-4 and 8-5).
 *
 * Client 1 holds a 30-second lease (token 33) and runs the request loop from p. 287 every 4 seconds:
 * renew if less than 10 s remain (by ITS clock), then process the request if the lease is valid. At t = 18 it
 * is paused (GC) right after `lease.isValid()` returned true. Client 2 polls the lock service every 2 s and gets
 * the lease (token 34) as soon as it expires. Storage either accepts every write or checks fencing tokens.
 * Whole seconds; when two things happen in the same second, client 1's late write is applied last (worst case).
 */

export interface LeaseParams {
  lease: number;        // lease duration, s
  pause: number;        // length of client 1's stop-the-world pause, s (starts at t = 18)
  clockOffset: number;  // client 1's clock minus real time, s (negative = behind)
  fencing: boolean;     // storage rejects tokens lower than the highest it has seen
}

export interface LeaseEvent {
  t: number;
  actor: 'lock' | 'c1' | 'c2' | 'storage';
  text: string;
  tone?: 'good' | 'bad' | 'warn' | 'muted';
}

export interface StorageWrite { t: number; client: 1 | 2; token: number; accepted: boolean; insideLease: boolean }

export interface LeaseResult {
  events: LeaseEvent[];
  writes: StorageWrite[];
  holders: { client: 1 | 2; from: number; to: number }[]; // lease intervals as the lock service sees them
  pause: [number, number] | null;
  corrupted: boolean;   // storage accepted a client-1 write after a client-2 write
  unsafeAccepted: number; // writes accepted although the writer's lease had expired
}

export const PAUSE_AT = 18;
export const END = 60;

export function simulateLease(p: LeaseParams): LeaseResult {
  const events: LeaseEvent[] = [];
  const writes: StorageWrite[] = [];
  const holders: LeaseResult['holders'] = [];
  let holder: 1 | 2 | null = 1;
  let expiry = p.lease;      // lock service's own (correct) clock
  let c1From = 0;
  let c1Expiry = p.lease;   // what client 1 believes
  let c2Token = 0;
  let c2From = -1;
  let c1Active = true;
  let c1Busy: number | null = null; // time when the paused thread resumes and writes
  let maxToken = 0;
  let c2Wrote = false;
  let corrupted = false;
  let unsafeAccepted = 0;
  let nextC2Write = -1;

  events.push({ t: 0, actor: 'c1', text: 'client 1 acquires the lease (expires t=' + p.lease + ', fencing token 33)', tone: 'good' });

  const store = (t: number, client: 1 | 2, token: number) => {
    const insideLease = holder === client && t < expiry;
    const accepted = !p.fencing || token >= maxToken;
    if (accepted) {
      maxToken = Math.max(maxToken, token);
      if (client === 2) c2Wrote = true;
      if (client === 1 && c2Wrote) corrupted = true;
      if (!insideLease) unsafeAccepted++;
    }
    writes.push({ t, client, token, accepted, insideLease });
    events.push({
      t, actor: 'storage',
      text: `write from client ${client} with token ${token}: ${accepted ? 'ACCEPTED' : 'REJECTED (already saw token ' + maxToken + ')'}${!insideLease ? ' — its lease is no longer valid!' : ''}${accepted && client === 1 && c2Wrote ? ' → the two clients\' writes are interleaved: file corrupted' : ''}`,
      tone: !accepted ? 'good' : !insideLease ? (corrupted ? 'bad' : 'warn') : undefined,
    });
  };

  for (let t = 1; t <= END; t++) {
    // lock service: lease expiry
    if (holder !== null && t >= expiry) {
      events.push({ t, actor: 'lock', text: `lease of client ${holder} expired at t=${expiry}`, tone: 'muted' });
      holders.push({ client: holder, from: holder === 1 ? c1From : c2From, to: expiry });
      holder = null;
    }
    // client 2: poll every 2 s (odd seconds)
    if (c2Token === 0 && t % 2 === 1 && holder === null) {
      holder = 2; c2Token = 34; c2From = t; expiry = t + p.lease; nextC2Write = t + 1;
      events.push({ t, actor: 'c2', text: `client 2 acquires the lease (fencing token 34)`, tone: 'good' });
    }
    if (c2Token && t === nextC2Write && holder === 2 && t < expiry) {
      store(t, 2, 34);
      nextC2Write = t + 4;
    }
    // client 1's paused thread resumes and performs the write it had already decided to do
    if (c1Busy !== null && t === c1Busy) {
      events.push({ t, actor: 'c1', text: `client 1 resumes after a ${p.pause}s pause — unaware any time passed — and processes the request`, tone: 'warn' });
      store(t, 1, 33);
      c1Busy = null;
      continue; // next loop iteration on a later tick
    }
    // client 1: request loop every 4 s at t = 2, 6, 10, ...
    if (c1Active && c1Busy === null && t % 4 === 2) {
      const local = t + p.clockOffset;
      // The expiry was set by the lock service's clock but is compared with client 1's own clock (p. 287).
      const believedRemaining = c1Expiry - local;
      if (believedRemaining < 10) {
        if (holder === 1 && t < expiry) {
          expiry = t + p.lease; c1Expiry = expiry;
          events.push({ t, actor: 'c1', text: `client 1 renews the lease (its clock says ${believedRemaining}s left) → now expires t=${expiry}`, tone: 'muted' });
        } else {
          events.push({ t, actor: 'c1', text: `client 1 tries to renew — refused: the lease ${holder === 2 ? 'now belongs to client 2' : 'has expired'}. Client 1 stops.`, tone: 'good' });
          c1Active = false;
          continue;
        }
      }
      if (c1Expiry > local) { // lease.isValid() — by client 1's clock
        if (t === PAUSE_AT && p.pause > 0) {
          c1Busy = t + p.pause;
          events.push({ t, actor: 'c1', text: `client 1: lease.isValid() → true (${c1Expiry - local}s left by its clock)… then a stop-the-world GC pause begins`, tone: 'warn' });
          continue;
        }
        store(t, 1, 33);
      }
    }
  }
  if (holder !== null) holders.push({ client: holder, from: holder === 1 ? c1From : c2From, to: Math.min(expiry, END) });
  const pause: [number, number] | null = p.pause > 0 ? [PAUSE_AT, PAUSE_AT + p.pause] : null;
  return { events, writes, holders, pause, corrupted, unsafeAccepted };
}

export default function LeaseFencingSim({ fencing: f0 = false }: { fencing?: boolean }) {
  const [pause, setPause] = useState(15);
  const [clockOffset, setClockOffset] = useState(0);
  const [fencing, setFencing] = useState(f0);
  const [showAll, setShowAll] = useState(false);
  const lease = 30;
  const r = useMemo(() => simulateLease({ lease, pause, clockOffset, fencing }), [pause, clockOffset, fencing]);
  const W = 680, H = 266, x0 = 92;
  const X = (t: number) => x0 + (t / END) * (W - x0 - 30);
  const lanes = { lock: 40, c1: 100, c2: 160, storage: 220 } as const;
  const shown = showAll ? r.events : r.events.filter((e) => e.tone !== 'muted' || e.actor === 'lock');
  return (
    <div>
      <Controls>
        <Slider label="Client 1 GC pause" value={pause} min={0} max={40} onChange={setPause} fmt={(v) => `${v} s`} />
        <Slider label="Client 1 clock offset" value={clockOffset} min={-20} max={10} onChange={setClockOffset} fmt={(v) => `${v > 0 ? '+' : ''}${v} s`} />
      </Controls>
      <Controls>
        <Seg value={fencing ? 'on' : 'off'} onChange={(v) => setFencing(v === 'on')} options={[{ value: 'off', label: 'Storage trusts clients (Fig 8-4)' }, { value: 'on', label: 'Storage checks fencing tokens (Fig 8-5)' }]} />
        <button className="btn sm" onClick={() => { setPause(15); setClockOffset(0); }}>Book scenario</button>
      </Controls>
      <svg className="dg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Timeline of lock service, two clients and storage">
        {(['lock', 'c1', 'c2', 'storage'] as const).map((k) => (
          <g key={k}>
            <text x={8} y={lanes[k] + 4} fontWeight={700}>{k === 'lock' ? 'Lock service' : k === 'c1' ? 'Client 1' : k === 'c2' ? 'Client 2' : 'Storage'}</text>
            <line x1={x0} x2={W - 10} y1={lanes[k]} y2={lanes[k]} stroke="var(--ink-3)" />
          </g>
        ))}
        {r.holders.map((h, i) => (
          <g key={i}>
            <rect x={X(h.from)} y={lanes.lock - 9} width={Math.max(2, X(h.to) - X(h.from))} height={18} rx={4} className={h.client === 1 ? 'boxa' : 'boxe'} />
            <text x={X(h.from) + 4} y={lanes.lock + 4} className="sub">lease: client {h.client} (token {h.client === 1 ? 33 : 34})</text>
          </g>
        ))}
        {r.pause && (
          <g>
            <rect x={X(r.pause[0])} y={lanes.c1 - 10} width={X(Math.min(END, r.pause[1])) - X(r.pause[0])} height={20} fill="var(--warn-soft)" stroke="var(--v-c)" />
            <text x={X(r.pause[0]) + 4} y={lanes.c1 + 4} className="sub">stop-the-world GC pause</text>
          </g>
        )}
        {r.writes.map((w, i) => {
          const y = w.client === 1 ? lanes.c1 : lanes.c2;
          const crowded = i > 0 && w.t - r.writes[i - 1].t < 3 && i % 2 === 1; // stagger labels that would overlap
          const color = !w.accepted ? 'var(--v-b)' : w.insideLease ? (w.client === 1 ? 'var(--v-a)' : 'var(--v-e)') : 'var(--v-d)';
          return (
            <g key={i}>
              <path d={`M${X(w.t)} ${y} L${X(w.t) + 4} ${lanes.storage}`} stroke={color} strokeWidth={w.insideLease ? 1.4 : 2.4} fill="none" />
              <text x={X(w.t) + 4} y={lanes.storage + (crowded ? 30 : 16)} textAnchor="middle" fill={color} fontWeight={700} style={{ fontSize: 11 }}>{w.accepted ? (w.insideLease ? '✓' : '⚠') : '✕'}{w.token}</text>
            </g>
          );
        })}
        {[0, 10, 20, 30, 40, 50, 60].map((t) => <text key={t} x={X(t)} y={H - 4} textAnchor="middle" className="sub">{t}s</text>)}
      </svg>
      <div>
        <Stat label="Writes accepted outside a valid lease" value={r.unsafeAccepted} tone={r.unsafeAccepted ? 'warn' : 'good'} />
        <Stat label="File" value={r.corrupted ? 'CORRUPTED (both clients wrote)' : 'consistent'} tone={r.corrupted ? 'bad' : 'good'} />
        <label className="small"><input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} /> show every event</label>
      </div>
      <div className="log">
        {shown.map((e, i) => (
          <div key={i} style={{ color: e.tone === 'good' ? 'var(--good)' : e.tone === 'bad' ? 'var(--bad)' : e.tone === 'warn' ? 'var(--warn)' : e.tone === 'muted' ? 'var(--ink-3)' : undefined }}>
            t={String(e.t).padStart(2, ' ')}s · {e.text}
          </div>
        ))}
      </div>
    </div>
  );
}
