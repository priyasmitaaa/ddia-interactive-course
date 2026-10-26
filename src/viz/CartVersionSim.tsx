import { useState } from 'react';
import { Controls, Log, Seg, useLog } from './ui';

/**
 * The version-number algorithm of Figure 5-13 (pp. 181-184). The server keeps a version counter and the
 * set of values not yet overwritten ("siblings"). A write carries the version the client last read;
 * the server drops siblings with version <= that number and keeps the newer (concurrent) ones.
 */
interface Sib { version: number; items: string[] }
interface Client { known: number | null; sibs: Sib[] }

const BOOK_STEPS: { client: 0 | 1; add: string }[] = [
  { client: 0, add: 'milk' }, { client: 1, add: 'eggs' }, { client: 0, add: 'flour' }, { client: 1, add: 'ham' }, { client: 0, add: 'bacon' },
];

export default function CartVersionSim() {
  const [mode, setMode] = useState<'book' | 'free'>('book');
  const [counter, setCounter] = useState(0);
  const [server, setServer] = useState<Sib[]>([]);
  const [clients, setClients] = useState<Client[]>([{ known: null, sibs: [] }, { known: null, sibs: [] }]);
  const [step, setStep] = useState(0);
  const [item, setItem] = useState('cheese');
  const [withVersion, setWithVersion] = useState(true);
  const log = useLog();

  const doWrite = (c: 0 | 1, newItem: string | null, remove: string | null = null) => {
    const cl = clients[c];
    // client merges siblings it last saw (union), then applies its change
    const merged = [...new Set(cl.sibs.flatMap((s) => s.items))];
    let items = newItem ? [...merged, newItem] : merged;
    if (remove) items = items.filter((x) => x !== remove);
    const base = withVersion ? cl.known : null;
    const v = counter + 1;
    const keep = server.filter((s) => base === null || s.version > base);
    const dropped = server.filter((s) => !(base === null || s.version > base));
    const ns = [...keep, { version: v, items }];
    setCounter(v);
    setServer(ns);
    const nc = clients.map((x, i) => (i === c ? { known: v, sibs: ns } : x));
    setClients(nc);
    log.add(`client ${c + 1} sends [${items.join(', ')}] with ${base === null ? 'NO version' : `version ${base}`} → server stores v${v}` +
      `${dropped.length ? `, overwrites ${dropped.map((d) => `v${d.version}`).join(', ')}` : ''}` +
      `${keep.length ? `, keeps concurrent ${keep.map((d) => `v${d.version}`).join(', ')}` : ''}; returns ${ns.length} value(s)`, keep.length ? 'warn' : 'good');
  };

  const nextBookStep = () => {
    if (step >= BOOK_STEPS.length) return;
    const s = BOOK_STEPS[step];
    doWrite(s.client, s.add);
    setStep(step + 1);
  };

  const read = (c: 0 | 1) => {
    setClients(clients.map((x, i) => (i === c ? { known: counter, sibs: server } : x)));
    log.add(`client ${c + 1} reads: version ${counter}, ${server.length} sibling(s)`, 'muted');
  };

  const reset = () => { setCounter(0); setServer([]); setClients([{ known: null, sibs: [] }, { known: null, sibs: [] }]); setStep(0); log.clear(); };

  const union = [...new Set(server.flatMap((s) => s.items))];
  return (
    <div>
      <Controls>
        <Seg value={mode} onChange={(m) => { setMode(m); reset(); }} options={[{ value: 'book', label: 'Figure 5-13, step by step' }, { value: 'free', label: 'Free play' }]} />
        <button className="btn sm ghost" onClick={reset}>Reset</button>
      </Controls>
      {mode === 'book' ? (
        <Controls>
          <button className="btn sm primary" disabled={step >= BOOK_STEPS.length} onClick={nextBookStep}>
            {step < BOOK_STEPS.length ? `Step ${step + 1}: client ${BOOK_STEPS[step].client + 1} adds ${BOOK_STEPS[step].add}` : 'Done — 5 writes'}
          </button>
        </Controls>
      ) : (
        <Controls>
          <label>item <input type="text" value={item} onChange={(e) => setItem(e.target.value)} /></label>
          {[0, 1].map((c) => (
            <span key={c} className="row" style={{ gap: 4 }}>
              <b className="small">Client {c + 1}:</b>
              <button className="btn sm" onClick={() => read(c as 0 | 1)}>read</button>
              <button className="btn sm" onClick={() => doWrite(c as 0 | 1, item)}>add</button>
              <button className="btn sm" onClick={() => doWrite(c as 0 | 1, null, item)}>remove</button>
            </span>
          ))}
          <label><input type="checkbox" checked={withVersion} onChange={(e) => setWithVersion(e.target.checked)} /> send version number</label>
        </Controls>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr 1fr', gap: 10 }}>
        {[0, 1].map((c) => (
          <div key={c} style={{ order: c === 0 ? 0 : 2, border: '1px solid var(--line)', borderRadius: 10, padding: 8, background: 'var(--v-fill)' }}>
            <div style={{ fontWeight: 700 }}>Client {c + 1}</div>
            <div className="small muted">last version seen: {clients[c].known ?? '—'}</div>
            {clients[c].sibs.map((s) => <div key={s.version} className="small" style={{ fontFamily: 'var(--mono)' }}>v{s.version}: [{s.items.join(', ')}]</div>)}
          </div>
        ))}
        <div style={{ order: 1, border: '1.5px solid var(--v-a)', borderRadius: 10, padding: 8 }}>
          <div style={{ fontWeight: 700 }}>Database (counter = {counter})</div>
          {server.length === 0 && <div className="small muted">cart is empty</div>}
          {server.map((s) => <div key={s.version} className="chip a" style={{ display: 'block', marginBottom: 4 }}>v{s.version}: [{s.items.join(', ')}]</div>)}
          {server.length > 1 && <div className="small" style={{ marginTop: 4 }}>{server.length} siblings · merged by union: [{union.join(', ')}]</div>}
        </div>
      </div>
      <Log lines={log.lines} />
      <div className="hint">In free play: add an item from one client, remove it from the other without reading first, and look at the union of siblings — the removed item comes back (that's why deletions need tombstones). Untick “send version number” to see a write that overwrites nothing.</div>
    </div>
  );
}
