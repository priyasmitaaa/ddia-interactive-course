import { useMemo, useState } from 'react';
import { Controls, Seg, Slider, Stat, rng } from './ui';

/**
 * Partitioning key-value data (pp. 193-197): key-range vs hash-of-key partitioning under different
 * workloads, showing data and write load per partition, hot spots, and key salting for a hot key.
 */
type Scheme = 'range' | 'hash';
type Workload = 'names' | 'timestamps' | 'celebrity';
const P = 8;

function fnv(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
  return h;
}

const SYL = ['ka', 'lo', 'mi', 'ra', 'zu', 'be', 'ti', 'no', 'sa', 'vi', 'do', 'fe', 'ha', 'pu', 'we', 'yo'];

export default function PartitionSim() {
  const [scheme, setScheme] = useState<Scheme>('range');
  const [workload, setWorkload] = useState<Workload>('timestamps');
  const [salt, setSalt] = useState(0);

  const { keys, writes, boundaries } = useMemo(() => {
    const r = rng(42);
    const keys: string[] = [];
    const writes: string[] = [];
    if (workload === 'names') {
      for (let i = 0; i < 2000; i++) keys.push(SYL[Math.floor(r() ** 1.6 * 16)] + SYL[Math.floor(r() * 16)] + i);
      for (let i = 0; i < 2000; i++) writes.push(keys[Math.floor(r() * keys.length)]);
    } else if (workload === 'timestamps') {
      // 8 days of historical sensor readings; all NEW writes are "today"
      for (let d = 1; d <= 8; d++) for (let i = 0; i < 250; i++) keys.push(`2014-04-${String(10 + d).padStart(2, '0')} ${String(Math.floor(i / 10)).padStart(2, '0')}:${String(i % 60).padStart(2, '0')}`);
      for (let i = 0; i < 2000; i++) writes.push(`2014-04-19 17:${String(Math.floor(i / 60) % 60).padStart(2, '0')}:${String(i % 60).padStart(2, '0')}`);
    } else {
      for (let i = 0; i < 2000; i++) keys.push(`user${Math.floor(r() * 100000)}`);
      for (let i = 0; i < 2000; i++) writes.push(r() < 0.6 ? 'user_celebrity' : keys[Math.floor(r() * keys.length)]);
    }
    // key-range boundaries chosen to split existing DATA evenly (as an admin or auto-splitting would)
    const sorted = [...keys].sort();
    const boundaries = Array.from({ length: P - 1 }, (_, i) => sorted[Math.floor(((i + 1) * sorted.length) / P)]);
    return { keys, writes, boundaries };
  }, [workload]);

  const partOf = (k: string) => {
    if (scheme === 'hash') return fnv(k) % P;
    let p = 0;
    while (p < boundaries.length && k >= boundaries[p]) p++;
    return p;
  };
  const salted = (k: string, i: number) => (salt > 0 && k === 'user_celebrity' ? `${String(i % salt).padStart(2, '0')}_${k}` : k);

  const dataCount = Array(P).fill(0);
  keys.forEach((k) => dataCount[partOf(k)]++);
  const writeCount = Array(P).fill(0);
  writes.forEach((k, i) => writeCount[partOf(salted(k, i))]++);
  const maxW = Math.max(...writeCount), maxD = Math.max(...dataCount);
  const ideal = writes.length / P;
  const skew = maxW / ideal;

  return (
    <div>
      <Controls>
        <Seg value={scheme} onChange={setScheme} options={[{ value: 'range', label: 'Partition by key range' }, { value: 'hash', label: 'Partition by hash of key' }]} />
      </Controls>
      <Controls>
        <span className="small muted">Workload:</span>
        <Seg value={workload} onChange={(w) => { setWorkload(w); setSalt(0); }} options={[
          { value: 'names', label: 'user names' },
          { value: 'timestamps', label: 'sensor timestamps' },
          { value: 'celebrity', label: 'celebrity hot key' },
        ]} />
        {workload === 'celebrity' && <Slider label="split hot key with random prefix" value={salt} min={0} max={100} step={10} onChange={setSalt} fmt={(v) => (v ? `${v} keys` : 'off')} />}
      </Controls>
      <svg viewBox="0 0 720 210" aria-label="Data and write load per partition">
        {Array.from({ length: P }, (_, p) => {
          const x = 20 + p * 86;
          const hD = (dataCount[p] / maxD) * 70;
          const hW = (writeCount[p] / maxW) * 70;
          const hot = writeCount[p] > ideal * 2;
          return (
            <g key={p}>
              <rect x={x} y={90 - hD} width={34} height={hD} fill="var(--v-a)" rx={3} />
              <rect x={x + 38} y={90 - hW} width={34} height={hW} fill={hot ? 'var(--v-d)' : 'var(--v-b)'} rx={3} />
              <text x={x + 36} y={108} textAnchor="middle" fontSize={12} fontWeight={600}>p{p}</text>
              <text x={x + 17} y={86 - hD} textAnchor="middle" fontSize={10} style={{ fill: 'var(--ink-3)' }}>{dataCount[p]}</text>
              <text x={x + 55} y={86 - hW} textAnchor="middle" fontSize={10} style={{ fill: hot ? 'var(--v-d)' : 'var(--ink-3)' }}>{writeCount[p]}</text>
              {scheme === 'range' && p < P - 1 && <text x={x + 78} y={128 + (p % 2) * 14} textAnchor="middle" fontSize={9.5} style={{ fill: 'var(--ink-3)' }}>|{boundaries[p].slice(0, 11)}</text>}
            </g>
          );
        })}
        <rect x={20} y={170} width={12} height={12} fill="var(--v-a)" /><text x={38} y={180} fontSize={12}>stored keys (existing data)</text>
        <rect x={230} y={170} width={12} height={12} fill="var(--v-b)" /><text x={248} y={180} fontSize={12}>new writes</text>
        <rect x={340} y={170} width={12} height={12} fill="var(--v-d)" /><text x={358} y={180} fontSize={12}>hot spot (&gt;2× fair share)</text>
      </svg>
      <Stat label="Busiest partition gets" value={`${skew.toFixed(1)}× its fair share of writes`} tone={skew > 2 ? 'bad' : skew > 1.3 ? 'warn' : 'good'} />
      <Stat label="Range scan 'one key range' touches" value={scheme === 'range' ? '1–2 partitions' : `all ${P} partitions`} tone={scheme === 'range' ? 'good' : 'warn'} />
      <div className="hint">
        {workload === 'timestamps' && scheme === 'range' && 'All new readings have today’s timestamp, so they all land in the last key range: one hot partition (p. 194–195). Fix: prefix the key with the sensor name, or hash it (losing range scans).'}
        {workload === 'timestamps' && scheme === 'hash' && 'Hashing spreads today’s writes evenly — but “all readings from 2014-04-12” is now a query to every partition.'}
        {workload === 'celebrity' && 'Hashing can’t help when everyone writes the SAME key: identical keys have identical hashes. Split the hot key with a random prefix (p. 197) — reads then have to combine all the split keys.'}
        {workload === 'names' && 'With roughly uniform keys and boundaries that follow the data, both schemes balance well.'}
      </div>
    </div>
  );
}
