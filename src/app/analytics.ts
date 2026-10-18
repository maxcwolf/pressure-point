// Play statistics from the published game, sent to PostHog: what gets built, how each month ends, how long games last.
// Only the published web game and the installed desktop app send them, only while the player has sharing on, and never
// while a test or a bot is driving the game.
import posthog from 'posthog-js/dist/module.no-external';

import type { Sim } from '../core/sim/sim';
import type { GameState } from '../core/state/types';
import { loadSharing, saveSharing } from '../storage/analytics';
import { automated } from './automation';
import { desktop } from './desktop';
import { environment } from './environment';
import { FrameStats } from './frames';
import {
  feelProps,
  freshFeel,
  gameProps,
  markOf,
  noteFeel,
  type OfferKind,
  playEvents,
  type PlayProps,
} from './play-events';

/** The PostHog project the statistics go to. Like Sentry's DSN, it only says where to send, so it is safe to publish. */
const KEY = 'phc_s6E2BAdNfgpyS5k4K7xWoisrrCtKKQovqxusrWYcjPkr';
/** PostHog's US cloud. A project in the EU cloud sends to https://eu.i.posthog.com, which index.html must allow too. */
const HOST = 'https://us.i.posthog.com';

/** Seconds between looks at the game for something worth counting. */
const LOOK_EVERY = 1;
/** Seconds of play between summaries of the session so far. */
const SUMMARY_EVERY = 300;
/** Seconds before the same refusal is counted again, so a player trying a spot over and over counts once. */
const REFUSED_EVERY = 60;
/** Seconds between sending the frame times gathered, as one histogram. */
const METRICS_EVERY = 60;
/** A gap longer than this between frames is the page put away or the computer asleep, not a frame the player saw. */
const GAP_MS = 2000;
/** Milliseconds after a game opens before its frames count: the first few are spent setting the scene up. */
const WARM_UP_MS = 3000;

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
const platform = desktop ? desktop.platform : 'web';

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
    // frame times, gathered into a histogram and sent once a minute; nothing measured automatically
    metrics: {
      serviceName: 'pressure-point',
      serviceVersion: __APP_VERSION__,
      environment: env,
      flushIntervalMs: METRICS_EVERY * 1000,
    },
  });
  // the environment marks a local build briefly allowed to send while checking the statistics (`preview`), so the
  // project's test account filters can leave it out
  posthog.register({ app_version: __APP_VERSION__, platform, play_id: playId, environment: env });
}

/** Count something that happened in the game, if the player shares statistics. */
export function track(name: string, props: PlayProps = {}, beacon = false) {
  if (!loadSharing()) return;
  if (sends) posthog.capture(name, props, beacon ? { transport: 'sendBeacon' } : undefined);
}

/** The offers the player has answered, so the watcher can tell an offer let lapse from one turned down. */
const answered = new WeakSet();

/** Count the player's answer to an offer, given the offer as it stood before they answered. */
export function answerOffer(s: GameState, offer: object | null, kind: OfferKind, answer: 'accepted' | 'declined') {
  if (offer) answered.add(offer);
  track('offer_answered', { ...gameProps(s), offer: kind, answer });
}

/** When each refusal was last counted. */
const refusedAt = new Map<string, number>();

/**
 * Count something the player tried that the game would not let them do, and why, at most once a minute for each. The
 * reasons are the game's own words: what they are tells where players get stuck.
 */
export function refused(s: GameState, action: string, reason: string) {
  const key = `${action}:${reason}`;
  const now = performance.now();
  const last = refusedAt.get(key);
  if (last !== undefined && now - last < REFUSED_EVERY * 1000) return;
  refusedAt.set(key, now);
  track('action_refused', { ...gameProps(s), action, reason: reason || 'none given' });
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
export function watchGame(sim: Sim) {
  const s = sim.s;
  let mark = markOf(s);
  let feel = freshFeel();
  const startDay = s.day;
  const startedAt = performance.now();
  /** Seconds of play seen at each speed, 0 being paused. A hidden page is not playing, so it is not counted. */
  const atSpeed: Partial<Record<string, number>> = {};
  const frames = watchFrames();
  let peakGuests = s.guests.length;
  let sinceSummary = 0;
  /** The session so far. */
  const summary = (): PlayProps => ({
    ...gameProps(s),
    minutes: Math.round((performance.now() - startedAt) / 60_000),
    days_played: Math.floor(s.day - startDay),
    money: s.money,
    seconds_at_speed: atSpeed,
    ...frames.props(),
    ...device(),
    ...centerSize(s),
    peak_guests: peakGuests,
  });
  setInterval(() => {
    const month = mark.month;
    for (const e of playEvents(mark, s, { answered, month: feelProps(feel) })) track(e.name, e.props);
    mark = markOf(s);
    if (mark.month !== month) feel = freshFeel();
    if (document.visibilityState !== 'visible') return;
    frames.second();
    peakGuests = Math.max(peakGuests, s.guests.length);
    atSpeed[s.speed] = (atSpeed[s.speed] ?? 0) + LOOK_EVERY;
    if (s.speed > 0 && s.open) noteFeel(feel, s, sim.bottleneck()?.key, sim.advice());
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
    if (sends) void posthog.metrics.flush('sendBeacon');
  });
}

/** How big the center is, which is what most of the work of drawing and running it grows with. */
function centerSize(s: GameState): PlayProps {
  return {
    guests: s.guests.length,
    staff: s.staff.filter((x) => x.state !== 'leaving').length,
    items: s.items.length,
    rooms: s.rooms.filter((r) => r.done).length,
  };
}

/**
 * Time every frame drawn while the page is seen, for the session's summaries and, as a histogram by version and
 * platform, for PostHog's metrics. A hidden page draws nothing, so the gap across it is not counted as a frame.
 */
function watchFrames() {
  const stats = new FrameStats();
  const attributes = { app_version: __APP_VERSION__, platform };
  const from = performance.now() + WARM_UP_MS;
  let last: number | undefined;
  /** Time a frame, and ask for the next. */
  const frame = (now: number) => {
    const ms = last === undefined ? undefined : now - last;
    last = now;
    if (ms !== undefined && ms < GAP_MS && now >= from) {
      stats.frame(ms);
      if (sends && loadSharing()) posthog.metrics.histogram('frame.duration', ms, { unit: 'ms', attributes });
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
  document.addEventListener('visibilitychange', () => {
    last = undefined;
  });
  return stats;
}

/** What the game is played on: the screen, the window, how sharp the display is, and the graphics chip. */
function device(): PlayProps {
  return {
    screen: `${screen.width}x${screen.height}`,
    window: `${innerWidth}x${innerHeight}`,
    pixel_ratio: Math.round(devicePixelRatio * 100) / 100,
    gpu: (gpu ??= gpuName()),
  };
}
let gpu: string | undefined;

/** The graphics chip's name, as the browser gives it, from a drawing context made just to ask and then let go. */
function gpuName(): string {
  try {
    const gl = document.createElement('canvas').getContext('webgl');
    if (!gl) return 'none';
    const info = gl.getExtension('WEBGL_debug_renderer_info');
    const name = String(gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return name;
  } catch {
    return 'unknown';
  }
}

/** A random id for one session of play, made the same way in a browser and from the desktop app's file. */
function randomId(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => b.toString(16).padStart(2, '0')).join('');
}
