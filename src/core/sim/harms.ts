// Harm that keeps coming to guests: a failed treatment, a guest fed up with waiting, one who got worse in a line or
// balked at the price. Each is counted by what it was and why, and once the same has happened a few times, what is
// behind it in this game and what helps is put on a card that stays until it is read.

import {
  conditionOf,
  DAY_SECONDS,
  DISCIPLINES,
  DISCOMFORT_DRAIN,
  GUESS_PENALTY,
  IDEAL_TEMP,
  ITEMS,
  MODALITIES,
  type ModalityDef,
  modalityLabel,
  ROLES,
  ROOMS,
  SEAT_DRAIN,
  SEND_HOME_REP,
  SETTING_WEIGHT,
  STRESS_DRAIN,
  TRIP_DISCOMFORT,
  WORSE_REP,
} from '../data';
import { an } from '../format';
import type { Guest, HarmNote, Item, Staff } from '../state/types';
import { stationPlace } from './advisor';
import { drainFactor } from './ambience';
import { rankName } from './careers';
import { isTrip } from './ceremonies';
import type { SimContext } from './context';
import { priceFor, putOffChance } from './economy';
import { hamperWithRoom, linensPenalty } from './linens';
import { perfectSetting, treatsHere } from './machines';
import { itemNoise, noisePenalty } from './noise';
import { hasItem, hasRoom, hasStaff } from './progress';
import { restPenalty } from './recovery';
import { type DeliveryProblem, modalityOf } from './treatments';
import { canSmudge, vibesAt, vibesPenalty } from './vibes';
import { discomfort, warmthAt } from './warmth';
import { conditionPenalty, type LineKey, lineOf, worsening } from './worsening';

/** How many times the same harm, for the same reason, comes before it is explained. */
export const HARM_EXPLAIN = 3;

/**
 * Count a harm by what it was and why, and the time it reaches HARM_EXPLAIN, put its explanation on the card. Each is
 * explained once a game; `explain` is only asked for then.
 */
export function noteHarm(ctx: SimContext, key: string, explain: () => Omit<HarmNote, 'key'>) {
  const s = ctx.s;
  const n = (s.harms[key] = (s.harms[key] ?? 0) + 1);
  if (n === HARM_EXPLAIN) s.harmNotes.push({ key, ...explain() });
}

/** A share of a chance or a rate as a whole percentage: "15%". */
const pct = (x: number) => `${Math.round(x * 100)}%`;

/** Something that took off a treatment's chance of working, the thing to say about it, and the fix. */
interface Cost {
  cause: string;
  label: string;
  /** What it took off the chance, 0 to 1. */
  amount: number;
}

/** Below this, something that took off a treatment's chance is too small to name as the reason it failed. */
const NAMED_COST = 0.05;
/** Below this, it is too small to list at all. */
const LISTED_COST = 0.02;

/**
 * What took off a treatment's chance of working, biggest first: what was wrong with the room, the staff and the guest,
 * reckoned as the chance of success does, and the shortfall against an Expert's hands and a certain diagnosis.
 */
export function failureCosts(ctx: SimContext, it: Item, staff: Staff, g: Guest): Cost[] {
  const mod = MODALITIES[conditionOf(g.condition).modality];
  const room = ctx.world.roomOfItem(it);
  const roomName = room ? ROOMS[room.type].name : ITEMS[it.type].name;
  // a ceremony counts the room twice over, unless a machine there makes the setting perfect
  const weight = isTrip(mod) && !perfectSetting(ctx, it) ? SETTING_WEIGHT : 1;
  const temp = warmthAt(ctx, g.tx, g.ty);
  const costs: Cost[] = [
    { cause: 'vibes', label: `Bad vibes in the ${roomName}`, amount: vibesPenalty(vibesAt(ctx, it)) * weight },
    { cause: 'tired', label: `${staff.name} was worn out`, amount: staff.energy < 15 ? 0.15 : 0 },
    { cause: 'worse', label: `${g.name} had got worse while waiting`, amount: conditionPenalty(g.health) },
    { cause: 'noise', label: `Noise in the ${roomName}`, amount: noisePenalty(itemNoise(ctx, it)) * weight },
    { cause: 'linens', label: `Stale linens on the ${ITEMS[it.type].name}`, amount: linensPenalty(it) * weight },
    {
      cause: 'temperature',
      label: `Too ${temp > IDEAL_TEMP ? 'hot' : 'cold'} for a ceremony`,
      amount: weight > 1 ? discomfort(temp) * TRIP_DISCOMFORT : 0,
    },
    { cause: 'rest', label: 'Nowhere to lie down afterwards', amount: restPenalty(ctx, g) },
    {
      cause: 'guess',
      label: 'A best guess at a structural condition, unscanned',
      amount: g.guessed ? GUESS_PENALTY : 0,
    },
    {
      cause: 'skill',
      label: `${staff.name} is ${an(rankName(staff.skill))}, not an Expert`,
      amount: Math.max(0, 5 - staff.skill) * 0.09,
    },
    {
      cause: 'diagnosis',
      label: `The diagnosis was only ${pct(Math.min(1, g.diagnosis))} sure`,
      amount: (1 - Math.min(1, g.diagnosis)) * 0.15,
    },
  ];
  return costs.filter((c) => c.amount >= LISTED_COST).sort((a, b) => b.amount - a.amount);
}

/** The shortfalls every treatment has against the best there could be, rather than something going wrong. */
const SHORTFALLS = new Set(['skill', 'diagnosis']);

/** Why a treatment failed, in a word: what stopped it being delivered, the biggest thing wrong, or just the odds. */
export function failureCause(problem: DeliveryProblem, costs: readonly Cost[]): string {
  if (problem) return problem;
  return costs.find((c) => !SHORTFALLS.has(c.cause) && c.amount >= NAMED_COST)?.cause ?? 'odds';
}

/** Count a failed treatment by why it failed, and explain it once it has failed that way a few times. */
export function noteFailure(ctx: SimContext, it: Item, staff: Staff, g: Guest, problem: DeliveryProblem) {
  const costs = failureCosts(ctx, it, staff, g);
  const cause = failureCause(problem, costs);
  noteHarm(ctx, `failed:${cause}`, () => failureNote(ctx, it, staff, g, problem, cause, costs));
}

/** The explanation of treatments failing for the same reason. */
function failureNote(
  ctx: SimContext,
  it: Item,
  staff: Staff,
  g: Guest,
  problem: DeliveryProblem,
  cause: string,
  costs: readonly Cost[],
): Omit<HarmNote, 'key'> {
  const mod = MODALITIES[conditionOf(g.condition).modality];
  const room = ctx.world.roomOfItem(it);
  const roomName = room ? ROOMS[room.type].name : ITEMS[it.type].name;
  const role = ROLES[staff.role].name;
  const equipment = mod.equipment ? ITEMS[mod.equipment].name : 'equipment';
  // the reason it is explained for leads, whatever is bigger
  const ordered = [...costs.filter((c) => c.cause === cause), ...costs.filter((c) => c.cause !== cause)];
  const listed = ordered.slice(0, 4).map((c) => ({ label: c.label, amount: `−${pct(c.amount)}` }));
  const head = problemLine(problem, staff, mod, equipment);
  const causes = head ? [{ label: head }, ...listed.slice(0, 3)] : listed;
  const about = { kind: 'item' as const, id: it.id };
  const caretaker = hasStaff(ctx, 'caretaker');
  const hireCaretaker = caretaker ? {} : { fix: { hire: 'caretaker' as const } };
  const base = {
    title: `${HARM_EXPLAIN} treatments have failed${CAUSE_WORDS[cause] ? ` with ${CAUSE_WORDS[cause]}` : ''}`,
    cost: '−2.5 reputation each, and the treatments went unpaid',
    causes,
  };
  switch (cause) {
    case 'unqualified':
      return {
        ...base,
        help: hasRoom(ctx, 'training')
          ? `Select ${staff.name} and send them on the ${modalityLabel(mod.id)} course in the Training Room. Until then, guests who need it are better off with a ${role} who has it.`
          : `Build a Training Room and send ${staff.name} on the ${modalityLabel(mod.id)} course, or hire a ${role} who has it already.`,
        about: { kind: 'staff', id: staff.id },
        ...(!hasRoom(ctx, 'training') && { fix: { menu: 'rooms' } }),
      };
    case 'no-equipment':
      return {
        ...base,
        help: `${modalityLabel(mod.id)} needs ${an(equipment)} in the same ${roomName} as the table. You'll find it in the Items menu.`,
        about,
        fix: { menu: 'items' },
      };
    case 'out-of-action':
      return {
        ...base,
        help: caretaker
          ? `The ${equipment} keeps breaking down. Check repairs are among your Caretaker's duties and that they work in the ${roomName}, or hire a second.`
          : `The ${equipment} is broken. A Caretaker repairs worn equipment before it gives out, and a generator keeps it going through a power cut.`,
        about,
        ...hireCaretaker,
      };
    case 'cold':
      return {
        ...base,
        help: caretaker
          ? 'The Stone Warmer keeps running cold: your Caretaker cannot reheat it often enough. A second Caretaker, or a second warmer in the room, keeps the stones hot.'
          : 'Hot stones need a Caretaker to keep the Stone Warmer topped up and hot.',
        about,
        ...hireCaretaker,
      };
    case 'vibes': {
      const smudger = ctx.s.staff.some((st) => st.state !== 'leaving' && canSmudge(st));
      return {
        ...base,
        help: smudger
          ? `Each failure leaves more bad vibes, and they make the next failure likelier. Your smudger clears them as they get to them; Wind Chimes in the ${roomName} make them fade four times as fast.`
          : `Each failure leaves more bad vibes, and they make the next failure likelier. A Caretaker who has taken the Smudging course clears them with burning sage, as does a Reiki Practitioner or a Shaman. Wind Chimes make them fade four times as fast.`,
        ...(room && { about: { kind: 'room', id: room.id } }),
        ...hireCaretaker,
      };
    }
    case 'tired':
      return {
        ...base,
        help: hasRoom(ctx, 'staffroom')
          ? `${staff.name} worked on long past tired. In the Policy menu, have staff take their breaks sooner, or build a Staff Room nearer the ${roomName} so the walk is shorter.`
          : `${staff.name} has nowhere to rest. Build a Staff Room so your staff can take their breaks before they are worn out.`,
        about: { kind: 'staff', id: staff.id },
        ...(!hasRoom(ctx, 'staffroom') && { fix: { menu: 'rooms' } }),
      };
    case 'worse':
      return {
        ...base,
        help: `Guests who wait a long time get worse, and worse is harder to treat. Shorter lines help: another ${ITEMS[it.type].name} and a ${role} to work it, or move the worst off up the line from their card.`,
        about,
      };
    case 'noise':
      return {
        ...base,
        help: `Something loud is near the ${roomName}. Soundproof Panels on its walls, or moving the noisy things away, quieten it; the Noise overlay shows where it comes from.`,
        about,
        fix: { menu: 'items' },
      };
    case 'linens':
      return {
        ...base,
        help: !hamperWithRoom(ctx)
          ? 'The linens need changing. A Caretaker changes them from a Linen Hamper, so place one with room in it.'
          : 'The linens need changing more often. A Caretaker changes them from the Linen Hamper; a second Caretaker or a second hamper keeps up.',
        about,
        ...(caretaker ? (hamperWithRoom(ctx) ? {} : { fix: { menu: 'items' } }) : hireCaretaker),
      };
    case 'temperature':
      return {
        ...base,
        help: 'Ceremonies need a comfortable room. Radiators warm it and Air Conditioners cool it; the Temperature overlay shows where it is off.',
        about,
        fix: { menu: 'items' },
      };
    case 'rest':
      return {
        ...base,
        help: 'This treatment needs a lie-down afterwards. A Recovery Lounge with a Recliner gives guests one.',
        about,
        fix: { menu: 'rooms' },
      };
    case 'guess':
      return {
        ...base,
        help: hasItem(ctx, 'posture_scanner')
          ? 'A structural condition was treated on a best guess because the Posture Scanner was not working. A Caretaker repairs it when it wears out.'
          : 'A Consultant can see a structural condition but not pin it down. A Posture Lab scans those guests, which makes the diagnosis certain and the treatment likelier to work.',
        about,
        ...(hasItem(ctx, 'posture_scanner') ? hireCaretaker : { fix: { menu: 'rooms' } }),
      };
    default:
      return {
        ...base,
        help: `Every treatment can fail, and a few in a row do happen. The odds rise with more skilled ${role}s, who improve with every guest, a skilled ${ROLES.consultant.name} so the diagnosis is sure${hasItem(ctx, 'posture_scanner') ? '' : ', a Posture Lab to scan the unsure'}, and a finer room: decor, plants and daylight.`,
        about,
      };
  }
}

/** What went wrong, in a few words to follow "with", for a title. */
const CAUSE_WORDS: Readonly<Record<string, string>> = {
  unqualified: 'an untrained hand',
  'no-equipment': 'the equipment missing',
  'out-of-action': 'the equipment broken',
  cold: 'cold stones',
  vibes: 'bad vibes in the room',
  tired: 'worn-out staff',
  worse: 'guests who had got worse',
  noise: 'noise in the room',
  linens: 'stale linens',
  guess: 'a best guess at the diagnosis',
  temperature: 'the temperature off',
  rest: 'nowhere to rest after',
};

/** What stopped a treatment being delivered properly, as a line of its own, if anything did. */
function problemLine(problem: DeliveryProblem, staff: Staff, mod: ModalityDef, equipment: string): string {
  switch (problem) {
    case 'unqualified':
      return `${staff.name} is not trained in ${modalityLabel(mod.id)}`;
    case 'no-equipment':
      return `No ${equipment} in the room`;
    case 'out-of-action':
      return `The ${equipment} was out of action`;
    case 'cold':
      return 'The massage stones were cold';
    default:
      return '';
  }
}

/**
 * The station a guest was waiting for: the one they were called to or lined up at, or else the busiest of those that
 * could see to them, which they were waiting for a place at.
 */
function waitedFor(ctx: SimContext, g: Guest): Item | undefined {
  const own = ctx.world.item(g.station) ?? ctx.s.items.find((i) => i.queue.includes(g.id));
  if (own) return own;
  return ctx.s.items
    .filter((i) => ITEMS[i.type].station?.goal === g.goal && (g.goal !== 'treat' || treatsHere(i, modalityOf(g))))
    .sort((a, b) => b.queue.length - a.queue.length)[0];
}

/** What a line is, as the title names it: "the Massage Suite", "a consultation". */
function linePlace(ctx: SimContext, g: Guest, key: LineKey): string {
  const station = waitedFor(ctx, g);
  if (station) return `the ${stationPlace(station)}`;
  return key === 'consult' ? 'a consultation' : `the ${ROOMS[DISCIPLINES[key].room].name}`;
}

/** Days as text, to a tenth: "1.5 days". */
const days = (seconds: number) => {
  const d = Math.round((seconds / DAY_SECONDS) * 10) / 10;
  return `${d} day${d === 1 ? '' : 's'}`;
};

/** How many more were waiting in the same line as a guest, and for how many of the station they wait for. */
function lineCause(ctx: SimContext, g: Guest): { label: string } | null {
  const station = waitedFor(ctx, g);
  if (!station) return null;
  const n = working(ctx, station).length;
  const name = ITEMS[station.type].name;
  if (!n) return { label: `No working ${name}: it is out of action` };
  const key = lineOf(g);
  const more = ctx.s.guests.filter((o) => o !== g && worsening(o) && lineOf(o) === key).length;
  return { label: `${more} more waiting for ${n === 1 ? 'one' : n} ${name}${n === 1 ? '' : 's'}` };
}

/** The stations of the same kind as this one that work. */
const working = (ctx: SimContext, station: Item) =>
  ctx.s.items.filter((i) => i.type === station.type && ctx.world.usable(i));

/** What a second station would take, to shorten the line for one, in words. */
function anotherStation(ctx: SimContext, g: Guest): string {
  const station = waitedFor(ctx, g);
  const def = station && ITEMS[station.type].station;
  if (!station || !def) return 'Shorter lines help most';
  // nothing shortens a line that is not moving at all
  if (!working(ctx, station).length)
    return hasStaff(ctx, 'caretaker')
      ? `The ${ITEMS[station.type].name} needs mending: check repairs are among your Caretaker's duties`
      : `The ${ITEMS[station.type].name} needs mending, and a Caretaker repairs worn equipment`;
  // one that runs itself needs nobody to work it, only another of its room
  if (!def.staff) return `Another ${stationPlace(station)} would shorten the line`;
  return `Another ${ITEMS[station.type].name} and a ${ROLES[def.staff].name} to work it would shorten the line`;
}

/** Count a guest who ran out of patience, by the line they were in, and explain it once a few have. */
export function noteStormed(ctx: SimContext, g: Guest) {
  if (g.classDay) return;
  const key = lineOf(g);
  noteHarm(ctx, `stormed:${key}`, () => {
    const temp = warmthAt(ctx, g.tx, g.ty);
    const uneasy = discomfort(temp);
    const drab = drainFactor(ctx, g.tx, g.ty) - 1;
    const line = lineCause(ctx, g);
    const causes: { label: string; amount?: string }[] = [{ label: `Waited ${days(g.waited)}` }];
    if (line) causes.push(line);
    const standing = g.pose !== 'sit';
    if (standing) causes.push({ label: 'Stood the whole time', amount: `+${pct(1 / SEAT_DRAIN - 1)}` });
    const need =
      g.bladder >= 100 ? 'Bursting for the toilet' : g.thirst >= 100 ? 'Parched' : g.hunger >= 100 ? 'Starving' : '';
    if (need) causes.push({ label: need, amount: '+60%' });
    if (uneasy >= 0.1)
      causes.push({
        label: `Too ${temp > IDEAL_TEMP ? 'hot' : 'cold'} where they waited`,
        amount: `+${pct(uneasy * DISCOMFORT_DRAIN)}`,
      });
    if (g.stressed) causes.push({ label: 'Stressed', amount: `+${pct(STRESS_DRAIN - 1)}` });
    if (drab >= 0.05) causes.push({ label: 'Little to look at where they waited', amount: `+${pct(drab)}` });
    const helps = [`${anotherStation(ctx, g)}.`];
    if (standing) helps.push('Benches let them sit, and sitting guests last much longer.');
    if (need === 'Bursting for the toilet') helps.push('A Restroom nearby lets them go.');
    else if (need === 'Parched') helps.push('A Herbal Tea Station or a Water Cooler nearby lets them drink.');
    else if (need) helps.push('A Snack Machine nearby lets them eat.');
    if (uneasy >= 0.1) helps.push('Radiators or Air Conditioners fix the temperature.');
    if (drab >= 0.05) helps.push('Plants and decor near the line calm them.');
    const station = waitedFor(ctx, g);
    return {
      title: `${HARM_EXPLAIN} guests ran out of patience waiting for ${linePlace(ctx, g, key)}`,
      cost: '−3 reputation each, and they left without a treatment',
      causes: causes.slice(0, 4),
      help: helps.join(' '),
      ...(station && { about: { kind: 'item' as const, id: station.id } }),
      ...stormedFix(ctx, station, standing),
    };
  });
}

/** Where the fix for a line guests give up on is: a Caretaker for a station out of action, else Benches to sit on. */
function stormedFix(ctx: SimContext, station: Item | undefined, standing: boolean): Pick<HarmNote, 'fix'> {
  if (station && !working(ctx, station).length && !hasStaff(ctx, 'caretaker')) return { fix: { hire: 'caretaker' } };
  if (standing && !ctx.s.items.some((i) => i.type === 'bench')) return { fix: { menu: 'items' } };
  return {};
}

/** Count a guest who got worse waiting, by the line they were in, and explain it once a few have. */
export function noteWorse(ctx: SimContext, g: Guest) {
  const key = lineOf(g);
  noteHarm(ctx, `worse:${key}`, () => {
    const cond = conditionOf(g.condition);
    const causes: { label: string; amount?: string }[] = [{ label: `Waited ${days(g.waited)}` }];
    const line = lineCause(ctx, g);
    if (line) causes.push(line);
    if ((cond.worsens ?? 1) > 1)
      causes.push({ label: `${cond.name} worsens faster than most`, amount: `×${cond.worsens}` });
    const station = waitedFor(ctx, g);
    return {
      title: `${HARM_EXPLAIN} guests got worse waiting for ${linePlace(ctx, g, key)} and went home`,
      cost: `−${WORSE_REP} reputation each`,
      causes,
      help: `${anotherStation(ctx, g)}. While they wait, select the worst off and move them up the line, or send them home for −${SEND_HOME_REP} rather than −${WORSE_REP}; the advisor names anyone about to go.`,
      ...(station && { about: { kind: 'item' as const, id: station.id } }),
      ...stormedFix(ctx, station, false),
    };
  });
}

/** Count a guest put off by the price, and explain it once a few have been. */
export function notePriced(ctx: SimContext, g: Guest) {
  noteHarm(ctx, 'priced', () => {
    const m = conditionOf(g.condition).modality;
    const price = priceFor(ctx.s, m);
    const rep = ctx.s.reputation;
    return {
      title: `${HARM_EXPLAIN} guests turned down a treatment at your prices`,
      cost: '−1 reputation each, and only the consultation was paid for',
      causes: [
        { label: `${modalityLabel(m)} is priced at ${pct(price)} of standard` },
        { label: `Reputation is ${Math.round(rep)}%` },
        { label: 'New guests who turn it down at that price', amount: pct(putOffChance(price, rep)) },
      ],
      help: 'The lower your reputation, the more a high price puts new guests off; regulars mind it less. Bring prices down in Money → Prices until your name is worth more.',
      fix: { menu: 'prices' },
    };
  });
}
