import { useState } from 'react';
import { Controls, Seg, Slider, Stat, fmtNum } from './ui';

type Mode = 'pull' | 'push' | 'hybrid';
const USERS = ['ana', 'bo', 'cy', 'dee', 'eli'];
// who follows whom (follower -> followees). "star" is the celebrity everyone follows.
const FOLLOWS: Record<string, string[]> = {
  ana: ['bo', 'cy', 'star'], bo: ['ana', 'star'], cy: ['ana', 'bo', 'dee', 'star'], dee: ['eli', 'star'], eli: ['ana', 'dee', 'star'],
};
const followersOf = (u: string) => Object.keys(FOLLOWS).filter((f) => FOLLOWS[f].includes(u));
const STAR_FOLLOWERS_REAL = 31_000_000;

interface Tweet { id: number; by: string }

export default function FanoutSim() {
  const [mode, setMode] = useState<Mode>('push');
  const [tweets, setTweets] = useState<Tweet[]>([]);
  const [boxes, setBoxes] = useState<Record<string, number[]>>({});
  const [writeOps, setWriteOps] = useState(0);
  const [readOps, setReadOps] = useState(0);
  const [lastRead, setLastRead] = useState<{ user: string; ids: number[]; touched: string[] } | null>(null);
  const [flash, setFlash] = useState<string[]>([]);
  // calculator
  const [tps, setTps] = useState(4600);
  const [rps, setRps] = useState(300000);
  const [avgFollowers, setAvgFollowers] = useState(75);
  const [avgFollowees, setAvgFollowees] = useState(200);

  const post = (by: string) => {
    const id = tweets.length + 1;
    setTweets([...tweets, { id, by }]);
    let ops = 1; // insert into global tweets table
    const pushTo = mode === 'push' || (mode === 'hybrid' && by !== 'star') ? followersOf(by) : [];
    if (pushTo.length) {
      const nb = { ...boxes };
      for (const f of pushTo) nb[f] = [...(nb[f] ?? []), id];
      setBoxes(nb);
      ops += by === 'star' ? STAR_FOLLOWERS_REAL : pushTo.length;
    }
    setFlash(pushTo);
    setTimeout(() => setFlash([]), 700);
    setWriteOps(writeOps + ops);
  };

  const read = (user: string) => {
    let ids: number[] = [];
    let touched: string[] = [];
    let ops = 0;
    if (mode === 'pull') {
      touched = FOLLOWS[user];
      ids = tweets.filter((t) => touched.includes(t.by)).map((t) => t.id);
      ops = touched.length; // one lookup per followee, then merge
    } else if (mode === 'push') {
      ids = boxes[user] ?? [];
      ops = 1;
    } else {
      const celebs: string[] = FOLLOWS[user].filter((u) => u === 'star');
      touched = celebs;
      ids = [...(boxes[user] ?? []), ...tweets.filter((t) => celebs.includes(t.by)).map((t) => t.id)];
      ops = 1 + celebs.length;
    }
    setReadOps(readOps + ops);
    setLastRead({ user, ids: ids.sort((a, b) => b - a), touched });
  };

  const reset = () => { setTweets([]); setBoxes({}); setWriteOps(0); setReadOps(0); setLastRead(null); };

  // Calculator for whole-system load
  const pullRead = rps * avgFollowees, pullWrite = tps;
  const pushRead = rps, pushWrite = tps * avgFollowers;
  const by = (n: number) => fmtNum(n);

  return (
    <div>
      <Controls>
        <Seg value={mode} onChange={(m) => { setMode(m); reset(); }} options={[
          { value: 'pull', label: '1 · Query on read' },
          { value: 'push', label: '2 · Fan-out on write' },
          { value: 'hybrid', label: 'Hybrid' },
        ]} />
        <button className="btn sm ghost" onClick={reset}>Reset</button>
      </Controls>
      <Controls>
        <span className="small muted">Post:</span>
        {USERS.map((u) => <button key={u} className="btn sm" onClick={() => post(u)}>{u}</button>)}
        <button className="btn sm" style={{ borderColor: 'var(--v-c)' }} onClick={() => post('star')}>★ star (31M followers)</button>
      </Controls>
      <Controls>
        <span className="small muted">Read home timeline of:</span>
        {USERS.map((u) => <button key={u} className="btn sm" onClick={() => read(u)}>{u}</button>)}
      </Controls>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr', gap: 14 }}>
        <div>
          <div className="eyebrow">Global tweets table</div>
          <div style={{ minHeight: 34 }}>
            {tweets.length === 0 && <span className="small muted">(empty)</span>}
            {tweets.map((t) => (
              <span key={t.id} className={`chip ${t.by === 'star' ? 'c' : 'a'}`}
                style={{ outline: lastRead?.touched.includes(t.by) && lastRead.ids.includes(t.id) ? '2px solid var(--v-e)' : undefined }}>
                T{t.id}·{t.by}
              </span>
            ))}
          </div>
        </div>
        <div>
          <div className="eyebrow">Per-user home-timeline caches {mode === 'pull' && '(not used in approach 1)'}</div>
          {USERS.map((u) => (
            <div key={u} className="row" style={{ gap: 4, opacity: mode === 'pull' ? 0.35 : 1 }}>
              <span className="small" style={{ width: 34, fontWeight: 600, color: flash.includes(u) ? 'var(--v-b)' : undefined }}>{u}</span>
              {(boxes[u] ?? []).map((id) => <span key={id} className="chip b">T{id}</span>)}
            </div>
          ))}
        </div>
      </div>
      {lastRead && (
        <div className="feedback fade-in" style={{ marginTop: 10 }}>
          <strong>{lastRead.user}’s timeline:</strong> {lastRead.ids.length ? lastRead.ids.map((i) => `T${i}`).join(', ') : '(nothing yet)'}
          <div className="small muted">
            {mode === 'pull' && `Looked up recent tweets of ${lastRead.touched.length} followees and merged them.`}
            {mode === 'push' && 'Read one precomputed mailbox.'}
            {mode === 'hybrid' && `Read the mailbox, plus fetched ${lastRead.touched.length} celebrity account(s) at read time.`}
          </div>
        </div>
      )}
      <div style={{ marginTop: 8 }}>
        <Stat label="Write work so far" value={fmtNum(writeOps)} tone={writeOps > 1e6 ? 'bad' : undefined} />
        <Stat label="Read work so far" value={fmtNum(readOps)} />
      </div>

      <hr style={{ border: 0, borderTop: '1px solid var(--line)', margin: '18px 0' }} />
      <div className="eyebrow">Whole-system load (defaults: Twitter, Nov 2012)</div>
      <Controls>
        <Slider label="Tweets/s" value={tps} min={100} max={20000} step={100} onChange={setTps} fmt={by} />
        <Slider label="Timeline reads/s" value={rps} min={1000} max={1000000} step={1000} onChange={setRps} fmt={by} />
        <Slider label="Avg followers" value={avgFollowers} min={1} max={500} onChange={setAvgFollowers} />
        <Slider label="Avg followees" value={avgFollowees} min={1} max={1000} onChange={setAvgFollowees} />
      </Controls>
      <table className="md" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 15 }}>
        <thead><tr><th style={{ textAlign: 'left' }}>Approach</th><th>Write ops/s</th><th>Read lookups/s</th></tr></thead>
        <tbody>
          <tr><td>1 · Query on read</td><td>{by(pullWrite)}</td><td style={{ color: pullRead > pushWrite ? 'var(--bad)' : undefined }}>{by(pullRead)}</td></tr>
          <tr><td>2 · Fan-out on write</td><td style={{ color: pushWrite > pullRead ? 'var(--bad)' : undefined }}>{by(pushWrite)}</td><td>{by(pushRead)}</td></tr>
        </tbody>
      </table>
      <div className="hint">The deciding numbers are the read/write ratio and the follower distribution — these are Twitter’s <em>load parameters</em>. Note how one ★ tweet under fan-out costs 31M writes.</div>
    </div>
  );
}
