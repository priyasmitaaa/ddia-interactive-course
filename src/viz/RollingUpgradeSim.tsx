import { useState } from 'react';
import { Controls, Log, Stat, useLog } from './ui';

/**
 * Figure 4-7 during a rolling upgrade: v2 of the app adds a photoURL field. While some servers still run
 * v1, a v1 server that decodes a record into its model object and re-encodes it can silently drop the field.
 */
type Rec = Record<string, unknown>;
const V1_FIELDS = ['userName', 'favoriteNumber', 'interests'];

export default function RollingUpgradeSim() {
  const [servers, setServers] = useState<(1 | 2)[]>([1, 1, 1]);
  const [db, setDb] = useState<Rec>({ userName: 'Martin', favoriteNumber: 1337, interests: ['hacking'] });
  const [preserve, setPreserve] = useState(false);
  const [lost, setLost] = useState(0);
  const log = useLog();

  const upgrade = () => {
    const i = servers.indexOf(1);
    if (i < 0) return;
    const s = [...servers]; s[i] = 2; setServers(s);
    log.add(`server ${i + 1} upgraded to v2 (knows photoURL). ${s.filter((x) => x === 1).length} still on v1.`, 'muted');
  };

  const setPhoto = (i: number) => {
    if (servers[i] !== 2) { log.add(`server ${i + 1} runs v1 and has no idea photoURL exists`, 'warn'); return; }
    const next = { ...db, photoURL: `http://example.com/photo-${Math.floor(Math.random() * 900 + 100)}.jpg` };
    setDb(next);
    log.add(`server ${i + 1} (v2): user sets a profile photo → writes photoURL`, 'good');
  };

  const update = (i: number) => {
    const v = servers[i];
    const fav = Math.floor(Math.random() * 100);
    if (v === 2) {
      setDb({ ...db, favoriteNumber: fav });
      log.add(`server ${i + 1} (v2): read, set favoriteNumber=${fav}, write back — all fields kept`);
      return;
    }
    // v1: decode into model object with only known fields
    const model: Rec = {};
    for (const f of V1_FIELDS) model[f] = db[f];
    const unknown = Object.keys(db).filter((k) => !V1_FIELDS.includes(k));
    model.favoriteNumber = fav;
    if (preserve) {
      const out = { ...model };
      for (const k of unknown) out[k] = db[k];
      setDb(out);
      log.add(`server ${i + 1} (v1): read, set favoriteNumber=${fav}, write back — unknown field(s) ${unknown.join(', ') || '(none)'} carried through untouched`, 'good');
    } else {
      setDb(model);
      if (unknown.length) {
        setLost((n) => n + 1);
        log.add(`server ${i + 1} (v1): decoded into its model object, set favoriteNumber=${fav}, re-encoded — ${unknown.join(', ')} SILENTLY LOST`, 'bad');
      } else log.add(`server ${i + 1} (v1): read, set favoriteNumber=${fav}, write back`);
    }
  };

  const reset = () => { setServers([1, 1, 1]); setDb({ userName: 'Martin', favoriteNumber: 1337, interests: ['hacking'] }); setLost(0); log.clear(); };

  return (
    <div>
      <Controls>
        <button className="btn sm primary" onClick={upgrade} disabled={!servers.includes(1)}>Upgrade next server to v2</button>
        <label><input type="checkbox" checked={preserve} onChange={(e) => setPreserve(e.target.checked)} /> v1 code preserves unknown fields</label>
        <button className="btn sm ghost" onClick={reset}>Reset</button>
      </Controls>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
        {servers.map((v, i) => (
          <div key={i} style={{ border: `1.5px solid ${v === 2 ? 'var(--v-b)' : 'var(--v-c)'}`, borderRadius: 10, padding: 10, background: 'var(--v-fill)' }}>
            <div style={{ fontWeight: 700 }}>App server {i + 1} <span className="chip" style={{ marginLeft: 4 }}>v{v}</span></div>
            <div className="small muted" style={{ margin: '4px 0 8px' }}>{v === 1 ? 'knows: userName, favoriteNumber, interests' : '…and photoURL'}</div>
            <div className="row" style={{ gap: 6 }}>
              <button className="btn sm" onClick={() => update(i)}>Update favoriteNumber</button>
              <button className="btn sm" onClick={() => setPhoto(i)}>Set photo</button>
            </div>
          </div>
        ))}
      </div>
      <div className="eyebrow" style={{ marginTop: 12 }}>The record in the shared database</div>
      <pre style={{ fontFamily: 'var(--mono)', fontSize: 13, background: 'var(--code-bg)', padding: 10, borderRadius: 10, margin: 0 }}>{JSON.stringify(db, null, 2)}</pre>
      <Stat label="Times photoURL was silently lost" value={lost} tone={lost ? 'bad' : 'good'} />
      <Log lines={log.lines} />
      <div className="hint">Try: upgrade one server, set a photo from it, then update favoriteNumber from a v1 server. Then tick “preserves unknown fields” and repeat.</div>
    </div>
  );
}
