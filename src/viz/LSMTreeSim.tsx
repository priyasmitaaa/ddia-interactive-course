import { useRef, useState } from 'react';
import { Controls, Log, Stat, rng, useLog } from './ui';

/**
 * LSM-tree: writes go to a WAL + sorted memtable; full memtable flushes to an immutable
 * sorted SSTable with a sparse index and a Bloom filter; reads check memtable then
 * SSTables newest→oldest; compaction merge-sorts SSTables keeping the newest value.
 */
type Val = string | null; // null = tombstone
interface SST { id: number; entries: [string, Val][]; bloom: boolean[] }
const MEM_LIMIT = 4;
const BLOOM_BITS = 24;
const SPARSE_EVERY = 2;

function hashes(key: string): number[] {
  let h1 = 2166136261, h2 = 5381;
  for (const c of key) { h1 = Math.imul(h1 ^ c.charCodeAt(0), 16777619) >>> 0; h2 = ((h2 << 5) + h2 + c.charCodeAt(0)) >>> 0; }
  return [h1 % BLOOM_BITS, h2 % BLOOM_BITS];
}
function makeBloom(keys: string[]) {
  const b = new Array(BLOOM_BITS).fill(false);
  for (const k of keys) for (const h of hashes(k)) b[h] = true;
  return b;
}
const WORDS = ['handbag', 'handcuffs', 'handful', 'handicap', 'handiwork', 'handkerchief', 'handlebars', 'handoff', 'handprinted', 'handsome', 'handwaving', 'handwriting', 'hammock', 'hangout'];

export default function LSMTreeSim() {
  const [mem, setMem] = useState<Map<string, Val>>(new Map());
  const [wal, setWal] = useState<string[]>([]);
  const [ssts, setSsts] = useState<SST[]>([]);
  const [key, setKey] = useState('handiwork');
  const [val, setVal] = useState('45521');
  const [useBloom, setUseBloom] = useState(true);
  const [diskReads, setDiskReads] = useState(0);
  const [hl, setHl] = useState<{ sst: number; key?: string; skipped?: number[] } | null>(null);
  const idRef = useRef(1);
  const r = useRef(rng(11));
  const log = useLog();

  const flush = (m: Map<string, Val>, list: SST[]) => {
    const entries = [...m.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1));
    const sst: SST = { id: idRef.current++, entries, bloom: makeBloom(entries.map((e) => e[0])) };
    log.add(`memtable full → written sequentially as SSTable #${sst.id} (already sorted). WAL discarded.`, 'good');
    return [...list, sst];
  };

  const write = (k: string, v: Val, state = { mem, wal, ssts }) => {
    const nm = new Map(state.mem);
    nm.set(k, v);
    let nw = [...state.wal, `${k}=${v ?? '␡'}`];
    let ns = state.ssts;
    if (nm.size >= MEM_LIMIT) {
      ns = flush(nm, ns);
      nm.clear();
      nw = [];
    }
    return { mem: nm, wal: nw, ssts: ns };
  };
  const commit = (s: { mem: Map<string, Val>; wal: string[]; ssts: SST[] }) => { setMem(s.mem); setWal(s.wal); setSsts(s.ssts); };

  const put = () => { if (!key) return; log.add(`PUT ${key}: append to WAL, insert into memtable (sorted in memory)`); commit(write(key, val)); setHl(null); };
  const del = () => { if (!key) return; log.add(`DELETE ${key}: write a tombstone`, 'warn'); commit(write(key, null)); setHl(null); };
  const randomWrites = () => {
    let s = { mem, wal, ssts };
    for (let i = 0; i < 5; i++) {
      const k = WORDS[Math.floor(r.current() * WORDS.length)];
      s = write(k, String(Math.floor(r.current() * 90000) + 1000), s);
    }
    log.add('5 random writes (any key order) — all become sequential disk writes.', 'muted');
    commit(s);
    setHl(null);
  };

  const get = () => {
    if (mem.has(key)) {
      const v = mem.get(key)!;
      log.add(`GET ${key}: found in memtable → ${v ?? 'deleted (tombstone)'} (no disk read)`, 'good');
      setHl(null);
      return;
    }
    log.add(`GET ${key}: not in memtable; check SSTables newest → oldest`, 'muted');
    let reads = 0;
    const skipped: number[] = [];
    for (let i = ssts.length - 1; i >= 0; i--) {
      const t = ssts[i];
      if (useBloom && !hashes(key).every((h) => t.bloom[h])) {
        log.add(`  SSTable #${t.id}: Bloom filter says "definitely not here" → skip (no disk read)`, 'muted');
        skipped.push(t.id);
        continue;
      }
      reads++;
      // sparse index: find greatest indexed key <= target
      const idxKeys = t.entries.filter((_, j) => j % SPARSE_EVERY === 0).map((e) => e[0]);
      const start = [...idxKeys].reverse().find((k) => k <= key);
      const found = t.entries.find((e) => e[0] === key);
      log.add(`  SSTable #${t.id}: sparse index → start scanning at "${start ?? idxKeys[0]}" (1 disk read) → ${found ? `found ${found[1] ?? 'tombstone'}` : 'not here'}`);
      if (found) {
        setDiskReads((d) => d + reads);
        setHl({ sst: t.id, key, skipped });
        log.add(`GET ${key} → ${found[1] === null ? 'deleted' : found[1]} after ${reads} disk read(s)`, found[1] === null ? 'warn' : 'good');
        return;
      }
    }
    setDiskReads((d) => d + reads);
    setHl({ sst: -1, skipped });
    log.add(`GET ${key} → does not exist. Cost: ${reads} disk read(s)${useBloom ? '' : ' — a Bloom filter would have avoided most of these'}`, 'warn');
  };

  const compact = () => {
    if (ssts.length < 2) { log.add('Need at least 2 SSTables to merge.', 'muted'); return; }
    const merged = new Map<string, Val>();
    for (const t of ssts) for (const [k, v] of t.entries) merged.set(k, v); // later (newer) wins
    const entries = [...merged.entries()].filter(([, v]) => v !== null).sort((a, b) => (a[0] < b[0] ? -1 : 1));
    const before = ssts.reduce((a, t) => a + t.entries.length, 0);
    const sst: SST = { id: idRef.current++, entries, bloom: makeBloom(entries.map((e) => e[0])) };
    setSsts([sst]);
    setHl(null);
    log.add(`compaction: merge-sorted ${ssts.length} SSTables (${before} entries) into #${sst.id} (${entries.length} entries), newest value wins, tombstones dropped.`, 'good');
  };

  const crash = () => {
    const rebuilt = new Map<string, Val>();
    for (const w of wal) { const [k, v] = w.split('='); rebuilt.set(k, v === '␡' ? null : v); }
    log.add(`💥 crash: memtable lost! Recovery replays the WAL (${wal.length} entries) to rebuild it.`, 'bad');
    setMem(rebuilt);
  };

  return (
    <div>
      <Controls>
        <label>key <input type="text" value={key} onChange={(e) => setKey(e.target.value.trim())} /></label>
        <label>value <input type="text" value={val} onChange={(e) => setVal(e.target.value)} /></label>
        <button className="btn sm primary" onClick={put}>PUT</button>
        <button className="btn sm" onClick={get}>GET</button>
        <button className="btn sm" onClick={del}>DELETE</button>
      </Controls>
      <Controls>
        <button className="btn sm" onClick={randomWrites}>+5 random writes</button>
        <button className="btn sm" onClick={compact}>Compact SSTables</button>
        <button className="btn sm" onClick={crash}>Crash &amp; recover</button>
        <label><input type="checkbox" checked={useBloom} onChange={(e) => setUseBloom(e.target.checked)} /> Bloom filters</label>
      </Controls>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div style={{ border: '1.5px solid var(--v-b)', borderRadius: 10, padding: 8 }}>
          <div className="eyebrow">Memtable (in memory, sorted) — {mem.size}/{MEM_LIMIT}</div>
          {mem.size === 0 ? <span className="small muted">(empty)</span> :
            [...mem.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([k, v]) => <span key={k} className={`chip ${v === null ? 'd' : 'b'}`}>{k}:{v ?? '␡'}</span>)}
        </div>
        <div style={{ border: '1px dashed var(--ink-3)', borderRadius: 10, padding: 8 }}>
          <div className="eyebrow">Write-ahead log on disk (unsorted, append-only)</div>
          {wal.length === 0 ? <span className="small muted">(empty)</span> : wal.map((w, i) => <span key={i} className="chip">{w}</span>)}
        </div>
      </div>
      <div className="eyebrow" style={{ marginTop: 10 }}>SSTables on disk (immutable, sorted) — newest at the top</div>
      {ssts.length === 0 && <div className="small muted">none yet — fill the memtable</div>}
      {[...ssts].reverse().map((t) => {
        const skipped = hl?.skipped?.includes(t.id);
        return (
          <div key={t.id} style={{ border: `1.5px solid ${hl?.sst === t.id ? 'var(--v-a)' : 'var(--line)'}`, borderRadius: 10, padding: '6px 8px', marginBottom: 6, background: 'var(--v-fill)', opacity: skipped ? 0.5 : 1 }}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <span className="small" style={{ fontWeight: 650 }}>SSTable #{t.id}{skipped ? ' · skipped by Bloom filter' : ''}</span>
              <span title="Bloom filter bits" style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: 1 }}>
                {t.bloom.map((b, i) => <span key={i} style={{ color: b ? 'var(--v-e)' : 'var(--v-muted)' }}>{b ? '1' : '0'}</span>)}
              </span>
            </div>
            {t.entries.map(([k, v], j) => (
              <span key={k} className={`chip ${v === null ? 'd' : hl?.sst === t.id && hl.key === k ? 'a' : ''}`}
                style={{ borderLeft: j % SPARSE_EVERY === 0 ? '3px solid var(--v-c)' : undefined }}>
                {k}:{v ?? '␡'}
              </span>
            ))}
          </div>
        );
      })}
      <div>
        <Stat label="SSTables" value={ssts.length} />
        <Stat label="Disk reads by GETs" value={diskReads} />
        <span className="small muted">Orange left border = key in the sparse in-memory index. Purple bits = Bloom filter.</span>
      </div>
      <Log lines={log.lines} />
    </div>
  );
}
