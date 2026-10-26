import { useState } from 'react';
import { Controls, Stat } from './ui';

/**
 * Chapter 11, pp. 442-448: event sourcing. A shopping cart's state is derived by replaying an append-only log of
 * immutable events. Several read views are derived from the same log (CQRS). Commands are validated before they
 * become events. Log compaction "keep the last event per key" would destroy the meaning here.
 */

export type CartEvent =
  | { type: 'ItemAdded'; item: string; qty: number }
  | { type: 'ItemRemoved'; item: string }
  | { type: 'CheckedOut' };

export const STOCK: Record<string, number> = { book: 5, lamp: 1, mug: 3 };

export function cartState(events: CartEvent[]) {
  const items: Record<string, number> = {};
  let checkedOut = false;
  for (const e of events) {
    if (e.type === 'ItemAdded') items[e.item] = (items[e.item] ?? 0) + e.qty;
    else if (e.type === 'ItemRemoved') delete items[e.item];
    else checkedOut = true;
  }
  return { items, checkedOut };
}

/** A second view from the same events: items people considered but removed (lost when you only store current state). */
export function abandonedView(events: CartEvent[]) {
  const removed = new Set<string>();
  for (const e of events) if (e.type === 'ItemRemoved') removed.add(e.item);
  return [...removed];
}

/** Command validation: a command may fail; only accepted commands become events (p. 443). */
export function handleCommand(events: CartEvent[], cmd: CartEvent): { ok: boolean; reason?: string } {
  const s = cartState(events);
  if (s.checkedOut) return { ok: false, reason: 'cart already checked out' };
  if (cmd.type === 'ItemAdded' && (s.items[cmd.item] ?? 0) + cmd.qty > (STOCK[cmd.item] ?? 0)) return { ok: false, reason: `only ${STOCK[cmd.item]} ${cmd.item}(s) in stock` };
  if (cmd.type === 'ItemRemoved' && !s.items[cmd.item]) return { ok: false, reason: `no ${cmd.item} in cart` };
  if (cmd.type === 'CheckedOut' && !Object.keys(s.items).length) return { ok: false, reason: 'cart is empty' };
  return { ok: true };
}

/** What naive "keep last event per key (item)" compaction would do. */
export function naiveCompaction(events: CartEvent[]): CartEvent[] {
  const last = new Map<string, number>();
  events.forEach((e, i) => last.set('item' in e ? e.item : '_checkout', i));
  return events.filter((e, i) => last.get('item' in e ? e.item : '_checkout') === i);
}

const describe = (e: CartEvent) => (e.type === 'ItemAdded' ? `ItemAdded(${e.item}, ${e.qty})` : e.type === 'ItemRemoved' ? `ItemRemoved(${e.item})` : 'CheckedOut');

export default function EventSourcingViz() {
  const [events, setEvents] = useState<CartEvent[]>([{ type: 'ItemAdded', item: 'book', qty: 1 }, { type: 'ItemAdded', item: 'mug', qty: 2 }, { type: 'ItemRemoved', item: 'mug' }]);
  const [upTo, setUpTo] = useState<number | null>(null);
  const [rejected, setRejected] = useState<string | null>(null);
  const shown = upTo === null ? events : events.slice(0, upTo);
  const s = cartState(shown);
  const send = (cmd: CartEvent) => {
    const r = handleCommand(events, cmd);
    if (r.ok) { setEvents([...events, cmd]); setRejected(null); setUpTo(null); } else setRejected(`${describe(cmd)} rejected: ${r.reason} — it never becomes an event`);
  };
  const naive = cartState(naiveCompaction(events));
  return (
    <div>
      <Controls>
        {['book', 'lamp', 'mug'].map((it) => <button key={it} className="btn sm primary" onClick={() => send({ type: 'ItemAdded', item: it, qty: 1 })}>add {it}</button>)}
        {['book', 'lamp', 'mug'].map((it) => <button key={`r${it}`} className="btn sm" onClick={() => send({ type: 'ItemRemoved', item: it })}>remove {it}</button>)}
        <button className="btn sm" onClick={() => send({ type: 'CheckedOut' })}>check out</button>
        <button className="btn sm" onClick={() => { setEvents([]); setUpTo(null); setRejected(null); }}>new cart</button>
      </Controls>
      {rejected && <div className="small" style={{ color: 'var(--bad)', margin: '4px 0' }}>{rejected}</div>}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <div className="opt" style={{ margin: 0, flex: 1.2, minWidth: 220, cursor: 'default' }}>
          <b>Event log (append-only, immutable)</b>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 12.5 }}>
            {events.map((e, i) => (
              <div key={i} style={{ opacity: upTo !== null && i >= upTo ? 0.35 : 1, cursor: 'pointer' }} onClick={() => setUpTo(i + 1)} title="replay up to here">{i}: {describe(e)}</div>
            ))}
          </div>
          <div className="small muted">click an event to replay the log up to it ("time travel")</div>
        </div>
        <div className="opt correct" style={{ margin: 0, flex: 1, minWidth: 180, cursor: 'default' }}>
          <b>View 1: current cart{upTo !== null ? ` (after event ${upTo - 1})` : ''}</b>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 12.5 }}>{Object.entries(s.items).map(([k, v]) => <div key={k}>{k} × {v}</div>)}{!Object.keys(s.items).length && <span className="muted">(empty)</span>}{s.checkedOut && <div>✓ checked out</div>}</div>
        </div>
        <div className="opt" style={{ margin: 0, flex: 1, minWidth: 180, cursor: 'default' }}>
          <b>View 2: considered, then removed</b>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 12.5 }}>{abandonedView(shown).join(', ') || <span className="muted">(none)</span>}</div>
          <div className="small muted">lost if you only stored the current cart (p. 446)</div>
        </div>
      </div>
      <div style={{ marginTop: 6 }}>
        <Stat label="Events" value={events.length} />
        <Stat label="If you compacted 'last event per item'" value={JSON.stringify(naive.items) === JSON.stringify(cartState(events).items) ? 'same cart (this time)' : `wrong cart: ${JSON.stringify(naive.items)}`} tone={JSON.stringify(naive.items) === JSON.stringify(cartState(events).items) ? 'warn' : 'bad'} />
      </div>
      <p className="small muted">Events record intent at the application level ("added one more mug"), so later events don't simply overwrite earlier ones — you need the full history, and CDC-style compaction is not possible in the same way (p. 443). Try adding the same item twice: naive compaction keeps only the last "+1".</p>
    </div>
  );
}
