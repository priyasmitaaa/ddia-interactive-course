import { useEffect, useState } from 'react';
import { Controls, Seg, Stat } from './ui';

/** Figure 2-1 vs Example 2-1: loading one profile from a normalized schema vs from one document. */
type Table = { name: string; cols: string[]; rows: (string | number)[][] };
const TABLES: Table[] = [
  { name: 'users', cols: ['user_id', 'first_name', 'last_name', 'region_id', 'industry_id'], rows: [[251, 'Bill', 'Gates', 'us:91', 131], [252, 'Ada', 'Lovelace', 'uk:3', 48]] },
  { name: 'positions', cols: ['id', 'user_id', 'job_title', 'organization'], rows: [[458, 251, 'Co-chair', 'Gates Foundation'], [457, 251, 'Co-founder, Chairman', 'Microsoft'], [460, 252, 'Analyst', 'Babbage & Co']] },
  { name: 'education', cols: ['id', 'user_id', 'school_name', 'start', 'end'], rows: [[807, 251, 'Harvard University', 1973, 1975], [806, 251, 'Lakeside School', 'NULL', 'NULL']] },
  { name: 'contact_info', cols: ['id', 'user_id', 'type', 'url'], rows: [[155, 251, 'blog', 'thegatesnotes.com'], [156, 251, 'twitter', 'twitter.com/BillGates']] },
  { name: 'regions', cols: ['id', 'region_name'], rows: [['us:91', 'Greater Seattle Area'], ['uk:3', 'London']] },
  { name: 'industries', cols: ['id', 'industry_name'], rows: [[131, 'Philanthropy'], [48, 'Construction']] },
];

const DOC = `{
  "user_id": 251,
  "first_name": "Bill", "last_name": "Gates",
  "region_id": "us:91", "industry_id": 131,
  "positions": [
    {"job_title": "Co-chair", "organization": "Gates Foundation"},
    {"job_title": "Co-founder, Chairman", "organization": "Microsoft"}
  ],
  "education": [
    {"school_name": "Harvard University", "start": 1973, "end": 1975},
    {"school_name": "Lakeside School", "start": null, "end": null}
  ],
  "contact_info": {"blog": "thegatesnotes.com", "twitter": "twitter.com/BillGates"}
}`;

// Each step touches some table rows: [table, predicate on row]
const REL_STEPS: { table: string; label: string; match: (r: (string | number)[]) => boolean }[] = [
  { table: 'users', label: 'SELECT * FROM users WHERE user_id = 251', match: (r) => r[0] === 251 },
  { table: 'positions', label: 'SELECT * FROM positions WHERE user_id = 251', match: (r) => r[1] === 251 },
  { table: 'education', label: 'SELECT * FROM education WHERE user_id = 251', match: (r) => r[1] === 251 },
  { table: 'contact_info', label: 'SELECT * FROM contact_info WHERE user_id = 251', match: (r) => r[1] === 251 },
  { table: 'regions', label: "SELECT region_name FROM regions WHERE id = 'us:91'", match: (r) => r[0] === 'us:91' },
  { table: 'industries', label: 'SELECT industry_name FROM industries WHERE id = 131', match: (r) => r[0] === 131 },
];

export default function ResumeModel() {
  const [mode, setMode] = useState<'relational' | 'document'>('relational');
  const [step, setStep] = useState(-1);
  const [running, setRunning] = useState(false);
  const total = mode === 'relational' ? REL_STEPS.length : 1;

  useEffect(() => {
    if (!running) return;
    if (step >= total - 1) { setRunning(false); return; }
    const t = setTimeout(() => setStep((s) => s + 1), 650);
    return () => clearTimeout(t);
  }, [running, step, total]);

  const start = () => { setStep(-1); setRunning(true); };
  const touched = (table: string, r: (string | number)[]) =>
    mode === 'relational' && REL_STEPS.some((s, i) => i <= step && s.table === table && s.match(r));

  return (
    <div>
      <Controls>
        <Seg value={mode} onChange={(m) => { setMode(m); setStep(-1); setRunning(false); }} options={[
          { value: 'relational', label: 'Relational (Figure 2-1)' },
          { value: 'document', label: 'Document (Example 2-1)' },
        ]} />
        <button className="btn sm primary" disabled={running} onClick={start}>Render Bill’s profile page</button>
      </Controls>
      {mode === 'relational' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 10 }}>
          {TABLES.map((t) => (
            <div key={t.name} style={{ border: '1px solid var(--line)', borderRadius: 10, padding: 8, background: 'var(--v-fill)' }}>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 700, marginBottom: 4 }}>{t.name}</div>
              <table style={{ borderCollapse: 'collapse', fontSize: 12, width: '100%', fontFamily: 'var(--mono)' }}>
                <thead><tr>{t.cols.map((c) => <th key={c} style={{ textAlign: 'left', color: 'var(--ink-3)', fontWeight: 600, padding: '2px 4px' }}>{c}</th>)}</tr></thead>
                <tbody>
                  {t.rows.map((r, i) => (
                    <tr key={i} style={{ background: touched(t.name, r) ? 'color-mix(in srgb, var(--v-a) 22%, transparent)' : undefined, transition: 'background .3s' }}>
                      {r.map((v, j) => <td key={j} style={{ padding: '2px 4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 140 }}>{String(v)}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      ) : (
        <pre style={{
          fontFamily: 'var(--mono)', fontSize: 13, background: step >= 0 ? 'color-mix(in srgb, var(--v-a) 14%, var(--code-bg))' : 'var(--code-bg)',
          padding: 12, borderRadius: 10, transition: 'background .3s', overflowX: 'auto', margin: 0,
        }}>{DOC}</pre>
      )}
      <div className="log" style={{ minHeight: 40 }}>
        {mode === 'relational'
          ? REL_STEPS.slice(0, step + 1).map((s, i) => <div key={i}>{s.label}</div>)
          : step >= 0 ? <div>db.users.findOne({'{'}user_id: 251{'}'}) → whole document in one read</div> : <div className="muted">press “Render”</div>}
      </div>
      <div style={{ marginTop: 6 }}>
        <Stat label="Queries / index lookups" value={step < 0 ? 0 : step + 1} tone={mode === 'relational' && step >= 3 ? 'warn' : 'good'} />
        {mode === 'relational' && step === REL_STEPS.length - 1 && <Stat label="Note" value="or one big 6-way join" />}
      </div>
      <div className="hint">
        The one-to-many parts (positions, education, contact info) form a <b>tree</b> under the user — a document stores the tree in one place (locality).
        But <code>region_id</code> and <code>industry_id</code> are many-to-one references: even the document needs extra lookups (or an in-memory copy) to show “Greater Seattle Area”.
      </div>
    </div>
  );
}
