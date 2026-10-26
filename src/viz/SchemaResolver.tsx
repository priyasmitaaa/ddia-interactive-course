import { useState } from 'react';
import { Controls, Seg } from './ui';

/**
 * Avro schema resolution (Figure 4-6, rules on pp. 120-121). Two schema versions share a pool of
 * possible fields. Fields are matched BY NAME. A field the reader expects but the writer didn't write
 * must have a default in the reader's schema; a field the writer wrote but the reader doesn't know is ignored.
 */
interface Field { name: string; type: string; sample: string; def: string }
const FIELDS: Field[] = [
  { name: 'userID', type: 'long', sample: '42', def: '0' },
  { name: 'userName', type: 'string', sample: '"Martin"', def: '""' },
  { name: 'favoriteNumber', type: 'union {null, long}', sample: '1337', def: 'null' },
  { name: 'interests', type: 'array<string>', sample: '["hacking"]', def: '[]' },
  { name: 'photoURL', type: 'string', sample: '"http://…/m.jpg"', def: '""' },
];
type V = { inOld: boolean; inNew: boolean; defOld: boolean; defNew: boolean };

const PRESETS: Record<string, { label: string; v: Record<string, V> }> = {
  fig46: {
    label: 'Figure 4-6',
    v: {
      userID: { inOld: false, inNew: true, defOld: false, defNew: true },
      userName: { inOld: true, inNew: true, defOld: false, defNew: false },
      favoriteNumber: { inOld: true, inNew: true, defOld: true, defNew: true },
      interests: { inOld: true, inNew: true, defOld: false, defNew: false },
      photoURL: { inOld: true, inNew: false, defOld: true, defNew: false },
    },
  },
  addDefault: {
    label: 'Add a field with a default',
    v: {
      userID: { inOld: false, inNew: false, defOld: false, defNew: false },
      userName: { inOld: true, inNew: true, defOld: false, defNew: false },
      favoriteNumber: { inOld: true, inNew: true, defOld: true, defNew: true },
      interests: { inOld: true, inNew: true, defOld: false, defNew: false },
      photoURL: { inOld: false, inNew: true, defOld: false, defNew: true },
    },
  },
  addNoDefault: {
    label: 'Add a field WITHOUT default',
    v: {
      userID: { inOld: false, inNew: false, defOld: false, defNew: false },
      userName: { inOld: true, inNew: true, defOld: false, defNew: false },
      favoriteNumber: { inOld: true, inNew: true, defOld: true, defNew: true },
      interests: { inOld: true, inNew: true, defOld: false, defNew: false },
      photoURL: { inOld: false, inNew: true, defOld: false, defNew: false },
    },
  },
  removeNoDefault: {
    label: 'Remove a field without default',
    v: {
      userID: { inOld: false, inNew: false, defOld: false, defNew: false },
      userName: { inOld: true, inNew: true, defOld: false, defNew: false },
      favoriteNumber: { inOld: true, inNew: true, defOld: true, defNew: true },
      interests: { inOld: true, inNew: false, defOld: false, defNew: false },
      photoURL: { inOld: false, inNew: false, defOld: false, defNew: false },
    },
  },
};

function resolve(writer: 'old' | 'new', v: Record<string, V>) {
  const reader = writer === 'old' ? 'new' : 'old';
  const inW = (f: string) => (writer === 'old' ? v[f].inOld : v[f].inNew);
  const inR = (f: string) => (reader === 'old' ? v[f].inOld : v[f].inNew);
  const defR = (f: string) => (reader === 'old' ? v[f].defOld : v[f].defNew);
  const rows = FIELDS.filter((f) => inW(f.name) || inR(f.name)).map((f) => {
    if (inW(f.name) && inR(f.name)) return { f, status: 'match', value: f.sample };
    if (inW(f.name)) return { f, status: 'ignored', value: '' };
    if (defR(f.name)) return { f, status: 'default', value: f.def };
    return { f, status: 'error', value: '' };
  });
  return { rows, ok: rows.every((r) => r.status !== 'error') };
}

export default function SchemaResolver() {
  const [v, setV] = useState<Record<string, V>>(PRESETS.fig46.v);
  const [preset, setPreset] = useState('fig46');
  const [dir, setDir] = useState<'backward' | 'forward'>('backward');
  const set = (f: string, k: keyof V) => { setPreset(''); setV((s) => ({ ...s, [f]: { ...s[f], [k]: !s[f][k] } })); };
  const back = resolve('old', v); // new code reads old data
  const fwd = resolve('new', v); // old code reads new data
  const shown = dir === 'backward' ? back : fwd;

  const badge = (ok: boolean) => <b style={{ color: ok ? 'var(--good)' : 'var(--bad)' }}>{ok ? '✓ compatible' : '✗ broken'}</b>;
  return (
    <div>
      <Controls>
        <span className="small muted">Scenario:</span>
        {Object.entries(PRESETS).map(([k, p]) => (
          <button key={k} className={`btn sm ${preset === k ? 'primary' : ''}`} onClick={() => { setPreset(k); setV(p.v); }}>{p.label}</button>
        ))}
      </Controls>
      <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 14 }}>
        <thead>
          <tr style={{ textAlign: 'left' }}>
            <th style={{ padding: 4 }}>field (matched by name)</th><th>type</th>
            <th style={{ textAlign: 'center' }}>in OLD schema</th><th style={{ textAlign: 'center' }}>default (old)</th>
            <th style={{ textAlign: 'center' }}>in NEW schema</th><th style={{ textAlign: 'center' }}>default (new)</th>
          </tr>
        </thead>
        <tbody>
          {FIELDS.map((f) => (
            <tr key={f.name} style={{ borderTop: '1px solid var(--line)' }}>
              <td style={{ padding: 4, fontFamily: 'var(--mono)' }}>{f.name}</td>
              <td style={{ fontFamily: 'var(--mono)', fontSize: 12.5, color: 'var(--ink-3)' }}>{f.type}</td>
              <td style={{ textAlign: 'center' }}><input type="checkbox" checked={v[f.name].inOld} onChange={() => set(f.name, 'inOld')} /></td>
              <td style={{ textAlign: 'center' }}><input type="checkbox" disabled={!v[f.name].inOld} checked={v[f.name].defOld} onChange={() => set(f.name, 'defOld')} /></td>
              <td style={{ textAlign: 'center' }}><input type="checkbox" checked={v[f.name].inNew} onChange={() => set(f.name, 'inNew')} /></td>
              <td style={{ textAlign: 'center' }}><input type="checkbox" disabled={!v[f.name].inNew} checked={v[f.name].defNew} onChange={() => set(f.name, 'defNew')} /></td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="row" style={{ margin: '12px 0 6px' }}>
        <span>Backward (new code reads old data): {badge(back.ok)}</span>
        <span>Forward (old code reads new data): {badge(fwd.ok)}</span>
      </div>
      <Controls>
        <Seg value={dir} onChange={setDir} options={[
          { value: 'backward', label: 'Show: new reader ← old writer' },
          { value: 'forward', label: 'Show: old reader ← new writer' },
        ]} />
      </Controls>
      <div style={{ fontFamily: 'var(--mono)', fontSize: 13, background: 'var(--code-bg)', padding: 10, borderRadius: 10 }}>
        {shown.rows.map(({ f, status, value }) => (
          <div key={f.name} style={{ color: status === 'error' ? 'var(--bad)' : status === 'ignored' ? 'var(--ink-3)' : status === 'default' ? 'var(--warn)' : undefined }}>
            {status === 'match' && <>{f.name}: {value}   <span className="muted">← read from the data</span></>}
            {status === 'default' && <>{f.name}: {value}   ← writer didn't write it; filled in with the reader's default</>}
            {status === 'ignored' && <>({f.name} was written but the reader doesn't know it → ignored)</>}
            {status === 'error' && <>{f.name}: ??? ← reader expects it, writer didn't write it, and there's NO default → decoding fails</>}
          </div>
        ))}
      </div>
      <div className="hint">Rule of thumb from p. 120: to stay compatible in both directions, only add or remove fields that have a default value.</div>
    </div>
  );
}
