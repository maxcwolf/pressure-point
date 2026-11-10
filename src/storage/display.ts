// How the game shows things, kept for every game on this computer: where the Items menu shows what each item does,
// whether an item in hand shows what it would change where it is about to go, how long messages stay, how big the
// in-game interface is drawn, and how dressed the scene is, which is the computer's to keep up with.
import { isRecord } from './json';

/** Where the Items menu shows an item's stats: in its tooltip, in a panel beside the cards, or on the cards. */
export type ItemView = 'tooltip' | 'detail' | 'chips';

/** Every item view, in the order the setting steps through them. */
export const ITEM_VIEWS: readonly ItemView[] = ['tooltip', 'detail', 'chips'];

/** How long the messages on the right stay: long enough to read, twice that, or until dismissed. */
export type MessageTime = 'normal' | 'long' | 'dismissed';

/** Every message time, in the order the setting steps through them. */
export const MESSAGE_TIMES: readonly MessageTime[] = ['normal', 'long', 'dismissed'];

/** The sizes the interface can be drawn at, as a share of its usual size, in the order the setting steps through them. */
export const UI_SCALES: readonly number[] = [1, 1.15, 1.3, 1.5, 0.9];

/**
 * How dressed the scene is drawn: Full, with soft shade, swaying trees, wildlife, glowing lamps and small moments, or
 * Plain, as the game was drawn before them, for a slower computer.
 */
export type Graphics = 'full' | 'plain';

/** Every graphics setting, in the order the setting steps through them. */
export const GRAPHICS: readonly Graphics[] = ['full', 'plain'];

export interface DisplayPrefs {
  itemView: ItemView;
  /** Whether an item in hand shows what it would change, in the hint and by coloring the floor. */
  placePreview: boolean;
  messages: MessageTime;
  /** How big the in-game interface is drawn, as a share of its usual size: bigger for a large screen far away. */
  uiScale: number;
  graphics: Graphics;
}

/**
 * What a new player starts with: stats in the tooltip, the preview while placing on, messages for as long as they take
 * to read, the interface at its usual size and the scene drawn Full.
 */
export const defaultDisplay = (): DisplayPrefs => ({
  itemView: 'tooltip',
  placePreview: true,
  messages: 'normal',
  uiScale: 1,
  graphics: 'full',
});

/** Display settings read back from storage, with anything missing or unusable left at its default. */
export function readDisplay(raw: unknown): DisplayPrefs {
  const out = defaultDisplay();
  if (!isRecord(raw)) return out;
  const view = ITEM_VIEWS.find((v) => v === raw.itemView);
  if (view) out.itemView = view;
  if (typeof raw.placePreview === 'boolean') out.placePreview = raw.placePreview;
  const messages = MESSAGE_TIMES.find((m) => m === raw.messages);
  if (messages) out.messages = messages;
  if (typeof raw.uiScale === 'number' && UI_SCALES.includes(raw.uiScale)) out.uiScale = raw.uiScale;
  const graphics = GRAPHICS.find((g) => g === raw.graphics);
  if (graphics) out.graphics = graphics;
  return out;
}

const KEY = 'pressure-point-display';
/** The settings in use, read from storage once and kept up to date as they change. */
let current: DisplayPrefs | null = null;

/** The display settings in use. Cheap to call on every redraw. */
export function loadDisplay(): DisplayPrefs {
  if (current) return current;
  try {
    current = readDisplay(JSON.parse(localStorage.getItem(KEY) ?? '{}'));
  } catch {
    current = defaultDisplay();
  }
  return current;
}

/** Change the display settings, for this game and the next. */
export function saveDisplay(prefs: DisplayPrefs) {
  current = prefs;
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {
    // the settings still apply until the page closes
  }
}

/** Forget the settings read in, so the next load reads storage again. For tests. */
export function forgetDisplay() {
  current = null;
}
