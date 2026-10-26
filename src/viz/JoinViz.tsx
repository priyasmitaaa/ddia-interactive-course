import { useState } from 'react';
import { Controls, Seg, Stat } from './ui';

/**
 * Chapter 10, pp. 391-398: joining user activity events with a users table (Figure 10-2) in batch.
 *  - reduce-side sort-merge join with a secondary sort (Figure 10-3)
 *  - broadcast hash join (small table loaded into every mapper)
 *  - partitioned hash join (both sides partitioned the same way)
 *  - skew: a celebrity "linchpin" key, and the skew-join fix (random reducer + replicate the other side)
 */

export interface UserRec { id: number; dob: number }
export interface EventRec { user: number; url: string }

export const USERS: UserRec[] = [
  { id: 103, dob: 1947 }, { id: 104, dob: 1989 }, { id: 105, dob: 1971 }, { id: 106, dob: 2001 }, { id: 107, dob: 1990 },
];
export const EVENTS: EventRec[] = [
  { user: 104, url: '/x' }, { user: 107, url: '/y' }, { user: 104, url: '/z' }, { user: 103, url: '/x' },
  { user: 105, url: '/w' }, { user: 106, url: '/y' }, { user: 107, url: '/x' }, { user: 103, url: '/z' },
];
export const CELEB = 105;
export const skewedEvents = (): EventRec[] => [...EVENTS, ...Array.from({ length: 16 }, (_, i) => ({ user: CELEB, url: `/reply/${i}` }))];

const REF_YEAR = 2016;
export const age = (dob: number) => REF_YEAR - dob;

/** Reduce-side sort-merge join: partition by user id mod R; secondary sort puts the user record first. */
export function sortMergeJoin(events: EventRec[], users: UserRec[], R: number, skewJoin = false) {
  type Item = { key: number; kind: 'user' | 'event'; text: string; url?: string; dob?: number };
  const reducers: Item[][] = Array.from({ length: R }, () => []);
  let rr = 0;
  for (const u of users) {
    const targets = skewJoin && u.id === CELEB ? [...Array(R).keys()] : [u.id % R]; // replicate linchpin's user record
    for (const t of targets) reducers[t].push({ key: u.id, kind: 'user', text: `${u.id} dob:${u.dob}`, dob: u.dob });
  }
  for (const e of events) {
    const t = skewJoin && e.user === CELEB ? (rr++ % R) : e.user % R; // spread the linchpin's events over all reducers
    reducers[t].push({ key: e.user, kind: 'event', text: `${e.user} url:${e.url}`, url: e.url });
  }
  for (const items of reducers) items.sort((a, b) => a.key - b.key || (a.kind === 'user' ? -1 : 1) - (b.kind === 'user' ? -1 : 1));
  const output: string[][] = reducers.map((items) => {
    const out: string[] = [];
    let curDob: number | undefined;
    let curKey = -1;
    for (const it of items) {
      if (it.key !== curKey) { curKey = it.key; curDob = undefined; }
      if (it.kind === 'user') curDob = it.dob;
      else if (curDob !== undefined) out.push(`${it.url} viewed by age ${age(curDob)}`);
    }
    return out;
  });
  return { reducers, output, load: reducers.map((r) => r.length) };
}

/** Broadcast hash join: each mapper (one per event block) loads ALL users into a hash table. */
export function broadcastJoin(events: EventRec[], users: UserRec[], blocks: number) {
  const table = new Map(users.map((u) => [u.id, u.dob]));
  const per = Math.ceil(events.length / blocks);
  const mappers = Array.from({ length: blocks }, (_, b) => events.slice(b * per, (b + 1) * per));
  const output = mappers.map((evs) => evs.map((e) => `${e.url} viewed by age ${age(table.get(e.user)!)}`));
  return { mappers, output, tableSize: table.size, loaded: users.length * blocks };
}

/** Partitioned hash join: both inputs partitioned by user id mod P; mapper p joins partition p of each. */
export function partitionedJoin(events: EventRec[], users: UserRec[], P: number) {
  const parts = Array.from({ length: P }, (_, p) => ({
    users: users.filter((u) => u.id % P === p),
    events: events.filter((e) => e.user % P === p),
  }));
  const output = parts.map(({ users: us, events: evs }) => {
    const t = new Map(us.map((u) => [u.id, u.dob]));
    return evs.filter((e) => t.has(e.user)).map((e) => `${e.url} viewed by age ${age(t.get(e.user)!)}`);
  });
  return { parts, output, loaded: users.length };
}

export default function JoinViz({ initialTab = 'sortmerge' }: { initialTab?: 'sortmerge' | 'broadcast' | 'partitioned' | 'skew' }) {
  const [tab, setTab] = useState(initialTab);
  const [skewFix, setSkewFix] = useState(false);
  const R = 2;
  const card = (title: string, lines: string[], cls = '') => (
    <div key={title} className={`opt ${cls}`} style={{ margin: 0, minWidth: 200, flex: 1, cursor: 'default' }}>
      <div style={{ fontWeight: 700, marginBottom: 4 }}>{title}</div>
      <div style={{ fontFamily: 'var(--mono)', fontSize: 12.5, lineHeight: 1.5 }}>{lines.length ? lines.map((l, i) => <div key={i}>{l}</div>) : <span className="muted">(nothing)</span>}</div>
    </div>
  );
  let body;
  if (tab === 'sortmerge' || tab === 'skew') {
    const events = tab === 'skew' ? skewedEvents() : EVENTS;
    const r = sortMergeJoin(events, USERS, R, tab === 'skew' && skewFix);
    const max = Math.max(...r.load);
    body = (
      <div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {r.reducers.map((items, i) => card(`Reducer ${i + 1} input (${i === 0 ? 'even' : 'odd'} user IDs${tab === 'skew' && skewFix ? ' + spread celebrity' : ''}) — sorted, user record first`, items.map((it) => (it.kind === 'user' ? `▶ ${it.text}` : `  ${it.text}`)).slice(0, 14).concat(items.length > 14 ? [`  … ${items.length - 14} more`] : [])))}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
          {r.output.map((o, i) => card(`Reducer ${i + 1} output`, o.slice(0, 8).concat(o.length > 8 ? [`… ${o.length - 8} more`] : []), 'correct'))}
        </div>
        <div style={{ marginTop: 8 }}>
          {r.load.map((l, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '2px 0' }}>
              <span className="small" style={{ width: 80 }}>Reducer {i + 1}</span>
              <div style={{ height: 14, width: `${(l / max) * 60}%`, background: l === max && tab === 'skew' && !skewFix ? 'var(--v-d)' : 'var(--v-a)', borderRadius: 4 }} />
              <span className="small">{l} records</span>
            </div>
          ))}
        </div>
      </div>
    );
  } else if (tab === 'broadcast') {
    const r = broadcastJoin(EVENTS, USERS, 2);
    body = (
      <div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {r.mappers.map((evs, i) => card(`Mapper ${i + 1}: hash table = ALL ${r.tableSize} users; scans event block ${i + 1}`, evs.map((e) => `${e.user} url:${e.url}`)))}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
          {r.output.map((o, i) => card(`Mapper ${i + 1} output (no reducers, no sort)`, o, 'correct'))}
        </div>
        <Stat label="User records loaded in total" value={`${r.loaded} (the small table is "broadcast" to every mapper)`} />
      </div>
    );
  } else {
    const r = partitionedJoin(EVENTS, USERS, 2);
    body = (
      <div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {r.parts.map((p, i) => card(`Mapper ${i + 1}: users with id mod 2 = ${i} in its hash table; events with id mod 2 = ${i}`, [...p.users.map((u) => `▶ ${u.id} dob:${u.dob}`), ...p.events.map((e) => `  ${e.user} url:${e.url}`)]))}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
          {r.output.map((o, i) => card(`Mapper ${i + 1} output`, o, 'correct'))}
        </div>
        <Stat label="User records loaded in total" value={`${r.loaded} (each mapper loads only its partition)`} />
      </div>
    );
  }
  return (
    <div>
      <Controls>
        <Seg value={tab} onChange={setTab} options={[
          { value: 'sortmerge', label: 'Sort-merge (reduce-side)' },
          { value: 'broadcast', label: 'Broadcast hash (map-side)' },
          { value: 'partitioned', label: 'Partitioned hash (map-side)' },
          { value: 'skew', label: 'Skew' },
        ]} />
        {tab === 'skew' && <label><input type="checkbox" checked={skewFix} onChange={(e) => setSkewFix(e.target.checked)} /> skew join (spread user {CELEB}'s events, replicate its record)</label>}
      </Controls>
      {body}
      <p className="small muted">
        {tab === 'sortmerge' && 'Mappers emit (user_id, record); partitioning by user ID and the secondary sort bring each user’s record and then their events to the same reduce call. The reducer keeps one date of birth in memory and never touches the network (pp. 393–394).'}
        {tab === 'broadcast' && 'Works when the small input fits in memory in every mapper. No partitioning, no sorting, no reducers — just a hash lookup per event (pp. 396–397).'}
        {tab === 'partitioned' && 'Works only if both inputs have the same number of partitions, by the same key and hash function — often true when prior jobs produced them (p. 397). Hive calls this a bucketed map join.'}
        {tab === 'skew' && (skewFix ? 'The celebrity’s events go to random reducers and its user record goes to all of them, so the load is shared (Pig/Hive "skew join", p. 396).' : `User ${CELEB} is a celebrity ("linchpin object") with many events: one reducer gets most of the work, and the whole job waits for it (p. 395).`)}
      </p>
    </div>
  );
}
