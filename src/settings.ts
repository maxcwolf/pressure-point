// Player preferences that outlive any one game: which optional disciplines new games start with.
import { type Discipline, DISCIPLINE_ORDER, DISCIPLINES } from './core/data';
import { isRecord } from './util';

const KEY = 'pressure-point-settings';
export type DisciplinePrefs = Partial<Record<Discipline, boolean>>;

/** The saved choices, with anything unset left out (unset means on). */
export function loadDisciplinePrefs(): DisciplinePrefs {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    const saved = isRecord(raw) && isRecord(raw.disciplines) ? raw.disciplines : {};
    const out: DisciplinePrefs = {};
    for (const d of DISCIPLINE_ORDER) {
      const on = saved[d];
      if (DISCIPLINES[d].optional && typeof on === 'boolean') out[d] = on;
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
