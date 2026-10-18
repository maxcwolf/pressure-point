// Play statistics from the published game, sent to PostHog: what gets built, how each month ends, how long games last.
// Only the published web game and the installed desktop app send them, only while the player has sharing on, and never
// while a test or a bot is driving the game.
import posthog from 'posthog-js/dist/module.no-external';

import type { GameState } from '../core/state/types';
import { loadSharing, saveSharing } from '../storage/analytics';
import { automated } from './automation';
import { desktop } from './desktop';
import { environment } from './environment';
import { gameProps, markOf, playEvents, type PlayProps } from './play-events';

/** The PostHog project the statistics go to. Like Sentry's DSN, it only says where to send, so it is safe to publish. */
const KEY = 'phc_s6E2BAdNfgpyS5k4K7xWoisrrCtKKQovqxusrWYcjPkr';
/** PostHog's US cloud. A project in the EU cloud sends to https://eu.i.posthog.com, which index.html must allow too. */
const HOST = 'https://us.i.posthog.com';

/** Seconds between looks at the game for something worth counting. */
const LOOK_EVERY = 1;
/** Seconds of play between summaries of the session so far. */
const SUMMARY_EVERY = 300;

const env = environment();
/**
 * Which session of play an event is from. Leaving a game reloads the page, so a page is one game, from opening it to
 * leaving it.
 */
const playId = randomId();
/**
 * Whether this copy sends statistics: the published web game and the installed desktop app, played by a person. A test
 * or a bot driving even a published copy sends nothing.
 */
const sends = (env === 'production' || env === 'desktop') && !automated(navigator);

if (sends) {
  posthog.init(KEY, {
    api_host: HOST,
    // the desktop app loads the game from a file, where cookies do not work
    persistence: 'localStorage',
    // players are counted by a random id, with no profile kept for any of them
    person_profiles: 'never',
    // only the events the game sends: no clicks, page views, recordings, surveys or scripts from elsewhere
    autocapture: false,
    capture_pageview: false,
    capture_pageleave: false,
    rageclick: false,
    capture_dead_clicks: false,
    capture_heatmaps: false,
    capture_exceptions: false,
    capture_performance: false,
    disable_session_recording: true,
    disable_surveys: true,
    disable_product_tours: true,
    disable_conversations: true,
    disable_web_experiments: true,
    disable_external_dependency_loading: true,
    advanced_disable_flags: true,
    opt_out_capturing_by_default: !loadSharing(),
  });
  posthog.register({ app_version: __APP_VERSION__, platform: desktop ? desktop.platform : 'web', play_id: playId });
}

/** Count something that happened in the game, if the player shares statistics. */
export function track(name: string, props: PlayProps = {}, beacon = false) {
  if (!loadSharing()) return;
  if (sends) posthog.capture(name, props, beacon ? { transport: 'sendBeacon' } : undefined);
}

/** Whether play statistics are shared. */
export const sharing = loadSharing;

/** Start or stop sharing play statistics, for this game and every one after. */
export function setSharing(on: boolean) {
  saveSharing(on);
  if (!sends) return;
  if (on) posthog.opt_in_capturing();
  else posthog.opt_out_capturing();
}

/**
 * Count the moments in a game as they happen, and sum up the session so far: every few minutes of play, whenever the
 * page is hidden, and as it is left. A page can close without its last event getting out (a desktop app quitting, a
 * phone closing a hidden tab), so each summary carries the whole session so far, and the latest for a `play_id` is
 * the one to read.
 */
export function watchGame(s: GameState) {
  let mark = markOf(s);
  const startDay = s.day;
  const startedAt = performance.now();
  /** Seconds of play seen at each speed, 0 being paused. A hidden page is not playing, so it is not counted. */
  const atSpeed: Partial<Record<string, number>> = {};
  let sinceSummary = 0;
  /** The session so far. */
  const summary = (): PlayProps => ({
    ...gameProps(s),
    minutes: Math.round((performance.now() - startedAt) / 60_000),
    days_played: Math.floor(s.day - startDay),
    money: s.money,
    seconds_at_speed: atSpeed,
  });
  setInterval(() => {
    for (const e of playEvents(mark, s)) track(e.name, e.props);
    mark = markOf(s);
    if (document.visibilityState !== 'visible') return;
    atSpeed[s.speed] = (atSpeed[s.speed] ?? 0) + LOOK_EVERY;
    sinceSummary += LOOK_EVERY;
    if (sinceSummary >= SUMMARY_EVERY) {
      sinceSummary = 0;
      track('play_summary', summary());
    }
  }, LOOK_EVERY * 1000);
  // a beacon still goes out as the page is hidden or closes
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') track('play_summary', summary(), true);
  });
  window.addEventListener('pagehide', () => {
    track('game_left', summary(), true);
  });
}

/** A random id for one session of play, made the same way in a browser and from the desktop app's file. */
function randomId(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => b.toString(16).padStart(2, '0')).join('');
}
