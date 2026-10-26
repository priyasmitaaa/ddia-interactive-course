import { useRef, useState } from 'react';
import { Controls, Log, Stat, useLog } from './ui';

/**
 * Bitcask-style storage: append-only segment files + one in-memory hash map per segment
 * (key -> byte offset). Supports tombstones, segment rolling, compaction+merge, crash recovery.
 */
interface Rec { key: string; value: string | null; offset: number }
interface Segment { id: number; recs: Rec[]; size: number; closed: boolean }
const SEG_LIMIT = 5;
const TOMB = '␡';

const recLen = (k: string, v: string | null) => `${k},${v ?? TOMB}\n`.length;

function buildMap(seg: Segment) {
  const m: Record<string, number> = {};
  for (const r of seg.recs) m[r.key] = r.offset;
  return m;
}

export default function HashIndexSim() {
  const [segs, setSegs] = useState<Segment[]>([{ id: 1, recs: [], size: 0, closed: false }]);
  const [maps, setMaps] = useState<Record<number, Record<string, number>>>({ 1: {} });
  const [lost, setLost] = useState(false);
  const [key, setKey] = useState('mew');
  const [val, setVal] = useState('1078');
  const [hl, setHl] = useState<{ seg: number; offset: number } | null>(null);
  const idRef = useRef(2);
  const [scanned, setScanned] = useState(0);
  const log = useLog();

  const append = (k: string, v: string | null, segsIn = segs, mapsIn = maps) => {
    let s = segsIn.map((x) => ({ ...x, recs: [...x.recs] }));
    let m = { ...mapsIn };
    let active = s[s.length - 1];
    if (active.recs.length >= SEG_LIMIT) {
      active.closed = true;
      const id = idRef.current++;
      log.add(`segment ${active.id} is full → closed (immutable). New active segment ${id}.`, 'muted');
      active = { id, recs: [], size: 0, closed: false };
      s.push(active);
      m[id] = {};
    }
    const offset = active.size;
    active.recs.push({ key: k, value: v, offset });
    active.size += recLen(k, v);
    m[active.id] = { ...m[active.id], [k]: offset };
    setSegs(s);
    setMaps(m);
    setHl({ seg: active.id, offset });
    return { s, m };
  };

  const set = () => {
    if (!key) return;
    if (lost) { log.add('Hash maps are gone — restart (rebuild) first.', 'bad'); return; }
    const { s } = append(key, val);
    log.add(`SET ${key}=${val}: append to segment ${s[s.length - 1].id}, update its hash map`);
  };

  const del = () => {
    if (lost) { log.add('Hash maps are gone — restart first.', 'bad'); return; }
    append(key, null);
    log.add(`DELETE ${key}: append a tombstone (${TOMB}); the old values stay until compaction`, 'warn');
  };

  const get = () => {
    if (lost) { log.add('Hash maps are gone — restart first.', 'bad'); return; }
    for (let i = segs.length - 1; i >= 0; i--) {
      const seg = segs[i];
      const off = maps[seg.id]?.[key];
      log.add(`check hash map of segment ${seg.id}: ${off === undefined ? 'not here' : `offset ${off}`}`, 'muted');
      if (off !== undefined) {
        const rec = seg.recs.find((r) => r.offset === off)!;
        setHl({ seg: seg.id, offset: off });
        if (rec.value === null) log.add(`GET ${key} → tombstone: key was deleted`, 'warn');
        else log.add(`GET ${key} → seek to byte ${off} of segment ${seg.id} → "${rec.value}" (one disk seek)`, 'good');
        return;
      }
    }
    log.add(`GET ${key} → not found in any segment`, 'warn');
  };

  const compact = () => {
    const closed = segs.filter((s) => s.closed);
    if (closed.length === 0) { log.add('No closed segments to compact yet — write more keys.', 'muted'); return; }
    const latest = new Map<string, string | null>();
    for (const s of closed) for (const r of s.recs) latest.set(r.key, r.value);
    const before = closed.reduce((a, s) => a + s.recs.length, 0);
    const merged: Segment = { id: idRef.current++, recs: [], size: 0, closed: true };
    for (const [k, v] of latest) {
      if (v === null) continue; // tombstone: drop key entirely
      merged.recs.push({ key: k, value: v, offset: merged.size });
      merged.size += recLen(k, v);
    }
    const active = segs.filter((s) => !s.closed);
    const ns = [merged, ...active];
    const nm: Record<number, Record<string, number>> = { [merged.id]: buildMap(merged) };
    for (const a of active) nm[a.id] = maps[a.id];
    setSegs(ns);
    setMaps(nm);
    setHl(null);
    log.add(`compaction + merge of ${closed.length} segment(s): ${before} records → ${merged.recs.length} (latest value per key, tombstoned keys dropped). Old files deleted.`, 'good');
  };

  const crash = () => {
    setMaps({});
    setLost(true);
    setHl(null);
    log.add('💥 crash! In-memory hash maps lost. Segment files on disk survive.', 'bad');
  };

  const restart = () => {
    let n = 0;
    const m: Record<number, Record<string, number>> = {};
    for (const s of segs) { m[s.id] = buildMap(s); n += s.recs.length; }
    setMaps(m);
    setLost(false);
    setScanned(scanned + n);
    log.add(`restart: rebuilt hash maps by reading every segment from start to end (${n} records scanned). Bitcask speeds this up with hash-map snapshots ("hint files").`, 'warn');
  };

  const plays = () => {
    // Figure 3-2 style workload: few keys, many updates
    let s = segs, m = maps;
    const keys = ['mew', 'purr', 'yawn'];
    const vals: Record<string, number> = {};
    for (const r of s.flatMap((x) => x.recs)) if (r.value) vals[r.key] = Number(r.value) || 0;
    for (let i = 0; i < 6; i++) {
      const k = keys[i % 3 === 2 ? 2 : i % 2];
      vals[k] = (vals[k] ?? (k === 'mew' ? 1078 : k === 'purr' ? 2103 : 511)) + 1;
      ({ s, m } = append(k, String(vals[k]), s, m));
    }
    log.add('6 play-count updates for 3 cat videos: lots of writes per key — Bitcask\'s sweet spot.', 'muted');
  };

  const totalRecs = segs.reduce((a, s) => a + s.recs.length, 0);
  const liveKeys = new Set<string>();
  for (const s of segs) for (const r of s.recs) { if (r.value === null) liveKeys.delete(r.key); else liveKeys.add(r.key); }

  return (
    <div>
      <Controls>
        <label>key <input type="text" value={key} onChange={(e) => setKey(e.target.value.trim())} /></label>
        <label>value <input type="text" value={val} onChange={(e) => setVal(e.target.value)} /></label>
        <button className="btn sm primary" onClick={set}>SET</button>
        <button className="btn sm" onClick={get}>GET</button>
        <button className="btn sm" onClick={del}>DELETE</button>
      </Controls>
      <Controls>
        <button className="btn sm" onClick={plays}>+6 play-count updates</button>
        <button className="btn sm" onClick={compact}>Compact &amp; merge closed segments</button>
        <button className="btn sm" onClick={crash}>Crash</button>
        <button className="btn sm" disabled={!lost} onClick={restart}>Restart (rebuild maps)</button>
      </Controls>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 230px', gap: 14 }}>
        <div>
          <div className="eyebrow">Segment files on disk (append-only)</div>
          {segs.map((s) => (
            <div key={s.id} style={{ border: '1px solid var(--line)', borderRadius: 10, padding: '6px 8px', marginBottom: 6, background: 'var(--v-fill)' }}>
              <div className="small" style={{ fontWeight: 650 }}>segment {s.id} {s.closed ? <span className="muted">· closed, immutable</span> : <span style={{ color: 'var(--v-b)' }}>· active (appending)</span>}</div>
              <div>
                {s.recs.length === 0 && <span className="small muted">(empty)</span>}
                {s.recs.map((r) => {
                  const on = hl && hl.seg === s.id && hl.offset === r.offset;
                  return (
                    <span key={r.offset} className={`chip ${r.value === null ? 'd' : on ? 'a' : ''}`} title={`byte offset ${r.offset}`}>
                      <span style={{ color: 'var(--ink-3)', fontSize: 11 }}>@{r.offset} </span>{r.key}:{r.value ?? TOMB}
                    </span>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        <div>
          <div className="eyebrow">In-memory hash maps</div>
          {lost ? <div className="small err">lost in crash</div> : [...segs].reverse().map((s) => (
            <div key={s.id} style={{ fontFamily: 'var(--mono)', fontSize: 12.5, marginBottom: 6 }}>
              <div style={{ fontWeight: 700 }}>seg {s.id}</div>
              {Object.entries(maps[s.id] ?? {}).map(([k, o]) => <div key={k}>{k} → {o}</div>)}
            </div>
          ))}
        </div>
      </div>
      <div>
        <Stat label="Records on disk" value={totalRecs} />
        <Stat label="Live keys" value={liveKeys.size} />
        <Stat label="Wasted (obsolete) records" value={totalRecs - liveKeys.size} tone={totalRecs - liveKeys.size > 4 ? 'warn' : undefined} />
        <Stat label="Records scanned in recoveries" value={scanned} />
      </div>
      <Log lines={log.lines} />
    </div>
  );
}
