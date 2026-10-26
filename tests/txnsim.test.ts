import { describe, expect, it } from 'vitest';
import { finalDb, initEngine, SCENARIOS, step, type Level } from '../src/viz/TxnSim';

/** Run a scenario to completion and report whether its invariant held. */
function run(scenario: string, level: Level, detectLost = true) {
  const sc = SCENARIOS[scenario];
  let e = initEngine(sc);
  for (let n = 0; n < 40 && !e.done.every(Boolean); n++) e = step(e, level, sc, detectLost);
  expect(e.done.every(Boolean), `${scenario}/${level} did not finish`).toBe(true);
  return { ok: sc.check(finalDb(e), { A: e.tx.A.vars, B: e.tx.B.vars }, { A: e.tx.A.status, B: e.tx.B.status }).ok, e };
}

// Expected outcomes, as described in Chapter 7 (pp. 225-257).
const EXPECT: Record<string, Record<Level, boolean>> = {
  lost: { none: false, rc: false, si: true, '2pl': true, ssi: true },
  dirtyRead: { none: false, rc: true, si: true, '2pl': true, ssi: true },
  dirtyWrite: { none: false, rc: true, si: true, '2pl': true, ssi: true },
  readSkew: { none: false, rc: false, si: true, '2pl': true, ssi: true },
  writeSkew: { none: false, rc: false, si: false, '2pl': true, ssi: true },
  phantom: { none: false, rc: false, si: false, '2pl': true, ssi: true },
};

describe('transaction simulator matches the book', () => {
  for (const [sc, levels] of Object.entries(EXPECT)) {
    for (const [level, ok] of Object.entries(levels)) {
      it(`${sc} under ${level} → ${ok ? 'correct' : 'anomaly'}`, () => {
        expect(run(sc, level as Level).ok).toBe(ok);
      });
    }
  }
  it('snapshot isolation WITHOUT lost-update detection (MySQL-style) loses the update', () => {
    expect(run('lost', 'si', false).ok).toBe(false);
  });
  it('2PL resolves write skew with a deadlock and an abort', () => {
    const { e } = run('writeSkew', '2pl');
    expect(e.log.some((l) => l.text.startsWith('DEADLOCK'))).toBe(true);
  });
  it('SSI aborts exactly one transaction in write skew', () => {
    const { e } = run('writeSkew', 'ssi');
    expect([e.tx.A.status, e.tx.B.status].sort()).toEqual(['aborted', 'committed']);
  });
});
