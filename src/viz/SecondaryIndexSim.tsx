import { useState } from 'react';
import { Controls, Log, Seg, Stat, useLog } from './ui';

/**
 * Figures 6-4 and 6-5: used cars partitioned by document ID; secondary indexes on color and make,
 * either document-partitioned (local) or term-partitioned (global). Query and insert to compare costs.
 */
interface Car { id: number; color: string; make: string }
const START: Car[] = [
  { id: 191, color: 'red', make: 'Honda' }, { id: 214, color: 'black', make: 'Dodge' }, { id: 306, color: 'red', make: 'Ford' },
  { id: 515, color: 'silver', make: 'Ford' }, { id: 768, color: 'red', make: 'Volvo' }, { id: 893, color: 'silver', make: 'Audi' },
];
const docPart = (id: number) => (id < 500 ? 0 : 1);
// term partitioning as in Figure 6-5: colors a–r → partition 0, s–z → 1; makes a–f → 0, h–z → 1
const termPart = (field: string, value: string) => (field === 'color' ? (value[0] <= 'r' ? 0 : 1) : (value[0].toLowerCase() <= 'f' ? 0 : 1));

export default function SecondaryIndexSim() {
  const [mode, setMode] = useState<'local' | 'global'>('local');
  const [cars, setCars] = useState<Car[]>(START);
  const [hl, setHl] = useState<{ parts: number[]; ids: number[] } | null>(null);
  const [asyncLag, setAsyncLag] = useState(false);
  const [pendingIndex, setPendingIndex] = useState<Car[]>([]);
  const [stats, setStats] = useState({ q: 0, w: 0 });
  const log = useLog();

  const indexed = (c: Car) => mode === 'local' || !pendingIndex.includes(c);

  const query = (field: 'color' | 'make', value: string) => {
    const match = cars.filter((c) => c[field] === value && indexed(c)).map((c) => c.id);
    const missing = cars.filter((c) => c[field] === value && !indexed(c)).map((c) => c.id);
    const parts = mode === 'local' ? [0, 1] : [termPart(field, value)];
    setHl({ parts, ids: match });
    setStats((s) => ({ ...s, q: parts.length }));
    log.add(`find ${field}:${value} → ${mode === 'local' ? 'scatter/gather to BOTH partitions' : `ask only index partition ${parts[0]}`} → [${match.join(', ')}]${missing.length ? `  (missing ${missing.join(', ')}: index not updated yet!)` : ''}`, missing.length ? 'bad' : 'good');
  };

  const insert = () => {
    const id = 900 + cars.length;
    const car: Car = { id, color: 'red', make: 'Audi' };
    setCars([...cars, car]);
    const parts = mode === 'local' ? [docPart(id)] : [...new Set([docPart(id), termPart('color', 'red'), termPart('make', 'Audi')])];
    setStats((s) => ({ ...s, w: parts.length }));
    setHl({ parts, ids: [id] });
    if (mode === 'global' && asyncLag) {
      setPendingIndex([...pendingIndex, car]);
      log.add(`insert car ${id} (red Audi): document stored in partition ${docPart(id)}; global index entries color:red, make:Audi updated ASYNCHRONOUSLY`, 'warn');
    } else {
      log.add(`insert car ${id} (red Audi): touches partition(s) ${parts.join(' and ')}${mode === 'global' ? ' — the document plus index entries on other partitions (needs a distributed transaction to be atomic)' : ' — document and its local index entries together'}`);
    }
  };

  const indexEntries = (p: number) => {
    const entries: Record<string, number[]> = {};
    const add = (k: string, id: number) => { (entries[k] ??= []).push(id); };
    for (const c of cars) {
      if (mode === 'local') {
        if (docPart(c.id) === p) { add(`color:${c.color}`, c.id); add(`make:${c.make}`, c.id); }
      } else if (indexed(c)) {
        if (termPart('color', c.color) === p) add(`color:${c.color}`, c.id);
        if (termPart('make', c.make) === p) add(`make:${c.make}`, c.id);
      }
    }
    return Object.entries(entries).sort();
  };

  return (
    <div>
      <Controls>
        <Seg value={mode} onChange={(m) => { setMode(m); setHl(null); setPendingIndex([]); log.clear(); }} options={[
          { value: 'local', label: 'Document-partitioned (local) index' },
          { value: 'global', label: 'Term-partitioned (global) index' },
        ]} />
        {mode === 'global' && <label><input type="checkbox" checked={asyncLag} onChange={(e) => setAsyncLag(e.target.checked)} /> asynchronous index updates</label>}
      </Controls>
      <Controls>
        <button className="btn sm primary" onClick={() => query('color', 'red')}>“I am looking for a red car”</button>
        <button className="btn sm" onClick={() => query('make', 'Ford')}>make:Ford</button>
        <button className="btn sm" onClick={insert}>Insert a red Audi</button>
        {pendingIndex.length > 0 && <button className="btn sm" onClick={() => { setPendingIndex([]); log.add('asynchronous index updates applied', 'muted'); }}>Apply pending index updates</button>}
      </Controls>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {[0, 1].map((p) => (
          <div key={p} style={{ border: `2px solid ${hl?.parts.includes(p) ? 'var(--v-a)' : 'var(--line)'}`, borderRadius: 10, padding: 8, background: 'var(--v-fill)' }}>
            <div style={{ fontWeight: 700 }}>Partition {p} <span className="small muted">(doc IDs {p === 0 ? '0–499' : '500–999'})</span></div>
            <div className="small" style={{ fontFamily: 'var(--mono)', marginTop: 4 }}>
              {cars.filter((c) => docPart(c.id) === p).map((c) => (
                <div key={c.id} style={{ color: hl?.ids.includes(c.id) ? 'var(--v-a)' : undefined, fontWeight: hl?.ids.includes(c.id) ? 700 : 400 }}>{c.id} {'{'}color: {c.color}, make: {c.make}{'}'}</div>
              ))}
            </div>
            <div className="eyebrow" style={{ marginTop: 6 }}>{mode === 'local' ? 'Local index (this partition’s docs only)' : `Global index slice: ${p === 0 ? 'colors a–r, makes a–f' : 'colors s–z, makes h–z'}`}</div>
            <div className="small" style={{ fontFamily: 'var(--mono)' }}>
              {indexEntries(p).map(([k, ids]) => <div key={k}>{k} → [{ids.join(', ')}]</div>)}
            </div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 6 }}>
        <Stat label="Partitions contacted by last query" value={stats.q} tone={stats.q > 1 ? 'warn' : 'good'} />
        <Stat label="Partitions touched by last insert" value={stats.w} tone={stats.w > 1 ? 'warn' : 'good'} />
      </div>
      <Log lines={log.lines} />
    </div>
  );
}
