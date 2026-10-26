import { useRef, useState } from 'react';
import { Controls, Log, Slider, Stat, rng, useLog } from './ui';

/**
 * A B-tree of fixed-size pages (B+tree variant: values live in leaf pages, interior pages
 * hold boundary keys). Inserting into a full page splits it and updates the parent; a root
 * split makes the tree one level taller. Counts pages read/written per operation.
 */
interface Node { id: number; leaf: boolean; keys: number[]; children: number[] }
type Tree = { root: number; nodes: Record<number, Node> };

function emptyTree(): Tree {
  return { root: 1, nodes: { 1: { id: 1, leaf: true, keys: [], children: [] } } };
}

function findPath(t: Tree, key: number): number[] {
  const path = [t.root];
  let n = t.nodes[t.root];
  while (!n.leaf) {
    let i = 0;
    while (i < n.keys.length && key >= n.keys[i]) i++;
    n = t.nodes[n.children[i]];
    path.push(n.id);
  }
  return path;
}

export default function BTreeSim() {
  const [maxKeys, setMaxKeys] = useState(3);
  const [tree, setTree] = useState<Tree>(emptyTree);
  const [input, setInput] = useState('42');
  const [hl, setHl] = useState<{ path: number[]; written: number[]; key?: number }>({ path: [], written: [] });
  const [stats, setStats] = useState({ lastWrites: 0, lastReads: 0, splits: 0 });
  const nextId = useRef(2);
  const r = useRef(rng(5));
  const log = useLog();

  const insert = (t0: Tree, key: number, quiet = false): { t: Tree; written: number[]; path: number[]; split: number } => {
    const t: Tree = { root: t0.root, nodes: Object.fromEntries(Object.entries(t0.nodes).map(([k, n]) => [k, { ...n, keys: [...n.keys], children: [...n.children] }])) };
    const path = findPath(t, key);
    const leaf = t.nodes[path[path.length - 1]];
    const written = new Set<number>();
    let splits = 0;
    if (leaf.keys.includes(key)) {
      written.add(leaf.id);
      if (!quiet) log.add(`key ${key} exists → overwrite its value in leaf page P${leaf.id} in place (1 page write)`);
      return { t, written: [...written], path, split: 0 };
    }
    leaf.keys.push(key);
    leaf.keys.sort((a, b) => a - b);
    written.add(leaf.id);
    // propagate splits up the path
    let level = path.length - 1;
    let node = leaf;
    while (node.keys.length > maxKeys) {
      splits++;
      const id = nextId.current++;
      let sep: number;
      let right: Node;
      if (node.leaf) {
        const mid = Math.ceil(node.keys.length / 2);
        right = { id, leaf: true, keys: node.keys.slice(mid), children: [] };
        node.keys = node.keys.slice(0, mid);
        sep = right.keys[0];
      } else {
        const mid = Math.floor(node.keys.length / 2);
        sep = node.keys[mid];
        right = { id, leaf: false, keys: node.keys.slice(mid + 1), children: node.children.slice(mid + 1) };
        node.keys = node.keys.slice(0, mid);
        node.children = node.children.slice(0, mid + 1);
      }
      t.nodes[id] = right;
      written.add(id);
      if (!quiet) log.add(`page P${node.id} overflowed → split into P${node.id} and P${id}; boundary ${sep} goes to the parent`, 'warn');
      if (level === 0) {
        const rootId = nextId.current++;
        t.nodes[rootId] = { id: rootId, leaf: false, keys: [sep], children: [node.id, id] };
        t.root = rootId;
        written.add(rootId);
        if (!quiet) log.add(`root split → new root P${rootId}: the tree grows one level taller`, 'warn');
        break;
      }
      const parent = t.nodes[path[level - 1]];
      const pos = parent.children.indexOf(node.id);
      parent.keys.splice(pos, 0, sep);
      parent.children.splice(pos + 1, 0, id);
      written.add(parent.id);
      node = parent;
      level--;
    }
    return { t, written: [...written], path, split: splits };
  };

  const doInsert = (keys: number[]) => {
    let t = tree;
    let lastW: number[] = [], lastP: number[] = [], sp = 0;
    for (const k of keys) {
      const res = insert(t, k, keys.length > 1);
      t = res.t; lastW = res.written; lastP = res.path; sp += res.split;
      if (keys.length === 1) log.add(`INSERT ${k}: read ${res.path.length} page(s) on the way down, wrote ${res.written.length} page(s) (each also appended to the WAL first)`, 'good');
    }
    if (keys.length > 1) log.add(`inserted ${keys.length} keys (${sp} page splits)`, 'muted');
    setTree(t);
    setHl({ path: lastP, written: lastW, key: keys[keys.length - 1] });
    setStats((s) => ({ lastWrites: lastW.length, lastReads: lastP.length, splits: s.splits + sp }));
  };

  const lookup = () => {
    const k = Number(input);
    const path = findPath(tree, k);
    const leaf = tree.nodes[path[path.length - 1]];
    const found = leaf.keys.includes(k);
    log.add(`LOOKUP ${k}: ${path.map((p) => `P${p}`).join(' → ')} → ${found ? 'found' : 'not present'} (${path.length} page reads)`, found ? 'good' : 'warn');
    setHl({ path, written: [], key: k });
    setStats((s) => ({ ...s, lastReads: path.length, lastWrites: 0 }));
  };

  const reset = (mk = maxKeys) => { nextId.current = 2; setTree(emptyTree()); setHl({ path: [], written: [] }); setStats({ lastWrites: 0, lastReads: 0, splits: 0 }); log.clear(); setMaxKeys(mk); };

  // ---------- layout ----------
  const KW = 30, PAD = 8, LEAF_GAP = 14, LEVEL_H = 70;
  const width = (n: Node) => Math.max(1, n.keys.length) * KW + PAD * 2;
  const pos: Record<number, { x: number; y: number; w: number }> = {};
  let cursor = 10;
  const depthOf: Record<number, number> = {};
  const place = (id: number, depth: number): number => {
    const n = tree.nodes[id];
    depthOf[id] = depth;
    if (n.leaf) {
      const w = width(n);
      pos[id] = { x: cursor + w / 2, y: 20 + depth * LEVEL_H, w };
      cursor += w + LEAF_GAP;
      return pos[id].x;
    }
    const xs = n.children.map((c) => place(c, depth + 1));
    const x = (xs[0] + xs[xs.length - 1]) / 2;
    pos[id] = { x, y: 20 + depth * LEVEL_H, w: width(n) };
    return x;
  };
  place(tree.root, 0);
  const maxDepth = Math.max(...Object.values(depthOf));
  const W = Math.max(cursor + 10, 400);
  const H = 20 + (maxDepth + 1) * LEVEL_H;
  const height = maxDepth + 1;
  const count = Object.values(tree.nodes).filter((n) => n.leaf).reduce((a, n) => a + n.keys.length, 0);

  return (
    <div>
      <Controls>
        <label>key <input type="number" value={input} onChange={(e) => setInput(e.target.value)} /></label>
        <button className="btn sm primary" onClick={() => doInsert([Number(input)])}>Insert</button>
        <button className="btn sm" onClick={lookup}>Look up</button>
        <button className="btn sm" onClick={() => doInsert(Array.from({ length: 10 }, () => Math.floor(r.current() * 500)))}>+10 random keys</button>
        <button className="btn sm" onClick={() => { const start = count ? Math.max(...Object.values(tree.nodes).flatMap((n) => n.keys)) + 1 : 1; doInsert(Array.from({ length: 10 }, (_, i) => start + i)); }}>+10 ascending keys</button>
      </Controls>
      <Controls>
        <Slider label="Keys per page" value={maxKeys} min={2} max={6} onChange={(v) => reset(v)} />
        <button className="btn sm ghost" onClick={() => reset()}>Reset</button>
      </Controls>
      <div style={{ overflowX: 'auto' }}>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ minWidth: Math.min(W, 1400), maxHeight: 420 }} aria-label="B-tree pages">
          {Object.values(tree.nodes).filter((n) => !n.leaf && pos[n.id]).flatMap((n) => n.children.map((c, i) => {
            const p = pos[n.id], q = pos[c];
            const x1 = p.x - p.w / 2 + PAD + i * KW;
            const on = hl.path.includes(n.id) && hl.path.includes(c);
            return <line key={`${n.id}-${c}`} x1={x1} y1={p.y + 28} x2={q.x} y2={q.y} stroke={on ? 'var(--v-a)' : 'var(--v-muted)'} strokeWidth={on ? 2.5 : 1.3} />;
          }))}
          {Object.values(tree.nodes).filter((n) => pos[n.id]).map((n) => {
            const p = pos[n.id];
            const onPath = hl.path.includes(n.id);
            const wrote = hl.written.includes(n.id);
            return (
              <g key={n.id}>
                <rect x={p.x - p.w / 2} y={p.y} width={p.w} height={28} rx={6}
                  fill={wrote ? 'color-mix(in srgb, var(--v-c) 25%, var(--surface))' : onPath ? 'color-mix(in srgb, var(--v-a) 18%, var(--surface))' : n.leaf ? 'var(--v-fill)' : 'var(--surface)'}
                  stroke={onPath ? 'var(--v-a)' : wrote ? 'var(--v-c)' : 'var(--ink-3)'} strokeWidth={onPath || wrote ? 2 : 1} />
                {n.keys.map((k, i) => (
                  <text key={i} x={p.x - p.w / 2 + PAD + i * KW + KW / 2} y={p.y + 18.5} textAnchor="middle" fontSize={12.5}
                    fontWeight={hl.key === k && n.leaf ? 800 : 500} style={{ fill: hl.key === k && n.leaf ? 'var(--v-a)' : undefined }}>{k}</text>
                ))}
                <text x={p.x - p.w / 2} y={p.y - 3} fontSize={9.5} style={{ fill: 'var(--ink-3)' }}>P{n.id}{n.leaf ? '' : ''}</text>
              </g>
            );
          })}
        </svg>
      </div>
      <div>
        <Stat label="Keys" value={count} />
        <Stat label="Height (levels)" value={height} />
        <Stat label="Pages" value={Object.keys(tree.nodes).length} />
        <Stat label="Pages read (last op)" value={stats.lastReads} />
        <Stat label="Pages written (last op)" value={stats.lastWrites} tone={stats.lastWrites > 2 ? 'warn' : undefined} />
        <Stat label="Total splits" value={stats.splits} />
      </div>
      <div className="hint">Blue = pages read on the way down. Orange = pages written. Bottom row = leaf pages (they hold the values); upper rows hold boundary keys. Real pages hold hundreds of keys (branching factor ~500), so 4 levels can index ~250 TB of 4 KB pages.</div>
      <Log lines={log.lines} />
    </div>
  );
}
