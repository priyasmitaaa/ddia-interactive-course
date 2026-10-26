import { beforeEach, describe, expect, it } from 'vitest';
import { CORRECT_CARDS_PER_LESSON, DAY, INTERVAL_DAYS, dueQueue, isDue, isStruggling, newCard, review, startOfDay } from '../src/lib/srs';
import { exportProgress, getState, importProgress, recordLessonAnswer, recordReview, resetProgress } from '../src/lib/store';

const NOW = new Date(2026, 0, 15, 14, 30).getTime();

describe('Leitner scheduling', () => {
  it('a wrong first answer is due tomorrow; a right one the day after', () => {
    expect(newCard(false, NOW).due).toBe(startOfDay(NOW) + DAY);
    expect(newCard(true, NOW).due).toBe(startOfDay(NOW) + 2 * DAY);
  });

  it('correct answers climb the boxes with growing intervals', () => {
    let c = newCard(true, NOW);
    let t = NOW;
    const gaps: number[] = [];
    // a new correct card starts in box 1; each on-time correct review moves it up one box
    for (let i = 0; i < INTERVAL_DAYS.length - 2; i++) {
      t = c.due;
      const next = review(c, true, t);
      gaps.push((next.due - startOfDay(t)) / DAY);
      c = next;
    }
    expect(gaps).toEqual(INTERVAL_DAYS.slice(2));          // 10, 25, 60, 150 days
    expect(c.box).toBe(INTERVAL_DAYS.length - 1);
  });

  it('a correct answer from the last box graduates the card', () => {
    const c = { box: INTERVAL_DAYS.length - 1, due: NOW, lapses: 0, reps: 5, last: 'right' as const };
    const g = review(c, true, NOW);
    expect(g.graduated).toBe(true);
    expect(isDue(g, NOW + 1000 * DAY)).toBe(false);
  });

  it('a wrong answer resets to box 0, due tomorrow, and counts a lapse', () => {
    const c = { box: 4, due: NOW, lapses: 1, reps: 6, last: 'right' as const };
    const w = review(c, false, NOW);
    expect(w).toMatchObject({ box: 0, lapses: 2, last: 'wrong', due: startOfDay(NOW) + DAY });
    expect(isStruggling(w)).toBe(true);
  });

  it('due queue puts wrong-last-time cards first, then most overdue', () => {
    const cards = {
      a: { box: 2, due: NOW - 5 * DAY, lapses: 0, reps: 2, last: 'right' as const },
      b: { box: 0, due: NOW - 1 * DAY, lapses: 1, reps: 1, last: 'wrong' as const },
      c: { box: 1, due: NOW - 9 * DAY, lapses: 0, reps: 1, last: 'right' as const },
      d: { box: 1, due: NOW + 3 * DAY, lapses: 0, reps: 1, last: 'right' as const },
    };
    expect(dueQueue(cards, NOW)).toEqual(['b', 'c', 'a']);
  });
});

describe('progress store', () => {
  beforeEach(() => resetProgress());

  it('wrong answers always create cards; only the first few correct answers per lesson do', () => {
    for (let i = 0; i < 6; i++) recordLessonAnswer(`w01d1:q${i}`, true);
    recordLessonAnswer('w01d1:q9', false);
    const cards = Object.keys(getState().cards);
    expect(cards.filter((id) => getState().answers[id].correct).length).toBe(CORRECT_CARDS_PER_LESSON);
    expect(cards).toContain('w01d1:q9');
  });

  it('only the first answer to a lesson question counts', () => {
    recordLessonAnswer('w02d1:q0', false);
    recordLessonAnswer('w02d1:q0', true);
    expect(getState().answers['w02d1:q0'].correct).toBe(false);
  });

  it('reviews update the card', () => {
    recordLessonAnswer('w03d1:q0', false);
    recordReview('w03d1:q0', true);
    expect(getState().cards['w03d1:q0'].box).toBe(1);
  });

  it('export and import round-trip, and import rejects other files', () => {
    recordLessonAnswer('w04d1:q0', true);
    const backup = exportProgress();
    resetProgress();
    expect(Object.keys(getState().answers)).toEqual([]);
    importProgress(backup);
    expect(getState().answers['w04d1:q0'].correct).toBe(true);
    expect(() => importProgress('{"hello": 1}')).toThrow();
  });
});
