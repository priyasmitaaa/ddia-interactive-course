import { useState } from 'react';
import { Controls, Log, Seg, Stat, useLog } from './ui';

/** Duplicated text vs IDs: what happens when a human-meaningful name changes. */
const PEOPLE = ['Asha', 'Ben', 'Chen', 'Dara', 'Eli', 'Fatima', 'Gus', 'Hana'];
const START = ['Bombay', 'Bombay', 'Delhi', 'Bombay', 'Delhi', 'Bombay', 'Bombay', 'Delhi'];

export default function NormalizationSim() {
  const [mode, setMode] = useState<'denorm' | 'norm'>('denorm');
  const [docs, setDocs] = useState<string[]>(START);
  const [regions, setRegions] = useState<Record<string, string>>({ r1: 'Bombay', r2: 'Delhi' });
  const [crash, setCrash] = useState(false);
  const [writes, setWrites] = useState(0);
  const [busy, setBusy] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const log = useLog();
  const ids = START.map((s) => (s === 'Bombay' ? 'r1' : 'r2'));

  const reset = () => { setDocs(START); setRegions({ r1: 'Bombay', r2: 'Delhi' }); setWrites(0); setHighlight(-1); log.clear(); };

  const rename = async () => {
    setBusy(true);
    if (mode === 'norm') {
      log.add("UPDATE regions SET name='Mumbai' WHERE id='r1'   -- 1 row");
      setRegions((r) => ({ ...r, r1: 'Mumbai' }));
      setWrites((w) => w + 1);
      log.add('Every profile shows Mumbai, because profiles store only r1.', 'good');
    } else {
      const targets = docs.map((d, i) => (d === 'Bombay' ? i : -1)).filter((i) => i >= 0);
      log.add(`Must rewrite ${targets.length} profiles that contain the text "Bombay"...`);
      for (let k = 0; k < targets.length; k++) {
        const i = targets[k];
        if (crash && k === Math.floor(targets.length / 2)) {
          log.add('💥 application crashed halfway through the update!', 'bad');
          log.add('Some profiles say Mumbai, others still say Bombay. Which is right?', 'bad');
          break;
        }
        setHighlight(i);
        await new Promise((r) => setTimeout(r, 420));
        setDocs((d) => d.map((v, j) => (j === i ? 'Mumbai' : v)));
        setWrites((w) => w + 1);
        log.add(`rewrite profile of ${PEOPLE[i]}`);
      }
      setHighlight(-1);
    }
    setBusy(false);
  };

  const shown = (i: number) => (mode === 'norm' ? regions[ids[i]] : docs[i]);
  const inconsistent = mode === 'denorm' && docs.includes('Mumbai') && docs.filter((d, i) => START[i] === 'Bombay').includes('Bombay');

  return (
    <div>
      <Controls>
        <Seg value={mode} onChange={(m) => { setMode(m); reset(); }} options={[
          { value: 'denorm', label: 'Store the text (duplicated)' },
          { value: 'norm', label: 'Store an ID (normalized)' },
        ]} />
        {mode === 'denorm' && <label><input type="checkbox" checked={crash} onChange={(e) => setCrash(e.target.checked)} /> crash halfway</label>}
        <button className="btn sm primary" disabled={busy} onClick={rename}>Rename “Bombay” → “Mumbai”</button>
        <button className="btn sm ghost" disabled={busy} onClick={reset}>Reset</button>
      </Controls>
      <div style={{ display: 'grid', gridTemplateColumns: mode === 'norm' ? '2fr 1fr' : '1fr', gap: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 8 }}>
          {PEOPLE.map((p, i) => (
            <div key={p} style={{
              border: `1.5px solid ${highlight === i ? 'var(--v-a)' : 'var(--line)'}`, borderRadius: 10, padding: '8px 10px',
              background: 'var(--v-fill)', fontSize: 14, transition: 'border-color .2s',
            }}>
              <div style={{ fontWeight: 650 }}>{p}</div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 12.5, color: 'var(--ink-3)' }}>
                city: {mode === 'norm' ? <>{ids[i]} → </> : null}
                <span style={{ color: shown(i) === 'Mumbai' ? 'var(--v-b)' : shown(i) === 'Bombay' ? 'var(--v-c)' : undefined, fontWeight: 600 }}>
                  {mode === 'norm' ? `“${shown(i)}”` : `“${shown(i)}”`}
                </span>
              </div>
            </div>
          ))}
        </div>
        {mode === 'norm' && (
          <div style={{ border: '1.5px solid var(--v-a)', borderRadius: 10, padding: '8px 10px', fontFamily: 'var(--mono)', fontSize: 13 }}>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>regions</div>
            {Object.entries(regions).map(([k, v]) => <div key={k}>{k} = “{v}”</div>)}
          </div>
        )}
      </div>
      <Log lines={log.lines} />
      <div style={{ marginTop: 6 }}>
        <Stat label="Rows written by the rename" value={writes} />
        <Stat label="Lookups to show one profile" value={mode === 'norm' ? '2 (profile + region join)' : '1'} />
        {inconsistent && <Stat label="State" value="INCONSISTENT" tone="bad" />}
      </div>
    </div>
  );
}
