// Player preferences that outlive any one game: which optional disciplines, and whether Qi Gong classes, new games start with,
// how a sandbox game is set up, its difficulty among the rest, the Stats menu's charts, the sound and music switches,
// and whether a new Willow Lane game has the tutorial and the campaign's games the cards that explain things.
import { CENTERS, type Difficulty, DISCIPLINE_ORDER, DISCIPLINES, type Offering, SANDBOX_MONEY } from '../core/data';
import { readDifficulty } from '../core/difficulty';
import { loadCampaign } from './campaign';
import { isRecord } from './json';

const KEY = 'pressure-point-settings';
export type DisciplinePrefs = Partial<Record<Offering, boolean>>;

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
    if (typeof saved.qigong === 'boolean') out.qigong = saved.qigong;
    return out;
  } catch {
    return {};
  }
}

/** Remember whether new games start with a discipline, or the Qi Gong classes, switched on. */
export function saveDisciplinePref(d: Offering, on: boolean) {
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
  /** Whether a machine smoking with wear can catch fire when it overloads. */
  fires: boolean;
  /** Whether wages the bank cannot cover end the game. */
  bankruptcy: boolean;
  /** How hard the game is, setting by setting. One left out is as usual. */
  difficulty: Difficulty;
}

/**
 * The sandbox settings last chosen, or the defaults: the sandbox's usual money, unlocking as stars are earned, staff
 * challenges, stress outbreaks, weather, visits, a rival, mishaps, fires and bankruptcy, at the Standard difficulty.
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
    fires: true,
    bankruptcy: true,
    difficulty: {},
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
    if (typeof raw.fires === 'boolean') out.fires = raw.fires;
    if (typeof raw.bankruptcy === 'boolean') out.bankruptcy = raw.bankruptcy;
    out.difficulty = readDifficulty(raw.difficulty);
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

// the key the sound and music switches have always been kept under, so a player's choice carries over as it is
const AUDIO_KEY = 'pressure-point-audio';

/** Whether sound effects and music play. */
export interface AudioPrefs {
  sound: boolean;
  music: boolean;
}

/** The sound and music switches as last set, or both on. */
export function loadAudio(): AudioPrefs {
  const out: AudioPrefs = { sound: true, music: true };
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(AUDIO_KEY) ?? '{}');
    if (isRecord(raw)) {
      if (typeof raw.sound === 'boolean') out.sound = raw.sound;
      if (typeof raw.music === 'boolean') out.music = raw.music;
    }
  } catch {
    // both on will do
  }
  return out;
}

/** Remember the sound and music switches, for this game and the next. */
export function saveAudio(prefs: AudioPrefs) {
  try {
    localStorage.setItem(AUDIO_KEY, JSON.stringify({ sound: prefs.sound, music: prefs.music }));
  } catch {
    // the switches still apply until the page closes
  }
}

/**
 * The tutorial's one setting: 'on' and 'off' as the player set the switch, for the walk-through and the cards
 * together, or 'done' once they have been through the walk-through, which leaves the cards on. Unset, it is as a new
 * player starts.
 */
const TUTORIAL_KEY = 'pressure-point-tutorial';

/** The tutorial's setting as stored, or null if unset or out of reach. */
function tutorialSetting(): string | null {
  try {
    return localStorage.getItem(TUTORIAL_KEY);
  } catch {
    return null;
  }
}

/**
 * Whether a new Willow Lane game walks through its opening with the tutorial: as the player last set it, not again
 * once they have been through it, and until either, only while the campaign has no stars yet, so a player who has
 * played before is not walked through again.
 */
export function loadTutorialPref(): boolean {
  const set = tutorialSetting();
  if (set === 'on') return true;
  if (set === 'off' || set === 'done') return false;
  return !Object.keys(loadCampaign().stars).length;
}

/** Whether a new campaign game explains each thing the first time it happens: unless the player switched it off. */
export const loadLessonsPref = () => tutorialSetting() !== 'off';

/** Remember the player's switch for the tutorial, the walk-through and the cards together, or a skip turning it off. */
export function saveTutorialPref(on: boolean) {
  try {
    localStorage.setItem(TUTORIAL_KEY, on ? 'on' : 'off');
  } catch {
    // the switch still applies to the game in progress
  }
}

/** Remember that the walk-through is over, so the next Willow Lane game starts without it, the cards carrying on. */
export function noteTutorialDone() {
  try {
    localStorage.setItem(TUTORIAL_KEY, 'done');
  } catch {
    // the next Willow Lane game is walked through again, which does no harm
  }
}
