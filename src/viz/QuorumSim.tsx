import { useState } from 'react';
import { Controls, Log, Slider, Stat, useLog } from './ui';

/**
 * Dynamo-style leaderless replication (pp. 171-178). A key lives on n "home" replicas; writes go to all
 * reachable home replicas and succeed with w acks; reads ask all reachable and succeed with r replies,
 * returning the highest version. Optional read repair, anti-entropy, and a sloppy quorum that writes
 * to stand-in nodes (with hints) when home nodes are unreachable.
 */
interface Rep { version: number; value: string; up: boolean; hint?: number }

export default function QuorumSim() {
  const [n, setN] = useState(3);
  const [w, setW] = useState(2);
  const [r, setR] = useState(2);
  const [reps, setReps] = useState<Rep[]>(() => Array.from({ length: 7 }, () => ({ version: 6, value: 'me-old.jpg', up: true })));
  const [extras, setExtras] = useState<Rep[]>([{ version: 0, value: '', up: true }, { version: 0, value: '', up: true }]);
  const [readRepair, setReadRepair] = useState(true);
  const [sloppy, setSloppy] = useState(false);
  const [readOrder, setReadOrder] = useState<'first' | 'random'>('first');
  const [latest, setLatest] = useState(6);
  const [nextV, setNextV] = useState(7);
  const [result, setResult] = useState<{ value: string; version: number; stale: boolean } | null>(null);
  const log = useLog();
  const home = reps.slice(0, n);

  const toggle = (i: number) => setReps(reps.map((x, j) => (j === i ? { ...x, up: !x.up } : x)));

  const write = () => {
    const v = nextV;
    setNextV(v + 1);
    const value = `me-v${v}.jpg`;
    const ns = reps.map((x) => ({ ...x }));
    const up = ns.slice(0, n).map((x, i) => (x.up ? i : -1)).filter((i) => i >= 0);
    up.forEach((i) => { ns[i].version = v; ns[i].value = value; });
    let acks = up.length;
    let es = extras;
    if (sloppy && acks < w) {
      es = extras.map((e) => ({ ...e }));
      const missingHomes = ns.slice(0, n).map((x, i) => (x.up ? -1 : i)).filter((i) => i >= 0);
      for (let k = 0; k < es.length && acks < w; k++) {
        es[k] = { version: v, value, up: true, hint: missingHomes[k] };
        acks++;
      }
      log.add(`sloppy quorum: ${acks - up.length} stand-in node(s) accepted the write with a hint for its home replica`, 'warn');
    }
    if (acks >= w) {
      setReps(ns); setExtras(es); setLatest(v);
      log.add(`write v${v}: sent to all ${n} home replicas, ${up.length} acked${sloppy && acks > up.length ? ` (+${acks - up.length} stand-ins)` : ''} ≥ w=${w} → SUCCESS`, 'good');
    } else {
      setReps(ns); // the write is NOT rolled back on the replicas that accepted it
      log.add(`write v${v}: only ${acks} ack(s) < w=${w} → reported as FAILED (but ${up.length} replica(s) still have it — no rollback)`, 'bad');
    }
  };

  const read = () => {
    const upIdx = reps.slice(0, n).map((x, i) => (x.up ? i : -1)).filter((i) => i >= 0);
    if (upIdx.length < r) {
      log.add(`read: only ${upIdx.length} home replica(s) reachable < r=${r} → ERROR`, 'bad');
      setResult(null);
      return;
    }
    const order = readOrder === 'random' ? [...upIdx].sort(() => Math.random() - 0.5) : upIdx;
    const asked = order.slice(0, r);
    const best = asked.reduce((a, i) => (reps[i].version > reps[a].version ? i : a), asked[0]);
    const value = reps[best].value, version = reps[best].version;
    const staleNodes = asked.filter((i) => reps[i].version < version);
    let ns = reps;
    if (readRepair && staleNodes.length) {
      ns = reps.map((x, i) => (staleNodes.includes(i) ? { ...x, version, value } : x));
      setReps(ns);
    }
    setResult({ value, version, stale: version < latest });
    log.add(`read from replicas ${asked.map((i) => i + 1).join(', ')} → v${version} "${value}"${version < latest ? '  (STALE: latest successful write is v' + latest + ')' : version > latest ? '  (this value comes from a write that was reported as FAILED)' : ''}${readRepair && staleNodes.length ? `; read repair fixed replica ${staleNodes.map((i) => i + 1).join(', ')}` : ''}`, version < latest ? 'bad' : 'good');
  };

  const antiEntropy = () => {
    const upHome = reps.slice(0, n).filter((x) => x.up);
    if (!upHome.length) return;
    const best = upHome.reduce((a, b) => (b.version > a.version ? b : a));
    setReps(reps.map((x, i) => (i < n && x.up ? { ...x, version: best.version, value: best.value } : x)));
    log.add(`anti-entropy: background process copied v${best.version} to every reachable home replica`, 'muted');
  };

  const handoff = () => {
    let ns = reps.map((x) => ({ ...x }));
    let moved = 0;
    const es = extras.map((e) => {
      if (e.hint !== undefined && ns[e.hint].up) {
        if (e.version > ns[e.hint].version) { ns[e.hint].version = e.version; ns[e.hint].value = e.value; }
        moved++;
        return { version: 0, value: '', up: true };
      }
      return e;
    });
    setReps(ns); setExtras(es);
    log.add(moved ? `hinted handoff: ${moved} write(s) delivered to their home replicas` : 'hinted handoff: home replicas still unreachable', moved ? 'good' : 'muted');
  };

  const quorumOk = w + r > n;
  return (
    <div>
      <Controls>
        <Slider label="n (replicas)" value={n} min={1} max={7} onChange={(v) => { setN(v); setW(Math.min(w, v)); setR(Math.min(r, v)); }} />
        <Slider label="w" value={w} min={1} max={n} onChange={setW} />
        <Slider label="r" value={r} min={1} max={n} onChange={setR} />
        <span className="stat">w + r = {w + r} {quorumOk ? '>' : '≤'} n = {n} → <b style={{ color: quorumOk ? 'var(--good)' : 'var(--warn)' }}>{quorumOk ? 'quorum' : 'no overlap guaranteed'}</b></span>
      </Controls>
      <Controls>
        <button className="btn sm primary" onClick={write}>Write new picture</button>
        <button className="btn sm primary" onClick={read}>Read</button>
        <label><input type="checkbox" checked={readRepair} onChange={(e) => setReadRepair(e.target.checked)} /> read repair</label>
        <label>read from <select value={readOrder} onChange={(e) => setReadOrder(e.target.value as 'first' | 'random')}><option value="first">first r replicas</option><option value="random">random r replicas</option></select></label>
        <button className="btn sm" onClick={antiEntropy}>Run anti-entropy</button>
      </Controls>
      <Controls>
        <label><input type="checkbox" checked={sloppy} onChange={(e) => setSloppy(e.target.checked)} /> sloppy quorum (use stand-in nodes)</label>
        {sloppy && <button className="btn sm" onClick={handoff}>Hinted handoff</button>}
        <span className="small muted">Click a replica to take it down / bring it back.</span>
      </Controls>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {home.map((x, i) => (
          <button key={i} onClick={() => toggle(i)} className="opt" style={{
            width: 120, margin: 0, textAlign: 'center', opacity: x.up ? 1 : 0.45,
            borderColor: !x.up ? 'var(--v-d)' : x.version === latest ? 'var(--v-b)' : 'var(--v-c)',
          }}>
            <div style={{ fontWeight: 700 }}>Replica {i + 1}{x.up ? '' : ' · down'}</div>
            <div className="small" style={{ fontFamily: 'var(--mono)' }}>v{x.version}</div>
            <div className="small" style={{ fontFamily: 'var(--mono)', color: x.version === latest ? 'var(--v-b)' : 'var(--v-c)' }}>{x.value}</div>
          </button>
        ))}
        {sloppy && extras.map((e, k) => (
          <div key={`e${k}`} className="opt" style={{ width: 120, margin: 0, textAlign: 'center', borderStyle: 'dashed', cursor: 'default' }}>
            <div style={{ fontWeight: 700 }}>Stand-in {k + 1}</div>
            <div className="small" style={{ fontFamily: 'var(--mono)' }}>{e.hint !== undefined ? `v${e.version} for replica ${e.hint + 1}` : '(no hints)'}</div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 8 }}>
        <Stat label="Latest successful write" value={`v${latest}`} />
        <Stat label="Last read returned" value={result ? `v${result.version}` : '—'} tone={result ? (result.stale ? 'bad' : 'good') : undefined} />
        <Stat label="Home replicas up" value={`${home.filter((x) => x.up).length}/${n}`} />
      </div>
      <Log lines={log.lines} />
    </div>
  );
}
