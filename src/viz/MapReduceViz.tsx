import { useState } from 'react';
import { Controls, Slider, Stat } from './ui';

/**
 * Chapter 10, pp. 387-390 (Figure 10-1): a MapReduce job, phase by phase. Input splits → mappers emit (key, value)
 * → each mapper partitions its output by hash(key) mod R and sorts each partition → reducers fetch their partition
 * from every mapper (the shuffle) → merge, preserving sort order → reduce, once per key.
 */

export const INPUT_SPLITS = [
  ['/favicon.ico', '/', '/about', '/favicon.ico'],
  ['/', '/css/site.css', '/favicon.ico', '/blog'],
  ['/blog', '/', '/favicon.ico', '/css/site.css'],
];

export const hashKey = (k: string) => [...k].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

export function runMapReduce(splits: string[][], reducers: number) {
  const mapOut = splits.map((recs) => recs.map((url) => ({ k: url, v: 1 })));
  // partition by reducer and sort within each partition (on the mapper's local disk)
  const parts = mapOut.map((kvs) => Array.from({ length: reducers }, (_, r) => kvs.filter((kv) => hashKey(kv.k) % reducers === r).sort((a, b) => a.k.localeCompare(b.k))));
  // shuffle + merge: reducer r fetches partition r from every mapper and merges (sorted)
  const reduceIn = Array.from({ length: reducers }, (_, r) => parts.flatMap((p) => p[r]).sort((a, b) => a.k.localeCompare(b.k)));
  const reduceOut = reduceIn.map((kvs) => {
    const out: { k: string; v: number }[] = [];
    for (const kv of kvs) {
      const last = out[out.length - 1];
      if (last && last.k === kv.k) last.v += kv.v; else out.push({ ...kv });
    }
    return out;
  });
  return { mapOut, parts, reduceIn, reduceOut };
}

const PHASES = ['1. Map', '2. Partition + sort (mapper side)', '3. Shuffle + merge (reducer side)', '4. Reduce'];

export default function MapReduceViz() {
  const [phase, setPhase] = useState(0);
  const [reducers, setReducers] = useState(3);
  const r = runMapReduce(INPUT_SPLITS, reducers);
  const box = (title: string, lines: string[], cls: string) => (
    <div key={title} className={`opt ${cls}`} style={{ margin: 0, minWidth: 150, flex: 1, cursor: 'default' }}>
      <div style={{ fontWeight: 700, marginBottom: 4 }}>{title}</div>
      <div style={{ fontFamily: 'var(--mono)', fontSize: 12.5, lineHeight: 1.5 }}>{lines.length ? lines.map((l, i) => <div key={i}>{l}</div>) : <span className="muted">(empty)</span>}</div>
    </div>
  );
  return (
    <div>
      <Controls>
        {PHASES.map((p, i) => <button key={p} className={`btn sm ${i === phase ? 'primary' : ''}`} onClick={() => setPhase(i)}>{p}</button>)}
        <Slider label="Reducers" value={reducers} min={1} max={4} onChange={setReducers} />
      </Controls>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {INPUT_SPLITS.map((s, m) => box(`HDFS input block m${m + 1}`, s, ''))}
      </div>
      <div style={{ textAlign: 'center', margin: '4px 0', color: 'var(--ink-3)' }}>↓ one mapper per input block, run near the data</div>
      {phase === 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {r.mapOut.map((kvs, m) => box(`Mapper ${m + 1} emits`, kvs.map((kv) => `(${kv.k}, ${kv.v})`), 'sel'))}
        </div>
      )}
      {phase === 1 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {r.parts.map((ps, m) => (
            <div key={m} style={{ flex: 1, minWidth: 180 }}>
              {ps.map((kvs, j) => box(`m${m + 1} → r${j + 1} (sorted file)`, kvs.map((kv) => `(${kv.k}, ${kv.v})`), ''))}
            </div>
          ))}
        </div>
      )}
      {phase === 2 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {r.reduceIn.map((kvs, j) => box(`Reducer ${j + 1} input (merged from ${INPUT_SPLITS.length} mappers)`, kvs.map((kv) => `(${kv.k}, ${kv.v})`), 'sel'))}
        </div>
      )}
      {phase === 3 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {r.reduceOut.map((kvs, j) => box(`Reducer ${j + 1} → HDFS output part-${j}`, kvs.map((kv) => `${kv.k}  ${kv.v}`), 'correct'))}
        </div>
      )}
      <div style={{ marginTop: 8 }}>
        <Stat label="Map tasks" value={`${INPUT_SPLITS.length} (one per input block)`} />
        <Stat label="Reduce tasks" value={`${reducers} (chosen by the job author)`} />
        <Stat label="Partitioner" value="hash(key) mod reducers" />
      </div>
      <p className="small muted">
        {phase === 0 && 'The mapper is called once per input record and extracts a key and value — here awk \'{print $7}\' turned into (url, 1).'}
        {phase === 1 && 'Each mapper splits its output by reducer using a hash of the key, and writes each partition as a sorted file on its local disk (like an SSTable).'}
        {phase === 2 && 'The shuffle: every reducer downloads its partition from every mapper and merges the sorted files. Same keys from different mappers become adjacent. (No randomness, despite the name.)'}
        {phase === 3 && 'The reducer is called once per key with an iterator over its values — like uniq -c. Output goes to HDFS. Finding the top 5 needs a second job: a second round of sorting.'}
      </p>
    </div>
  );
}
