// What an item does, as the Items menu shows it before it is bought, and what one in hand would change where it is
// about to go.

import { HEAT_RADIUS, ITEMS, type ItemType, MODALITIES, NOISE_NOTICE, ROOMS, SEAT_DRAIN } from '../../core/data';
import { money } from '../../core/format';
import { decorReach } from '../../core/sim/ambience';
import { calmness } from '../../core/sim/noise';
import type { PlacePreview } from '../../core/sim/preview';
import type { Sim } from '../../core/sim/sim';
import { discomfort, tempFeel } from '../../core/sim/warmth';
import type { ItemView } from '../../storage/display';
import { pleasantness } from './overlays';

/** What each item view is called in the settings. */
export const ITEM_VIEW_NAMES: Readonly<Record<ItemView, string>> = {
  tooltip: 'In the tooltip',
  detail: 'In a side panel',
  chips: 'On the cards',
};

/** What a stat is about, which also sets its color. */
export type StatTone = 'decor' | 'calm' | 'loud' | 'warm' | 'cool' | 'earn' | 'seat' | 'upkeep' | 'plain';

/** One thing an item does, in a word or two for a card and in a sentence for a tooltip. */
export interface ItemStat {
  id:
    | 'decor'
    | 'noise'
    | 'session'
    | 'heat'
    | 'sale'
    | 'seat'
    | 'treatment'
    | 'machine'
    | 'running'
    | 'upgrade'
    | 'wear'
    | 'overload'
    | 'dirt'
    | 'size';
  icon: string;
  short: string;
  long: string;
  tone: StatTone;
}

const defs = Object.values(ITEMS);
/** The most decor any item has, which fills a decor scale. */
export const DECOR_MOST = Math.max(...defs.map((d) => d.decor ?? 0));
/** The most noise any item makes or soothes, which fills a noise scale either way. */
export const NOISE_MOST = Math.max(...defs.map((d) => Math.abs(d.noise ?? 0)));
/** The most any item warms or cools, which fills a warmth scale either way. */
export const HEAT_MOST = Math.max(...defs.map((d) => Math.abs(d.heat ?? 0)));

/** A number to one decimal place, without a trailing .0. */
const tenths = (n: number) => String(Math.round(n * 10) / 10);

/** What an item does, in the order a player weighs it: how nice, how loud, how warm, what it earns, what it needs. */
export function itemStats(type: ItemType): ItemStat[] {
  const def = ITEMS[type];
  const out: ItemStat[] = [];
  if (def.decor)
    out.push({
      id: 'decor',
      icon: '✨',
      short: `Decor +${def.decor}`,
      long: `Decor +${def.decor}: makes everywhere within ${decorReach(type)} tiles nicer`,
      tone: 'decor',
    });
  if (def.noise && def.noise < 0)
    out.push({
      id: 'noise',
      icon: '🤫',
      short: `Soothes ${-def.noise}`,
      long: `Soothes the noise around it by ${-def.noise}`,
      tone: 'calm',
    });
  if (def.noise && def.noise > 0)
    out.push({
      id: 'noise',
      icon: '🔊',
      short: `Noise ${def.noise}`,
      long: `Noise ${def.noise}: carries, and spoils treatments nearby`,
      tone: 'loud',
    });
  if (def.sessionNoise)
    out.push({
      id: 'session',
      icon: '🔊',
      short: 'Loud in sessions',
      long: `Noise ${def.sessionNoise} while a session plays, heard outside its room`,
      tone: 'loud',
    });
  if (def.heat)
    out.push({
      id: 'heat',
      icon: '🌡️',
      short: def.heat > 0 ? `Warms ${def.heat}°` : `Cools ${-def.heat}°`,
      long: `${def.heat > 0 ? 'Warms' : 'Cools'} the air by up to ${Math.abs(def.heat)}°F, within ${def.heatReach ?? HEAT_RADIUS} tiles${def.thermostat ? `, only while it is too ${def.heat > 0 ? 'cool' : 'warm'} indoors` : ''}`,
      tone: def.heat > 0 ? 'warm' : 'cool',
    });
  if (def.sale)
    out.push({
      id: 'sale',
      icon: '💵',
      short: `${money(def.sale)} a use`,
      long: `Earns ${money(def.sale)} each time a guest uses it`,
      tone: 'earn',
    });
  if (def.access.some((a) => a.role === 'seat')) {
    const times = tenths(1 / (def.seatDrain ?? SEAT_DRAIN));
    out.push({
      id: 'seat',
      icon: '⏳',
      short: `Patience ×${times}`,
      long: `Guests waiting in it lose patience ${times}× slower than standing`,
      tone: 'seat',
    });
  }
  for (const m of Object.values(MODALITIES))
    if (m.equipment === type)
      out.push({
        id: 'treatment',
        icon: m.icon,
        short: m.name,
        long: `Needed for ${m.name} in its room`,
        tone: 'plain',
      });
  out.push(...machineStats(type));
  if (def.upgrade !== undefined)
    out.push({
      id: 'upgrade',
      icon: '⬆️',
      short: 'Upgradable',
      long: 'A Caretaker with the Mechanics course can upgrade it',
      tone: 'plain',
    });
  if (def.wear) {
    const uses = Math.round(100 / def.wear);
    out.push({
      id: 'wear',
      icon: '🔧',
      short: `Breaks in ~${uses}`,
      long: `Breaks after about ${uses} uses until a Caretaker repairs it`,
      tone: 'upkeep',
    });
  }
  if (def.dirt)
    out.push(
      def.linens
        ? {
            id: 'dirt',
            icon: '🧺',
            short: 'Linens',
            long: 'Its linens need changing from a Linen Hamper',
            tone: 'upkeep',
          }
        : {
            id: 'dirt',
            icon: '🧽',
            short: 'Gets dirty',
            long: 'Gets dirty with use until a Caretaker cleans it',
            tone: 'upkeep',
          },
    );
  if (def.mount === 'wall' ? def.w > 1 : def.w * def.h > 1)
    out.push({
      id: 'size',
      icon: '📐',
      short: def.mount === 'wall' ? `${def.w} wide` : `${def.w}×${def.h}`,
      long: def.mount === 'wall' ? `Hangs ${def.w} tiles wide` : `Takes up ${def.w} × ${def.h} tiles`,
      tone: 'plain',
    });
  return out;
}

/** A share above or below one, as a percentage faster, slower, likelier and so on. */
const percent = (times: number) => `${Math.round(Math.abs(1 - times) * 100)}%`;

/** What a treatment machine does that a table does not: what it does and how, what it costs to run, and how it fails. */
function machineStats(type: ItemType): ItemStat[] {
  const machine = ITEMS[type].machine;
  if (!machine) return [];
  const out: ItemStat[] = [];
  const names = machine.performs.map((m) => MODALITIES[m].name).join(' and ');
  const how: string[] = [];
  if (machine.seconds && machine.seconds !== 1)
    how.push(`sessions ${percent(machine.seconds)} ${machine.seconds < 1 ? 'quicker' : 'longer'}`);
  if (machine.success) how.push(`${Math.round(machine.success * 100)}% likelier to work`);
  if (machine.setting) how.push('every trip in its room has a perfect set and setting');
  if (machine.boosts) how.push(`every session in its room ${percent(machine.boosts.seconds)} quicker`);
  if (machine.beside) how.push(`better beside a ${ROOMS[machine.beside.room].name}`);
  const own = MODALITIES[machine.performs[0] ?? 'swedish'].machine === type;
  out.push({
    id: 'machine',
    icon: '⚙️',
    short: own ? names : machine.boosts || machine.setting ? 'Helps its room' : `Does ${names}`,
    long: own
      ? `The only cure for what ${names} treats, worked by a trained operator${how.length ? `: ${how.join(', ')}` : ''}`
      : `${machine.boosts || machine.setting ? 'Helps' : `Does ${names} in place of a table`}${how.length ? `: ${how.join(', ')}` : ''}`,
    tone: 'plain',
  });
  out.push({
    id: 'machine',
    icon: '🔌',
    short: `${money(machine.upkeep)} a month`,
    long: `Costs ${money(machine.upkeep)} a month to keep running, paid with the wages`,
    tone: 'upkeep',
  });
  if (machine.runNoise || machine.runHeat)
    out.push({
      id: 'running',
      icon: machine.runNoise ? '🔊' : '🌡️',
      short: machine.runNoise ? 'Loud running' : 'Hot running',
      long: machine.runNoise
        ? `Noise ${machine.runNoise} while it runs, heard all through the building`
        : `Warms the room by ${machine.runHeat ?? 0}°F while it runs`,
      tone: machine.runNoise ? 'loud' : 'warm',
    });
  if (machine.overload)
    out.push({
      id: 'overload',
      icon: '💨',
      short: 'Can overload',
      long: `Smokes once ${machine.overload.from}% worn, and may then overload: out of action until a Caretaker sees to it, and ${money(machine.overload.bill)} for parts`,
      tone: 'upkeep',
    });
  return out;
}

/** An item's stats in words, for a tooltip's plain text and for a screen reader. Empty if it has none to tell. */
export function statsText(type: ItemType): string {
  const stats = itemStats(type);
  return stats.length ? `${ITEMS[type].name}: ${stats.map((s) => s.long).join('. ')}.` : '';
}

/** Something an item in hand would change: better, worse, or just so. */
export interface PlaceEffect {
  icon: string;
  text: string;
  tone: 'good' | 'bad' | 'plain';
}

/** A share as a whole percentage. */
const pct = (v: number) => `${Math.round(v * 100)}%`;
/** Whether a change is for the better, the worse, or neither. */
const toneOf = (better: boolean, worse: boolean): PlaceEffect['tone'] => (better ? 'good' : worse ? 'bad' : 'plain');
/** "1 treatment table", or "3 treatment tables". */
const tables = (n: number) => `${n} treatment table${n === 1 ? '' : 's'}`;

/** What an item in hand would change where it is about to go, for the hint. */
export function placeEffects(sim: Sim, p: PlacePreview): PlaceEffect[] {
  const { x, y } = p;
  const i = sim.world.idx(x, y);
  const out: PlaceEffect[] = [];
  if (p.decor) {
    const now = pleasantness(sim.drainFactor(x, y));
    const then = pleasantness(sim.drainFactor(x, y, p.decor[i] ?? 0));
    out.push({
      icon: '🌿',
      text: `Surroundings here ${pct(now)} → ${pct(then)}`,
      tone: toneOf(then > now, then < now),
    });
  }
  const room = p.room && sim.world.room(p.room.id);
  if (p.room && room) {
    const { before, after } = p.room;
    out.push({
      icon: '👑',
      text: `${ROOMS[room.type].name} prestige ${before} → ${after}`,
      tone: toneOf(after > before, after < before),
    });
  }
  if (p.noise) {
    const now = calmness(sim.noiseAt(x, y));
    const then = calmness(sim.noiseAt(x, y, p.noise[i] ?? 0));
    out.push({ icon: '🤫', text: `Calm here ${pct(now)} → ${pct(then)}`, tone: toneOf(then > now, then < now) });
  } else if (ITEMS[p.placed.type].station?.goal === 'treat') {
    // a table minds the noise where it goes, though it makes none
    const noise = sim.noiseAt(x, y);
    out.push({ icon: '🤫', text: `Calm here ${pct(calmness(noise))}`, tone: noise >= NOISE_NOTICE ? 'bad' : 'good' });
  }
  if (p.noisier) out.push({ icon: '🔊', text: `Noisier at ${tables(p.noisier)}`, tone: 'bad' });
  if (p.calmer) out.push({ icon: '🤫', text: `Calmer at ${tables(p.calmer)}`, tone: 'good' });
  if (p.resting) out.push({ icon: '💤', text: 'Off for now: the weather is nice', tone: 'plain' });
  if (p.heat) {
    const now = sim.warmthAt(x, y);
    const then = sim.warmthAt(x, y, p.heat[i] ?? 0);
    out.push({
      icon: '🌡️',
      text: `${Math.round(now)}°F → ${Math.round(then)}°F here, ${tempFeel(then).toLowerCase()}`,
      // worse only once it is too hot or too cold to be just right
      tone: toneOf(
        discomfort(then) < discomfort(now),
        discomfort(then) > discomfort(now) && tempFeel(then) !== 'Just right',
      ),
    });
  }
  return out;
}
