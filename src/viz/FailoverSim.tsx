import { useState } from 'react';
import { Controls, Log, Stat, useLog } from './ui';

/**
 * Failover with asynchronous replication (pp. 150-152). Writes are INSERTs with auto-incrementing
 * primary keys; an external cache (like GitHub's Redis) stores data keyed by those IDs. Followers lag
 * by different amounts. Crash the leader, promote a follower, and see what goes wrong.
 */
interface Row { id: number; user: string }
interface Node { name: string; rows: Row[]; up: boolean; leader: boolean }

const USERS = ['alice', 'bob', 'carol', 'dan', 'erin', 'frank', 'gina', 'hugo'];

export default function FailoverSim() {
  const [nodes, setNodes] = useState<Node[]>([
    { name: 'A', rows: [], up: true, leader: true },
    { name: 'B', rows: [], up: true, leader: false },
    { name: 'C', rows: [], up: true, leader: false },
  ]);
  const [cache, setCache] = useState<Record<number, string>>({});
  const [acked, setAcked] = useState<Row[]>([]);
  const [u, setU] = useState(0);
  const log = useLog();

  const leaders = nodes.filter((n) => n.leader && n.up);

  const insert = (via?: number) => {
    const targets = via !== undefined ? [via] : nodes.map((n, i) => (n.leader && n.up ? i : -1)).filter((i) => i >= 0);
    if (targets.length === 0) { log.add('No leader is available — writes fail until failover happens.', 'bad'); return; }
    let ns = nodes.map((n) => ({ ...n, rows: [...n.rows] }));
    let cs = { ...cache };
    const ack: Row[] = [];
    let uu = u;
    for (const t of targets) {
      const L = ns[t];
      const id = (L.rows.length ? Math.max(...L.rows.map((r) => r.id)) : 0) + 1;   // auto-increment on THIS node
      const user = USERS[uu++ % USERS.length];
      const row = { id, user };
      L.rows.push(row);
      ack.push(row);
      const clash = cs[id] && cs[id] !== user;
      cs[id] = user;
      log.add(`leader ${L.name}: INSERT user=${user} → id ${id}; acknowledged; cache[${id}] = ${user}${clash ? '  ⚠ cache entry for this id belonged to someone else!' : ''}`, clash ? 'bad' : undefined);
    }
    setU(uu);
    setNodes(ns);
    setCache(cs);
    setAcked([...acked, ...ack]);
  };

  // asynchronous replication: B gets everything but the last write, C lags 3 writes
  const replicate = () => {
    const L = nodes.find((n) => n.leader && n.up);
    if (!L) return;
    setNodes(nodes.map((n) => {
      if (n === L || !n.up) return n;
      const lag = n.name === 'B' ? 1 : 3;
      const target = L.rows.slice(0, Math.max(n.rows.length, L.rows.length - lag));
      return { ...n, rows: target };
    }));
    log.add('replication caught up partly: B is 1 write behind, C is 3 behind (asynchronous).', 'muted');
  };

  const crashLeader = () => {
    setNodes(nodes.map((n) => (n.leader ? { ...n, up: false } : n)));
    log.add('💥 leader crashed. Followers time out waiting for it…', 'bad');
  };

  const promote = () => {
    const cands = nodes.map((n, i) => ({ n, i })).filter(({ n }) => n.up && !n.leader);
    if (!cands.length) return;
    const best = cands.sort((a, b) => b.n.rows.length - a.n.rows.length)[0];
    const ns = nodes.map((n, i) => ({ ...n, leader: i === best.i ? true : n.up ? false : n.leader }));
    // other followers now follow the new leader: truncate to its log
    for (const n of ns) if (n.up && !n.leader) n.rows = ns[best.i].rows.slice(0, Math.min(n.rows.length, ns[best.i].rows.length));
    setNodes(ns);
    const lost = acked.filter((r) => !ns[best.i].rows.some((x) => x.id === r.id && x.user === r.user));
    log.add(`failover: ${best.n.name} (the most up-to-date follower) promoted to leader.`, 'warn');
    if (lost.length) log.add(`acknowledged writes missing on the new leader: ${lost.map((r) => `${r.user}(id ${r.id})`).join(', ')} — they will be discarded`, 'bad');
  };

  const oldBack = (asLeader: boolean) => {
    const oldIdx = nodes.findIndex((n) => !n.up);
    if (oldIdx < 0) return;
    const newLeader = nodes.find((n) => n.leader && n.up);
    if (!asLeader && newLeader) {
      const discarded = nodes[oldIdx].rows.filter((r) => !newLeader.rows.some((x) => x.id === r.id));
      setNodes(nodes.map((n, i) => (i === oldIdx ? { ...n, up: true, leader: false, rows: [...newLeader.rows] } : n)));
      log.add(`old leader ${nodes[oldIdx].name} rejoins as a follower and discards its unreplicated writes: ${discarded.map((r) => r.user).join(', ') || 'none'}`, discarded.length ? 'bad' : 'muted');
    } else {
      setNodes(nodes.map((n, i) => (i === oldIdx ? { ...n, up: true } : n)));
      log.add(`old leader ${nodes[oldIdx].name} comes back still believing it is the leader → SPLIT BRAIN: two nodes accept writes`, 'bad');
    }
  };

  const reset = () => {
    setNodes([{ name: 'A', rows: [], up: true, leader: true }, { name: 'B', rows: [], up: true, leader: false }, { name: 'C', rows: [], up: true, leader: false }]);
    setCache({}); setAcked([]); setU(0); log.clear();
  };

  const lost = acked.filter((r) => !nodes.filter((n) => n.up && n.leader).some((n) => n.rows.some((x) => x.id === r.id && x.user === r.user)));

  return (
    <div>
      <div className="small muted" style={{ marginBottom: 6 }}>Suggested sequence: Insert ×4 → Replicate → Insert ×2 → Crash leader → Promote → Insert ×2 → watch the cache.</div>
      <Controls>
        <button className="btn sm primary" onClick={() => insert()}>Insert a user</button>
        <button className="btn sm" onClick={replicate}>Replicate (async, partial)</button>
        <button className="btn sm" onClick={crashLeader} disabled={!leaders.length}>Crash leader</button>
        <button className="btn sm" onClick={promote}>Promote a follower</button>
      </Controls>
      <Controls>
        <button className="btn sm" onClick={() => oldBack(false)}>Old leader returns as follower</button>
        <button className="btn sm" onClick={() => oldBack(true)}>Old leader returns still thinking it leads</button>
        {leaders.length > 1 && leaders.map((l) => (
          <button key={l.name} className="btn sm" onClick={() => insert(nodes.indexOf(l))}>Insert via {l.name}</button>
        ))}
        <button className="btn sm ghost" onClick={reset}>Reset</button>
      </Controls>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr) 1.1fr', gap: 8 }}>
        {nodes.map((n) => (
          <div key={n.name} style={{ border: `1.5px solid ${!n.up ? 'var(--v-d)' : n.leader ? 'var(--v-a)' : 'var(--line)'}`, borderRadius: 10, padding: 8, opacity: n.up ? 1 : 0.55, background: 'var(--v-fill)' }}>
            <div style={{ fontWeight: 700 }}>{n.name} {n.leader ? '· leader' : '· follower'} {!n.up && '· DOWN'}</div>
            {n.rows.map((r) => <div key={`${r.id}-${r.user}`} className="small" style={{ fontFamily: 'var(--mono)' }}>id {r.id}: {r.user}</div>)}
          </div>
        ))}
        <div style={{ border: '1.5px dashed var(--v-e)', borderRadius: 10, padding: 8 }}>
          <div style={{ fontWeight: 700 }}>External cache (Redis)</div>
          {Object.entries(cache).map(([id, user]) => {
            const L = nodes.find((n) => n.leader && n.up);
            const dbUser = L?.rows.find((r) => r.id === Number(id))?.user;
            const bad = dbUser !== undefined && dbUser !== user;
            return <div key={id} className="small" style={{ fontFamily: 'var(--mono)', color: bad ? 'var(--bad)' : undefined }}>cache[{id}] = {user}{bad ? ` ≠ db (${dbUser})` : ''}</div>;
          })}
        </div>
      </div>
      <div style={{ marginTop: 6 }}>
        <Stat label="Leaders accepting writes" value={leaders.length} tone={leaders.length > 1 ? 'bad' : leaders.length === 0 ? 'warn' : 'good'} />
        <Stat label="Acknowledged writes lost" value={lost.length} tone={lost.length ? 'bad' : 'good'} />
      </div>
      <Log lines={log.lines} />
    </div>
  );
}
