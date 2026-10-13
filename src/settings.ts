// Player preferences that outlive any one game: which optional disciplines new games start with.
import { DISCIPLINES, DISCIPLINE_ORDER, type Discipline } from './data';

const KEY = 'pressure-point-settings';
export type DisciplinePrefs = Partial<Record<Discipline, boolean>>;

/** The saved choices, with anything unset left out (unset means on). */
export function loadDisciplinePrefs(): DisciplinePrefs {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    const out: DisciplinePrefs = {};
    for (const d of DISCIPLINE_ORDER) {
      if (DISCIPLINES[d].optional && typeof raw?.disciplines?.[d] === 'boolean') out[d] = raw.disciplines[d];
    }
    return out;
  } catch {
    return {};
  }
}

export function saveDisciplinePref(d: Discipline, on: boolean) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ disciplines: { ...loadDisciplinePrefs(), [d]: on } }));
  } catch {
    // the choice still applies to the current game
  }
}
