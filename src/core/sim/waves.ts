// Ailments going around town: a week's warning, then a month of guests who have caught one, on top of the usual. If
// the treatment for it was still waiting on a star, it opens early, with its kit, and stays open. A wave guest the
// center cannot treat yet turns back at the door and comes another time, so letting a wave pass costs nothing.

import {
  centerOf,
  type ConditionId,
  conditionOf,
  DAYS_PER_MONTH,
  DISCIPLINES,
  ITEMS,
  MODALITIES,
  type Modality,
  OUTBREAK_STARS,
  ROLES,
  ROOMS,
  WAVE_AFTER_STAR,
  WAVE_CLEAR_DAYS,
  WAVE_DAYS,
  WAVE_MOVE_DAYS,
  WAVE_MOVES,
  WAVE_SHARE,
  WAVE_SOON_DAYS,
  WAVE_WARNING_DAYS,
  type WaveDef,
  WAVES,
} from '../data';
import { an } from '../format';
import { random } from '../random';
import { featureOn, unlockedUpTo } from '../state/game';
import type { GameState, Wave } from '../state/types';
import type { SimContext } from './context';
import { atWork } from './demand';
import { emit, toast } from './events';
import { hasRoom } from './progress';
import { enabled, equipmentProblem, offered } from './treatments';

/** The wave this center has, if any, and it has not been yet. */
function waveDue(s: GameState): WaveDef | undefined {
  const def = WAVES[s.center];
  if (!def) return undefined;
  /** Whether a wave, under way or past, was this one. */
  const been = (w: Wave | null) => w?.condition === def.condition;
  return been(s.wave) || s.pastWaves.some(been) ? undefined : def;
}

/** The technique that treats an ailment. */
const techniqueFor = (c: ConditionId): Modality => conditionOf(c).modality;

/** Whether a technique was opened early by a wave and its star has not come yet. */
export const openedEarly = (s: GameState, m: Modality): boolean =>
  s.opened.includes(m) && unlockedUpTo(s) < MODALITIES[m].star;

/**
 * Whether the center can treat a technique properly now: its discipline offered, with a finished room; someone on the
 * staff, staying and here, who is qualified in it, not away on a house call or a course; its kit, if it needs any,
 * working beside one of the discipline's tables; and a Recovery Lounge, if its guests need a rest after, since without
 * one it works less often.
 */
export function waveReady(ctx: SimContext, m: Modality): boolean {
  const c = waveChecks(ctx, m);
  return c.room && c.qualified && c.kit && c.rest;
}

/** The next thing getting ready for a technique takes, as an instruction ('' when the center is ready). */
export function waveTodo(ctx: SimContext, m: Modality): string {
  const def = MODALITIES[m];
  const disc = DISCIPLINES[def.discipline];
  const c = waveChecks(ctx, m);
  if (!c.room) return `Build ${an(ROOMS[disc.room].name)}`;
  if (!c.qualified)
    return trainedAway(ctx.s, m)
      ? `Wait for someone trained in ${def.name} to be back`
      : `Train ${an(ROLES[disc.role].name)} in ${def.name}`;
  if (!c.kit && def.equipment)
    return `Put ${an(ITEMS[def.equipment].name)} beside a table in the ${ROOMS[disc.room].name}`;
  if (!c.rest) return `Build a Recovery Lounge for the rest after ${def.name}`;
  return '';
}

/**
 * What getting ready for a technique takes, each part done or not: its room, someone qualified and here, its kit, a
 * rest.
 */
export interface WaveChecks {
  room: boolean;
  qualified: boolean;
  kit: boolean;
  /** Its guests need a rest after, and a Recovery Lounge is built (true when they need none). */
  rest: boolean;
}

/** Whether someone staying is trained in a technique, but away now on a house call or a course. */
export const trainedAway = (s: GameState, m: Modality): boolean =>
  s.staff.some((st) => st.state !== 'leaving' && !atWork(st) && st.quals.includes(m));

/** How ready the center is for a technique, part by part. */
export function waveChecks(ctx: SimContext, m: Modality): WaveChecks {
  const def = MODALITIES[m];
  const kit =
    !def.equipment ||
    ctx.s.items.some((it) => {
      const station = ITEMS[it.type].station;
      return (
        station?.goal === 'treat' &&
        station.discipline === def.discipline &&
        !ITEMS[it.type].machine &&
        equipmentProblem(ctx, it, def) === ''
      );
    });
  return {
    room: offered(ctx, def.discipline),
    qualified: ctx.s.staff.some((st) => atWork(st) && st.quals.includes(m)),
    kit,
    rest: !def.rest || hasRoom(ctx, 'recovery'),
  };
}

/** Whether a wave's guests are coming now. */
export const waveRunning = (s: GameState): boolean =>
  !!s.wave && featureOn(s, 'waves') && s.day >= s.wave.starts && s.day < s.wave.ends;

/** How many guests a wave brings a week, at a pace of `tables` usual guests a month, for the dialog to say. */
export const wavePerWeek = (tables: number): number => (tables * WAVE_SHARE * 7) / DAYS_PER_MONTH;

/** A wave's guests a month, on top of the usual guests come for the tables, while it runs; none otherwise. */
export const waveGuests = (s: GameState, tables: number): number => (waveRunning(s) ? tables * WAVE_SHARE : 0);

/** The days from `day` that a wave due then would keep clear: its warning week and its first week. */
const within = (day: number, at: number) => at >= day && at < day + WAVE_CLEAR_DAYS;

/**
 * Something already under way or due in the days a wave announced today would keep clear, which asks the player for a
 * decision of its own: an emergency, a stress outbreak, a mishap or the inspector. '' if none.
 */
export function waveClash(s: GameState): string {
  const day = s.day;
  if (s.offer || s.emergency || (s.stars >= 1 && within(day, s.nextEmergency))) return 'emergency';
  if (s.outbreaksOn && (s.outbreakOffer || s.outbreak || (s.stars >= OUTBREAK_STARS && within(day, s.nextOutbreak))))
    return 'outbreak';
  if (s.mishapsOn && (s.mishap || (centerOf(s).mishap && within(day, s.nextMishap)))) return 'mishap';
  if (s.visitsOn && (s.visitNotice?.visit === 'inspector' || within(day, s.nextInspection))) return 'inspector';
  return '';
}

/**
 * Set the wave a star brings: due a while after it, so its guests start coming `WAVE_AFTER_STAR` days on. None with
 * the feature off: switched on later, `wavesSwitched` brings it within the week.
 */
export function scheduleWave(ctx: SimContext) {
  const s = ctx.s;
  if (!featureOn(s, 'waves')) return;
  const def = waveDue(s);
  if (def?.afterStar !== s.stars) return;
  s.nextWave = { day: s.day + WAVE_AFTER_STAR - WAVE_WARNING_DAYS, moves: 0 };
}

/** The PA line that warns of a wave: what is going around, and what to do about it. */
export function waveWarning(c: ConditionId): string {
  const m = MODALITIES[techniqueFor(c)];
  const role = ROLES[DISCIPLINES[m.discipline].role].name;
  return `${conditionOf(c).name} is going around. ${m.name} is open; train ${an(role)} now.`;
}

/** The PA line as a wave's guests start to come: where they go, or that they will come back later. */
export function waveStarting(ctx: SimContext, c: ConditionId): string {
  const m = MODALITIES[techniqueFor(c)];
  const name = conditionOf(c).name;
  if (waveReady(ctx, m.id))
    return `Guests with ${name} arrive from today. ${m.name} is in the ${ROOMS[DISCIPLINES[m.discipline].room].name}.`;
  return `Guests with ${name} will come back later, once we are ready for them.`;
}

/** Announce a wave today: it opens its technique if that was waiting on a star, and its guests come in a week. */
export function announceWave(ctx: SimContext, def: WaveDef) {
  const s = ctx.s;
  const m = techniqueFor(def.condition);
  const opened = unlockedUpTo(s) < MODALITIES[m].star && !s.opened.includes(m);
  if (opened) s.opened.push(m);
  s.wave = {
    condition: def.condition,
    warned: s.day,
    starts: s.day + WAVE_WARNING_DAYS,
    ends: s.day + WAVE_WARNING_DAYS + WAVE_DAYS,
    opened,
    begun: false,
    came: 0,
    healed: 0,
    turned: 0,
  };
  s.nextWave = null;
  emit(ctx, { type: 'wave' });
  emit(ctx, { type: 'announce', text: waveWarning(def.condition) });
}

/** A wave's month is over: say how it went, and keep it with the ones that have been. */
export function endWave(ctx: SimContext, quietly = false) {
  const s = ctx.s;
  const w = s.wave;
  if (!w) return;
  s.wave = null;
  s.pastWaves.push(w);
  if (quietly) return;
  const name = conditionOf(w.condition).name;
  const later = w.turned ? `, ${w.turned} came back later` : '';
  toast(ctx, `${name} is no longer going around: ${w.healed} healed${later}.`, 'info', undefined, 'bubble-sick');
}

/**
 * Once a second: announce a wave when it is due, unless something else that asks for a decision is due in the same
 * fortnight, in which case it moves on a week, a few times at most; start its guests coming on its day; end it.
 */
export function updateWaves(ctx: SimContext) {
  const s = ctx.s;
  if (!featureOn(s, 'waves')) return;
  const w = s.wave;
  if (w) {
    if (s.day >= w.ends) endWave(ctx);
    else if (!w.begun && s.day >= w.starts) {
      w.begun = true;
      emit(ctx, { type: 'announce', text: waveStarting(ctx, w.condition) });
    }
    return;
  }
  const next = s.nextWave;
  if (!next || s.day < next.day) return;
  const def = waveDue(s);
  // its star has passed, or its discipline is switched off: the wave has nothing to open, and does not come
  if (def?.afterStar !== s.stars || !enabled(ctx, MODALITIES[techniqueFor(def.condition)].discipline)) {
    s.nextWave = null;
    return;
  }
  if (next.moves < WAVE_MOVES && waveClash(s)) {
    s.nextWave = { day: s.day + WAVE_MOVE_DAYS, moves: next.moves + 1 };
    return;
  }
  announceWave(ctx, def);
}

/**
 * Whether the guest arriving now comes with the ailment going around: by its share of the pace, rolled only while a
 * wave brings guests, so a game without one rolls as it always has. One the center cannot treat yet turns back at
 * the door, uncounted: 'turned'. Undefined for anyone else.
 */
export function waveArrival(ctx: SimContext, wave: number, perMonth: number): ConditionId | 'turned' | undefined {
  const s = ctx.s;
  if (wave <= 0 || !s.wave) return undefined;
  if (random(s) * perMonth >= wave) return undefined;
  const c = s.wave.condition;
  if (waveReady(ctx, techniqueFor(c))) return c;
  s.wave.turned++;
  const door = ctx.world.building.entrances[0];
  if (door) emit(ctx, { type: 'float', text: `${conditionOf(c).name}: next time`, x: door.x, y: door.y, kind: 'info' });
  return 'turned';
}

/**
 * The feature switched on or off part way through a game. Off, a wave on its way or under way ends quietly, not as one
 * that has been but as one due again from the day it was announced; what it opened stays open. On, a center whose
 * wave is due after the star it has comes within the week: on its day if that is sooner, or in a week if that day has
 * gone by while it was off, so its warning still comes ahead of its guests rather than the moment the switch is on.
 */
export function wavesSwitched(ctx: SimContext, on: boolean) {
  const s = ctx.s;
  if (!on) {
    const w = s.wave;
    if (!w) return;
    s.wave = null;
    s.nextWave = { day: w.warned, moves: 0 };
    return;
  }
  const def = waveDue(s);
  if (!def || s.wave || s.stars !== def.afterStar) return;
  const soon = s.day + WAVE_SOON_DAYS;
  const day = s.nextWave?.day;
  if (day === undefined || day > soon || day <= s.day) s.nextWave = { day: soon, moves: 0 };
}

/** Announce the wave now, skipping its clock: the cheat console's `wave`. Its ailment, or undefined if none is to come. */
export function forceWave(ctx: SimContext): ConditionId | undefined {
  const def = waveDue(ctx.s);
  if (!def || ctx.s.wave) return undefined;
  announceWave(ctx, def);
  return def.condition;
}
