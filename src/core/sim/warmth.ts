// Temperature: the weather outside, a little of which gets indoors, through the seasons of each center's climate;
// radiators and air conditioners that warm or cool the air around them; and worn equipment, laboring away, giving off
// heat. Guests and staff mind being too cold or too hot, and heat makes everyone thirsty.

import {
  centerOf,
  COLD_STONES,
  COMFORT_BAND,
  DAYS_PER_MONTH,
  DISCOMFORT_NOTICE,
  DISCOMFORT_SPAN,
  HEAT_DAMPING,
  HEAT_EASE,
  HEAT_RADIUS,
  IDEAL_TEMP,
  INDOOR_PULL,
  ITEMS,
  STONE_COOLING,
  THERMOSTAT,
  WEAR_REPAIR,
  WORN_HEAT,
} from '../data';
import type { Climate, ItemType, ThermostatSetting } from '../data/types';
import { calendarDay } from '../format';
import type { Guest, Item } from '../state/types';
import { clamp } from '../util';
import { itemCenter } from '../world';
import type { SimContext } from './context';
import { feel } from './feelings';
import { gridAt, type Spread, spreader } from './spread';

/** The month of the year, with a fraction, when summer is at its hottest and winter at its coldest. */
const MIDSUMMER = 6.5;

/** The day of each year when winter is at its coldest, half a year from the height of summer. */
export const COLDEST_DAY = (MIDSUMMER - 6) * DAYS_PER_MONTH;

/** How far through the year's swing a day is: 1 at the height of summer, -1 in the depths of winter. */
export function seasonal(day: number): number {
  const month = (day / DAYS_PER_MONTH) % 12;
  return Math.cos(((month - MIDSUMMER) / 12) * Math.PI * 2);
}

/** The temperature outside on a day, in a climate. */
export const outdoorTemp = (climate: Climate, day: number) => climate.average + climate.swing * seasonal(day);

/** The temperature indoors with nothing to warm or cool it: some of the way from just right toward the weather. */
export const indoorTemp = (outdoor: number) => IDEAL_TEMP + (outdoor - IDEAL_TEMP) * INDOOR_PULL;

/** The warmth (or, below zero, cool) an item gives off: its own, or a little from equipment wearing out. */
export function itemHeat(it: Item): number {
  const def = ITEMS[it.type];
  // a machine that runs hot warms the room only while someone is inside it
  if (def.machine?.runHeat && it.serving && it.wear < 100) return def.machine.runHeat;
  if (def.heat) return it.wear >= 100 ? 0 : def.heat;
  return def.wear && it.wear >= WEAR_REPAIR && it.wear < 100 ? WORN_HEAT : 0;
}

/** The temperature indoors today with nothing to warm or cool it. */
export const todayIndoors = (ctx: SimContext) => indoorTemp(outdoorTemp(centerOf(ctx.s).climate, calendarDay(ctx.s)));

/**
 * How hard an item with a thermostat works, from 0 (off) to 1 (flat out), for a temperature indoors: at its setting's
 * power, or on Auto as hard as it takes to bring its own spot to just right, and so off while the weather is nice.
 * Anything without a thermostat always works flat out.
 */
export function thermostatShare(type: ItemType, setting: ThermostatSetting | undefined, indoors: number): number {
  const { heat, thermostat } = ITEMS[type];
  if (!thermostat || !heat) return 1;
  return THERMOSTAT[setting ?? 'auto'].share ?? clamp((IDEAL_TEMP - indoors) / heat, 0, 1);
}

/** How much of the warmth or cool outside a room gets through its walls. */
export const heatLeak = () => HEAT_DAMPING;

/**
 * Spread an item's warmth or cool from the middle of it: as far as its own reach and fading gently, for something made
 * to heat or cool a room, or else over a few tiles and fading evenly.
 */
export function spreadHeat(grid: Float32Array, spread: Spread, type: ItemType, cx: number, cy: number, heat: number) {
  const reach = ITEMS[type].heatReach;
  if (reach) spread(grid, cx, cy, heat, reach, 1, HEAT_EASE);
  else spread(grid, cx, cy, heat, HEAT_RADIUS);
}

/** Work out afresh how warm each tile is. With the weather switched off, everywhere is just right. */
export function updateWarmth(ctx: SimContext) {
  const grid = ctx.warmth;
  if (!ctx.s.weatherOn) {
    grid.fill(IDEAL_TEMP);
    return;
  }
  // out of doors, the weather itself; inside, some of the way from just right toward it
  const outdoor = outdoorTemp(centerOf(ctx.s).climate, calendarDay(ctx.s));
  const indoor = indoorTemp(outdoor);
  const { indoors } = ctx.world;
  for (let i = 0; i < grid.length; i++) grid[i] = indoors[i] ? indoor : outdoor;
  const spread = spreader(ctx, heatLeak, HEAT_DAMPING);
  for (const it of ctx.s.items) {
    // a radiator in a power cut or a freeze gives off nothing, and one with a thermostat only what the weather calls for
    const heat = ctx.world.stoppedByMishap(it) ? 0 : itemHeat(it) * thermostatShare(it.type, it.thermostat, indoor);
    if (!heat) continue;
    const [cx, cy] = itemCenter(it);
    spreadHeat(grid, spread, it.type, Math.floor(cx), Math.floor(cy), heat);
  }
}

/** How warm a tile is, in degrees Fahrenheit. */
export const warmthAt = (ctx: SimContext, x: number, y: number) => gridAt(ctx.world, ctx.warmth, x, y, IDEAL_TEMP);

/** How uncomfortable a temperature is, from 0 anywhere near just right to 1 at its worst. */
export const discomfort = (temp: number) => clamp((Math.abs(temp - IDEAL_TEMP) - COMFORT_BAND) / DISCOMFORT_SPAN, 0, 1);

/** How uncomfortably hot it is, from 0 to 1: nothing when it is cold. */
export const hotness = (temp: number) => (temp > IDEAL_TEMP ? discomfort(temp) : 0);

/** How uncomfortably cold it is, from 0 to 1: nothing when it is warm. */
export const coldness = (temp: number) => (temp < IDEAL_TEMP ? discomfort(temp) : 0);

/** How fast a Stone Warmer's stones cool at a temperature: faster the colder the room. */
export const stoneCooling = (temp: number) => STONE_COOLING * (1 + COLD_STONES * coldness(temp));

/** How comfortable a temperature is, as an overlay shows it: 0 freezing, a half just right, 1 sweltering. */
export const tempScale = (temp: number) =>
  temp >= IDEAL_TEMP ? 0.5 + discomfort(temp) / 2 : 0.5 - discomfort(temp) / 2;

/** How a temperature feels, in a word or two. */
export function tempFeel(temp: number): string {
  if (discomfort(temp) < DISCOMFORT_NOTICE) return 'Just right';
  return temp > IDEAL_TEMP ? 'Too hot' : 'Too cold';
}

/** What a guest makes of the temperature where they are, if it is bad enough to notice. */
export function feelTemperature(g: Guest, temp: number) {
  if (discomfort(temp) < DISCOMFORT_NOTICE) return;
  feel(g, temp > IDEAL_TEMP ? 'too-hot' : 'too-cold');
}
