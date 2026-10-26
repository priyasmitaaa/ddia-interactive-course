/**
 * Spaced repetition (Leitner boxes). Kept deliberately simple:
 * - a correct answer moves a card up one box, which pushes its next review further out;
 * - a wrong answer sends it back to box 0 (review tomorrow) and counts a lapse;
 * - a card that is answered correctly from the last box "graduates" and stops appearing.
 */
export const INTERVAL_DAYS = [1, 4, 10, 25, 60, 150];
export const DAY = 24 * 60 * 60 * 1000;

export interface Card {
  box: number;
  due: number;
  lapses: number;
  reps: number;
  last: 'right' | 'wrong';
  graduated?: boolean;
}

export function startOfDay(t: number): number {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function dueAfter(now: number, days: number): number {
  return startOfDay(now) + days * DAY;
}

/** Card created from a question answered inside a lesson. */
export function newCard(correct: boolean, now: number): Card {
  return correct
    ? { box: 1, due: dueAfter(now, INTERVAL_DAYS[0] + 1), lapses: 0, reps: 1, last: 'right' }
    : { box: 0, due: dueAfter(now, INTERVAL_DAYS[0]), lapses: 1, reps: 1, last: 'wrong' };
}

export function review(card: Card, correct: boolean, now: number): Card {
  if (!correct) {
    return { box: 0, due: dueAfter(now, INTERVAL_DAYS[0]), lapses: card.lapses + 1, reps: card.reps + 1, last: 'wrong' };
  }
  const last = INTERVAL_DAYS.length - 1;
  if (card.box >= last) {
    return { ...card, reps: card.reps + 1, last: 'right', graduated: true, due: Number.MAX_SAFE_INTEGER };
  }
  const box = card.box + 1;
  return { box, due: dueAfter(now, INTERVAL_DAYS[box]), lapses: card.lapses, reps: card.reps + 1, last: 'right' };
}

export const isDue = (c: Card, now: number) => !c.graduated && c.due <= now;

/** Struggling = got it wrong last time, or has been wrong at least twice and not yet solid. */
export const isStruggling = (c: Card) => !c.graduated && (c.last === 'wrong' || (c.lapses >= 2 && c.box < 3));

/** Due cards ordered: wrong-last-time first, then most overdue. */
export function dueQueue(cards: Record<string, Card>, now: number): string[] {
  return Object.entries(cards)
    .filter(([, c]) => isDue(c, now))
    .sort(([, a], [, b]) => (a.last === b.last ? a.due - b.due : a.last === 'wrong' ? -1 : 1))
    .map(([id]) => id);
}

/** How many correct answers from one lesson become review cards (wrong ones always do). */
export const CORRECT_CARDS_PER_LESSON = 3;
export const SESSION_SIZE = 10;
