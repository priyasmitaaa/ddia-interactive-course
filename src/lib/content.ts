import { buildWeeks, parseExercise } from './parse';
import type { Exercise, Lesson, Week } from './types';

const lessonFiles = import.meta.glob('../../content/w*/d*.md', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
const weekFiles = import.meta.glob('../../content/w*/week.md', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
const exerciseFiles = import.meta.glob('../../practice/*/README.md', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

const norm = (o: Record<string, string>) =>
  Object.fromEntries(Object.entries(o).map(([k, v]) => [k.replace(/^(\.\.\/)+/, ''), v]));

export const weeks: Week[] = buildWeeks(norm(lessonFiles), norm(weekFiles));
export const lessons: Lesson[] = weeks.flatMap((w) => w.lessons);
export const lessonById = new Map(lessons.map((l) => [l.id, l]));
export const exercises: Exercise[] = Object.entries(norm(exerciseFiles))
  .map(([p, s]) => parseExercise(p, s))
  .sort((a, b) => (a.chapter ?? 99) - (b.chapter ?? 99) || a.id.localeCompare(b.id));
export const exerciseById = new Map(exercises.map((e) => [e.id, e]));

export const questionById = new Map(lessons.flatMap((l) => l.questions.map((q) => [q.id, { q, lesson: l }] as const)));

export const CHAPTERS: Record<number, string> = {
  1: 'Reliable, Scalable and Maintainable Applications',
  2: 'Data Models and Query Languages',
  3: 'Storage and Retrieval',
  4: 'Encoding and Evolution',
  5: 'Replication',
  6: 'Partitioning',
  7: 'Transactions',
  8: 'The Trouble with Distributed Systems',
  9: 'Consistency and Consensus',
  10: 'Batch Processing',
  11: 'Stream Processing',
};
