// Player preferences that outlive any one game: which optional disciplines new games start with,
// how a sandbox game is set up, and the Stats menu's charts.
import { CENTERS, type Discipline, DISCIPLINE_ORDER, DISCIPLINES, SANDBOX_MONEY } from '../core/data';
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

const SANDBOX_KEY = 'pressure-point-sandbox';

/** How a new sandbox game is set up, beyond its disciplines. */
export interface SandboxSettings {
  money: number;
  unlockAll: boolean;
  /** Whether staff set challenges. */
  challenges: boolean;
  /** Whether stress outbreaks are offered. */
  outbreaks: boolean;
  /** Whether the weather outside makes it hot or cold indoors. */
  weather: boolean;
  /** Whether VIPs and the health inspector call. */
  visits: boolean;
  /** Whether a rival center opens across the street. */
  rival: boolean;
  /** Whether mishaps happen: power cuts, storms, freezes and wasps. */
  mishaps: boolean;
}

/**
 * The sandbox settings last chosen, or the defaults: the sandbox's usual money, unlocking as stars are earned, staff
 * challenges, stress outbreaks, weather, visits, a rival and mishaps.
 */
export function loadSandbox(): SandboxSettings {
  const out: SandboxSettings = {
    money: CENTERS.sandbox.startMoney,
    unlockAll: false,
    challenges: true,
    outbreaks: true,
    weather: true,
    visits: true,
    rival: true,
    mishaps: true,
  };
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(SANDBOX_KEY) ?? '{}');
    if (!isRecord(raw)) return out;
    if (typeof raw.money === 'number' && SANDBOX_MONEY.includes(raw.money)) out.money = raw.money;
    if (typeof raw.unlockAll === 'boolean') out.unlockAll = raw.unlockAll;
    if (typeof raw.challenges === 'boolean') out.challenges = raw.challenges;
    if (typeof raw.outbreaks === 'boolean') out.outbreaks = raw.outbreaks;
    if (typeof raw.weather === 'boolean') out.weather = raw.weather;
    if (typeof raw.visits === 'boolean') out.visits = raw.visits;
    if (typeof raw.rival === 'boolean') out.rival = raw.rival;
    if (typeof raw.mishaps === 'boolean') out.mishaps = raw.mishaps;
  } catch {
    // the defaults will do
  }
  return out;
}

/** Remember the sandbox settings for the next sandbox game. */
export function saveSandbox(settings: SandboxSettings) {
  try {
    localStorage.setItem(SANDBOX_KEY, JSON.stringify(settings));
  } catch {
    // the settings still apply to the game about to start
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
