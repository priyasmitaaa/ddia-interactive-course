import { useState } from 'react';
import { Controls, Seg, Slider, Stat } from './ui';

/**
 * Chapter 10.
 * Tab "preempt" (pp. 405-406): why MapReduce retries individual tasks. With a 5% chance per task-hour of being
 * preempted (Google's figure), what is the chance that a job with N tasks of length T loses at least one task?
 * Tab "dataflow" (pp. 407-411): a three-stage workflow as chained MapReduce jobs (every stage waits for ALL tasks of
 * the previous stage, and writes/reads intermediate state on HDFS) vs a dataflow engine that pipelines operators.
 */

export function pTaskKilled(hourlyRisk: number, minutes: number) {
  return 1 - Math.pow(1 - hourlyRisk, minutes / 60);
}
export function pJobHit(hourlyRisk: number, tasks: number, minutes: number) {
  return 1 - Math.pow(1 - pTaskKilled(hourlyRisk, minutes), tasks);
}

export interface FlowParams { tasks: number; base: number; straggler: number; materialize: number }

/**
 * Three stages, each with `tasks` tasks of duration `base`, except one straggler per stage taking base * straggler.
 * MapReduce: stage s+1 starts when all of stage s is done, plus write+read of intermediate state (materialize).
 * Dataflow (pipelined): a task of stage s+1 can start as soon as its input partition is produced — modelled as
 * starting when the corresponding task of stage s finishes, with no HDFS round trip; the final stage still ends after
 * the slowest chain.
 */
export function schedule(p: FlowParams) {
  const dur = (stage: number, i: number) => (i === (stage * 2) % p.tasks ? p.base * p.straggler : p.base);
  const mr: { stage: number; i: number; start: number; end: number }[] = [];
  let t = 0;
  for (let s = 0; s < 3; s++) {
    const start = s === 0 ? 0 : t + p.materialize;
    let stageEnd = start;
    for (let i = 0; i < p.tasks; i++) {
      const end = start + dur(s, i);
      mr.push({ stage: s, i, start, end });
      stageEnd = Math.max(stageEnd, end);
    }
    t = stageEnd;
  }
  const df: { stage: number; i: number; start: number; end: number }[] = [];
  const prevEnd = new Array(p.tasks).fill(0);
  for (let s = 0; s < 3; s++) {
    for (let i = 0; i < p.tasks; i++) {
      const start = prevEnd[i];
      const end = start + dur(s, i);
      df.push({ stage: s, i, start, end });
      prevEnd[i] = end;
    }
  }
  return { mr, df, mrTotal: Math.max(...mr.map((x) => x.end)), dfTotal: Math.max(...df.map((x) => x.end)) };
}

export default function BatchFaultsViz({ initialTab = 'preempt' }: { initialTab?: 'preempt' | 'dataflow' }) {
  const [tab, setTab] = useState(initialTab);
  return (
    <div>
      <Controls>
        <Seg value={tab} onChange={setTab} options={[{ value: 'preempt', label: 'Preemption & task retries' }, { value: 'dataflow', label: 'Materialized vs pipelined' }]} />
      </Controls>
      {tab === 'preempt' ? <Preempt /> : <Dataflow />}
    </div>
  );
}

function Preempt() {
  const [risk, setRisk] = useState(0.05);
  const [tasks, setTasks] = useState(100);
  const [minutes, setMinutes] = useState(10);
  const pt = pTaskKilled(risk, minutes);
  const pj = pJobHit(risk, tasks, minutes);
  // expected wasted work: whole-job restart (MPP style) vs task-level retry (MapReduce style), first-order estimate
  const jobWork = tasks * minutes;
  const wasteJob = pj * jobWork / 2;           // on average half the job's work is lost when a kill happens
  const wasteTask = tasks * pt * minutes / 2;  // each killed task loses on average half of itself
  return (
    <div>
      <Controls>
        <Slider label="Preemption risk per task-hour" value={risk} min={0.001} max={0.2} step={0.001} onChange={setRisk} fmt={(v) => `${(v * 100).toFixed(1)}%`} />
        <Slider label="Tasks in the job" value={tasks} min={1} max={2000} onChange={setTasks} />
        <Slider label="Task duration" value={minutes} min={1} max={180} onChange={setMinutes} fmt={(v) => `${v} min`} />
      </Controls>
      <div>
        <Stat label="P(a given task is killed)" value={`${(pt * 100).toFixed(2)}%`} />
        <Stat label="P(at least one task killed)" value={`${(pj * 100).toFixed(1)}%`} tone={pj > 0.5 ? 'bad' : pj > 0.1 ? 'warn' : 'good'} />
      </div>
      <div style={{ marginTop: 6 }}>
        <Stat label="Expected lost work if a kill restarts the whole job" value={`≈ ${wasteJob.toFixed(0)} task-minutes`} tone="bad" />
        <Stat label="…if only the killed task is retried" value={`≈ ${wasteTask.toFixed(0)} task-minutes`} tone="good" />
      </div>
      <p className="small muted">Book: at Google an hour-long task has ~5% risk of being preempted; with 100 tasks of 10 minutes, the risk that at least one is killed exceeds 50% (p. 406). That — not unreliable hardware — is why MapReduce retries individual tasks and writes eagerly to disk. The lost-work estimates are a rough first-order model, not from the book.</p>
    </div>
  );
}

function Dataflow() {
  const [straggler, setStraggler] = useState(3);
  const [materialize, setMaterialize] = useState(4);
  const p = { tasks: 4, base: 5, straggler, materialize };
  const s = schedule(p);
  const W = 660, rowH = 6, gap = 1;
  const T = Math.max(s.mrTotal, s.dfTotal) * 1.05;
  const X = (t: number) => 100 + (t / T) * (W - 110);
  const lane = (label: string, items: typeof s.mr, y0: number) => (
    <g>
      <text x={6} y={y0 + 46} fontWeight={700}>{label}</text>
      {items.map((it, k) => (
        <rect key={k} x={X(it.start)} y={y0 + (it.stage * p.tasks + it.i) * (rowH + gap)} width={Math.max(2, X(it.end) - X(it.start))} height={rowH} rx={2} className={['boxa', 'boxb', 'boxe'][it.stage]} />
      ))}
    </g>
  );
  return (
    <div>
      <Controls>
        <Slider label="Straggler slowdown" value={straggler} min={1} max={6} step={0.5} onChange={setStraggler} fmt={(v) => `${v}×`} />
        <Slider label="Write + read intermediate state on HDFS" value={materialize} min={0} max={10} onChange={setMaterialize} fmt={(v) => `${v} units`} />
      </Controls>
      <svg className="dg" viewBox={`0 0 ${W} 190`} role="img" aria-label="Gantt chart of three stages as chained MapReduce jobs versus a pipelined dataflow">
        {lane('MapReduce', s.mr, 4)}
        {lane('Dataflow', s.df, 100)}
        <line x1={X(s.mrTotal)} x2={X(s.mrTotal)} y1={4} y2={90} stroke="var(--v-d)" strokeDasharray="4 3" />
        <line x1={X(s.dfTotal)} x2={X(s.dfTotal)} y1={100} y2={186} stroke="var(--v-b)" strokeDasharray="4 3" />
      </svg>
      <div>
        <Stat label="Chained MapReduce jobs" value={`${s.mrTotal.toFixed(1)} units`} tone="bad" />
        <Stat label="Pipelined dataflow" value={`${s.dfTotal.toFixed(1)} units`} tone="good" />
        <span className="small muted"> Colours = stages 1, 2, 3; one bar per task.</span>
      </div>
      <p className="small muted">In MapReduce a job can start only when <i>all</i> tasks of the previous job have finished, so every stage waits for its straggler, and intermediate state makes a round trip through replicated HDFS (p. 408). Dataflow engines start operators as soon as their input is ready and keep intermediate state in memory or on local disk (p. 409). Simplified model: one input partition per task chain; real engines must still wait wherever a sort or shuffle needs the whole input (p. 411).</p>
    </div>
  );
}
