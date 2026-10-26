import { useSyncExternalStore } from 'react';
import { CORRECT_CARDS_PER_LESSON, newCard, review, type Card } from './srs';

export interface Answer { correct: boolean; chosen?: number; text?: string; at: number }

export interface State {
  version: 1;
  completed: Record<string, number>;
  answers: Record<string, Answer>;
  cards: Record<string, Card>;
  drafts: Record<string, string>;
  exercisesDone: Record<string, number>;
  lastLesson?: string;
}

const KEY = 'ddia-course-progress-v1';
const empty = (): State => ({ version: 1, completed: {}, answers: {}, cards: {}, drafts: {}, exercisesDone: {} });

function load(): State {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(KEY) : null;
    if (!raw) return empty();
    return { ...empty(), ...JSON.parse(raw) };
  } catch {
    return empty();
  }
}

let state: State = load();
const listeners = new Set<() => void>();

function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* storage unavailable */ }
}

function set(next: State) {
  state = next;
  save();
  listeners.forEach((l) => l());
}

export const getState = () => state;
export function useStore(): State {
  return useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => state);
}

// Keep tabs in sync if the course is open twice.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === KEY) { state = load(); listeners.forEach((l) => l()); }
  });
}

const lessonOf = (qid: string) => qid.split(':')[0];

/** First answer to a question inside a lesson. Creates its review card. */
export function recordLessonAnswer(qid: string, correct: boolean, extra: { chosen?: number; text?: string } = {}) {
  if (state.answers[qid]) return;
  const now = Date.now();
  const answers = { ...state.answers, [qid]: { correct, ...extra, at: now } };
  const cards = { ...state.cards };
  if (!cards[qid]) {
    const lesson = lessonOf(qid);
    const correctCardsFromLesson = Object.keys(cards).filter(
      (id) => lessonOf(id) === lesson && state.answers[id]?.correct,
    ).length;
    if (!correct || correctCardsFromLesson < CORRECT_CARDS_PER_LESSON) cards[qid] = newCard(correct, now);
  }
  set({ ...state, answers, cards });
}

/** Answer given in a review session. */
export function recordReview(qid: string, correct: boolean) {
  const now = Date.now();
  const prev = state.cards[qid] ?? newCard(correct, now);
  set({ ...state, cards: { ...state.cards, [qid]: review(prev, correct, now) } });
}

export function saveDraft(id: string, text: string) {
  set({ ...state, drafts: { ...state.drafts, [id]: text } });
}

export function completeLesson(id: string) {
  set({ ...state, completed: { ...state.completed, [id]: Date.now() } });
}

export function uncompleteLesson(id: string) {
  const completed = { ...state.completed };
  delete completed[id];
  set({ ...state, completed });
}

export function openLesson(id: string) {
  if (state.lastLesson !== id) set({ ...state, lastLesson: id });
}

export function toggleExercise(id: string) {
  const exercisesDone = { ...state.exercisesDone };
  if (exercisesDone[id]) delete exercisesDone[id];
  else exercisesDone[id] = Date.now();
  set({ ...state, exercisesDone });
}

export function exportProgress(): string {
  return JSON.stringify(state, null, 2);
}

export function importProgress(json: string) {
  const parsed = JSON.parse(json);
  if (parsed?.version !== 1 || typeof parsed.completed !== 'object') throw new Error('Not a DDIA course backup file');
  set({ ...empty(), ...parsed });
}

export function resetProgress() {
  set(empty());
}
