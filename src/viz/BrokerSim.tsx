import { useState } from 'react';
import { Controls, Seg, Slider, Stat } from './ui';

/**
 * Chapter 11, pp. 427-432.
 * Tab "overload": what happens when producers send faster than consumers process - drop, buffer, or backpressure.
 * Tab "consumers": AMQP/JMS-style broker with two consumers - load balancing vs fan-out (Figure 11-1), and
 * redelivery after a consumer crash, which reorders messages under load balancing (Figure 11-2).
 */

export type Policy = 'drop' | 'buffer' | 'backpressure';

/** Discrete simulation: producer offers `rate` msgs/tick for `ticks`, consumer handles `capacity`/tick. */
export function overload(policy: Policy, rate: number, capacity: number, bufferLimit: number, ticks = 30) {
  let queue = 0, dropped = 0, delivered = 0, producerBlocked = 0, maxQueue = 0, sent = 0;
  const series: number[] = [];
  for (let t = 0; t < ticks; t++) {
    let offer = rate;
    if (policy === 'backpressure') {
      const room = Math.max(0, bufferLimit - queue);
      if (offer > room) { producerBlocked += offer - room; offer = room; }
    }
    if (policy === 'drop') {
      const room = Math.max(0, bufferLimit - queue);
      if (offer > room) { dropped += offer - room; offer = room; }
    }
    queue += offer;
    sent += offer;
    const take = Math.min(queue, capacity);
    queue -= take;
    delivered += take;
    maxQueue = Math.max(maxQueue, queue);
    series.push(queue);
  }
  return { dropped, delivered, producerBlocked, maxQueue, finalQueue: queue, sent, series };
}

export interface Delivery { msg: string; consumer: number; tick: number; redelivered?: boolean }

/**
 * Five messages m1..m5 from two producers; two consumers. In load-balancing mode, messages alternate between consumers;
 * if `crash` is on, consumer 2 crashes while processing m3, and the unacknowledged m3 is redelivered to consumer 1
 * after m4 (Figure 11-2). In fan-out mode, both consumers get every message.
 */
export function deliveries(mode: 'lb' | 'fanout', crash: boolean): { deliveries: Delivery[]; processedBy: string[][] } {
  const msgs = ['m1', 'm2', 'm3', 'm4', 'm5'];
  const out: Delivery[] = [];
  if (mode === 'fanout') {
    msgs.forEach((m, i) => { out.push({ msg: m, consumer: 0, tick: i + 1 }); out.push({ msg: m, consumer: 1, tick: i + 1 }); });
  } else {
    // m1 -> c2, m2 -> c1, m3 -> c2, m4 -> c1, m5 -> c? (as in the figure: consumer 1 ends with m4 m3 m5)
    out.push({ msg: 'm1', consumer: 1, tick: 1 }, { msg: 'm2', consumer: 0, tick: 2 }, { msg: 'm3', consumer: 1, tick: 3 }, { msg: 'm4', consumer: 0, tick: 4 });
    if (crash) {
      out.push({ msg: 'm3', consumer: 0, tick: 5, redelivered: true }, { msg: 'm5', consumer: 0, tick: 6 });
    } else {
      out.push({ msg: 'm5', consumer: 1, tick: 5 });
    }
  }
  const processedBy: string[][] = [[], []];
  for (const d of out) {
    if (mode === 'lb' && crash && d.consumer === 1 && d.msg === 'm3') continue; // crashed before finishing m3
    processedBy[d.consumer].push(d.msg);
  }
  return { deliveries: out, processedBy };
}

export default function BrokerSim({ initialTab = 'overload' }: { initialTab?: 'overload' | 'consumers' }) {
  const [tab, setTab] = useState(initialTab);
  return (
    <div>
      <Controls>
        <Seg value={tab} onChange={setTab} options={[{ value: 'overload', label: 'Producer faster than consumer' }, { value: 'consumers', label: 'Multiple consumers' }]} />
      </Controls>
      {tab === 'overload' ? <Overload /> : <Consumers />}
    </div>
  );
}

function Overload() {
  const [policy, setPolicy] = useState<Policy>('buffer');
  const [rate, setRate] = useState(12);
  const [capacity, setCapacity] = useState(10);
  const [limit, setLimit] = useState(20);
  const r = overload(policy, rate, capacity, limit);
  const W = 640, H = 120, x0 = 30;
  const maxY = Math.max(limit, r.maxQueue, 10);
  const X = (i: number) => x0 + (i / 29) * (W - x0 - 10);
  const Y = (q: number) => H - 20 - (q / maxY) * (H - 30);
  return (
    <div>
      <Controls>
        <Seg value={policy} onChange={setPolicy} options={[{ value: 'drop', label: 'drop' }, { value: 'buffer', label: 'buffer (unbounded queue)' }, { value: 'backpressure', label: 'backpressure' }]} />
      </Controls>
      <Controls>
        <Slider label="Producer rate" value={rate} min={1} max={30} onChange={setRate} fmt={(v) => `${v}/tick`} />
        <Slider label="Consumer capacity" value={capacity} min={1} max={30} onChange={setCapacity} fmt={(v) => `${v}/tick`} />
        {policy !== 'buffer' && <Slider label="Buffer size" value={limit} min={1} max={60} onChange={setLimit} />}
      </Controls>
      <svg className="dg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Queue length over time">
        <line x1={x0} x2={W - 10} y1={H - 20} y2={H - 20} stroke="var(--ink-3)" />
        {policy !== 'buffer' && <line x1={x0} x2={W - 10} y1={Y(limit)} y2={Y(limit)} stroke="var(--v-c)" strokeDasharray="4 3" />}
        <path d={r.series.map((q, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)} ${Y(q).toFixed(1)}`).join(' ')} stroke="var(--v-a)" strokeWidth={2} fill="none" />
        <text x={x0} y={12} className="sub">queue length over 30 ticks{policy !== 'buffer' ? ' (dashed = buffer size)' : ''}</text>
      </svg>
      <div>
        <Stat label="Delivered" value={r.delivered} tone="good" />
        <Stat label="Dropped" value={r.dropped} tone={r.dropped ? 'bad' : undefined} />
        <Stat label="Producer blocked for" value={`${r.producerBlocked} msgs`} tone={r.producerBlocked ? 'warn' : undefined} />
        <Stat label="Queue at end" value={r.finalQueue} tone={policy === 'buffer' && r.finalQueue > 50 ? 'bad' : undefined} />
      </div>
      <p className="small muted">The first question to ask of any messaging system (p. 427). Unix pipes and TCP use backpressure with a small fixed buffer. Brokers usually buffer without bound — so ask what happens when the queue no longer fits in memory.</p>
    </div>
  );
}

function Consumers() {
  const [mode, setMode] = useState<'lb' | 'fanout'>('lb');
  const [crash, setCrash] = useState(false);
  const r = deliveries(mode, crash);
  const W = 640, H = 170, x0 = 100;
  const X = (t: number) => x0 + (t / 7) * (W - x0 - 20);
  const lanes = [70, 130];
  return (
    <div>
      <Controls>
        <Seg value={mode} onChange={(m) => { setMode(m); setCrash(false); }} options={[{ value: 'lb', label: 'Load balancing' }, { value: 'fanout', label: 'Fan-out' }]} />
        {mode === 'lb' && <label><input type="checkbox" checked={crash} onChange={(e) => setCrash(e.target.checked)} /> consumer 2 crashes while processing m3</label>}
      </Controls>
      <svg className="dg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Messages delivered from a broker to two consumers over time">
        <text x={8} y={24} fontWeight={700}>Broker</text>
        {['m1', 'm2', 'm3', 'm4', 'm5'].map((m, i) => <g key={m}><rect x={X(i + 1) - 15} y={10} width={30} height={20} rx={4} className="boxa" /><text x={X(i + 1)} y={25} textAnchor="middle" style={{ fontSize: 12 }}>{m}</text></g>)}
        {[0, 1].map((c) => <g key={c}><text x={8} y={lanes[c] + 4} fontWeight={700}>Consumer {c + 1}</text><line x1={x0} x2={W - 10} y1={lanes[c]} y2={lanes[c]} stroke="var(--line)" /></g>)}
        {r.deliveries.map((d, k) => {
          const failed = mode === 'lb' && crash && d.consumer === 1 && d.msg === 'm3';
          return (
            <g key={k}>
              <path d={`M${X(Number(d.msg[1]))} 30 L${X(d.tick)} ${lanes[d.consumer] - 10}`} stroke={d.redelivered ? 'var(--v-d)' : 'var(--ink-3)'} strokeDasharray={d.redelivered ? '4 3' : undefined} fill="none" />
              <rect x={X(d.tick) - 16} y={lanes[d.consumer] - 10} width={32} height={20} rx={4} className={failed ? 'boxd' : d.redelivered ? 'boxc' : 'boxb'} />
              <text x={X(d.tick)} y={lanes[d.consumer] + 4} textAnchor="middle" style={{ fontSize: 12 }}>{failed ? '✕' : d.msg}</text>
            </g>
          );
        })}
      </svg>
      <div>
        <Stat label="Consumer 1 processed" value={r.processedBy[0].join(' → ') || '—'} />
        <Stat label="Consumer 2 processed" value={r.processedBy[1].join(' → ') || '—'} />
        {mode === 'lb' && crash && <Stat label="Order" value="m4 before m3 — reordered by redelivery" tone="bad" />}
      </div>
      <p className="small muted">
        {mode === 'lb' ? 'Each message goes to one consumer, sharing the work (AMQP: several clients on one queue; JMS: shared subscription). Without an acknowledgement, the broker redelivers the message to another consumer — and with load balancing that inevitably reorders messages (p. 432).' : 'Every consumer gets every message, like several batch jobs reading the same file (JMS topic subscriptions, AMQP exchange bindings) (p. 431).'}
      </p>
    </div>
  );
}
