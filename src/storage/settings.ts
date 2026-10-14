// Player preferences that outlive any one game: which optional disciplines new games start with.
import { type Discipline, DISCIPLINE_ORDER, DISCIPLINES } from '../core/data';
import { isRecord } from './json';

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

/** Remember whether new games start with a discipline switched on. */
export function saveDisciplinePref(d: Discipline, on: boolean) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ disciplines: { ...loadDisciplinePrefs(), [d]: on } }));
  } catch {
    // the choice still applies to the current game
  }
}

const STATS_KEY = 'pressure-point-stats-view';

/** The charts chosen for the Stats menu, or none if the player has not chosen (so the defaults show). */
export function loadStatsView(): string[] {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(STATS_KEY) ?? '[]');
    return Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

/** Remember the charts chosen for the Stats menu, for this game and the next. */
export function saveStatsView(ids: readonly string[]) {
  try {
    localStorage.setItem(STATS_KEY, JSON.stringify(ids));
  } catch {
    // the choice still applies until the page closes
  }
}
