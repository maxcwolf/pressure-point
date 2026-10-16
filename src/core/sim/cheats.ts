// The cheat console: commands typed in to change the game outright, for testing and for fun. A game they are used in
// earns no achievements or campaign stars from then on. Two Point's games have no console of their own, so the commands
// follow Theme Hospital's cheats (money, win the level, an emergency, an epidemic) and what Two Point's trainers offer
// (kudosh, maxed-out staff, no needs).

import { conditionHere, type ConditionId, CONDITIONS } from '../data';
import { money } from '../format';
import { clamp } from '../util';
import type { SimContext } from './context';
import { offerEmergency } from './emergencies';
import { emit } from './events';
import { spawnGuest } from './guests';
import { offerOutbreak } from './outbreaks';
import { awardStar } from './progress';

/** The commands the console takes. */
export type CheatName =
  | 'help'
  | 'money'
  | 'rep'
  | 'karma'
  | 'star'
  | 'win'
  | 'staff'
  | 'happy'
  | 'guests'
  | 'emergency'
  | 'outbreak'
  | 'unlock'
  | 'skip';

/** How a command is typed, and what it does. */
export interface CheatDef {
  usage: string;
  desc: string;
}

export const CHEATS: Readonly<Record<CheatName, CheatDef>> = {
  help: { usage: 'help', desc: 'List the commands.' },
  money: { usage: 'money [amount]', desc: 'Add money, $10,000 unless you say. A minus takes it away.' },
  rep: { usage: 'rep [points]', desc: 'Add reputation, 10% unless you say. A minus takes it away.' },
  karma: { usage: 'karma [amount]', desc: 'Add karma to spend in any center, 10 unless you say.' },
  star: { usage: 'star', desc: 'Earn the next star, prize and all.' },
  win: { usage: 'win', desc: 'Earn every star left in this center.' },
  staff: { usage: 'staff', desc: 'Give every member of staff full energy and morale, fed and watered.' },
  happy: { usage: 'happy', desc: 'Give every guest full patience, with no thirst, hunger or need for the restroom.' },
  guests: { usage: 'guests [count] [condition]', desc: 'Send in guests, 5 unless you say, with any condition.' },
  emergency: { usage: 'emergency', desc: 'Offer an emergency now.' },
  outbreak: { usage: 'outbreak', desc: 'Offer a stress outbreak now.' },
  unlock: { usage: 'unlock', desc: 'Unlock every room, item and treatment in this game.' },
  skip: { usage: 'skip [days]', desc: 'Play on for some days at once, 1 unless you say, up to 60.' },
};

export const CHEAT_ORDER = Object.keys(CHEATS) as CheatName[];

/** The most days `skip` plays on for at once, so the game is not frozen for long. */
export const MAX_SKIP_DAYS = 60;

/** The most guests `guests` sends in at once. */
export const MAX_CHEAT_GUESTS = 50;

/** What came of a command: what to tell the player, and karma to add to the campaign, which the game cannot. */
export interface CheatResult {
  ok: boolean;
  text: string;
  karma?: number;
}

/** A command that went through. */
const done = (text: string): CheatResult => ({ ok: true, text });

/** A command that did not. */
const refused = (text: string): CheatResult => ({ ok: false, text });

/** A number as typed: commas, a dollar sign and a k for thousands are allowed. NaN if it is not one. */
export function parseAmount(arg: string): number {
  const m = /^(-?)\$?([\d,]*\.?\d+)(k?)$/i.exec(arg.trim());
  if (!m) return NaN;
  const n = Number((m[2] ?? '').replace(/,/g, '')) * (m[3] ? 1000 : 1);
  return m[1] ? -n : n;
}

/** The number given for a command, or its default when none is. NaN if what was given is not a number. */
function amountOr(arg: string | undefined, fallback: number): number {
  return arg === undefined ? fallback : parseAmount(arg);
}

/** Run a line typed into the console. `fastForward` plays the game on for some days, which only the `Sim` can do. */
export function runCheat(ctx: SimContext, line: string, fastForward: (days: number) => void): CheatResult {
  const [word = '', ...args] = line.trim().toLowerCase().split(/\s+/);
  if (!word) return refused('Type a command, or help for the list.');
  if (!Object.hasOwn(CHEATS, word)) return refused(`Unknown command "${word}". Type help for the list.`);
  const result = run(ctx, word as CheatName, args, fastForward);
  if (result.ok && word !== 'help') ctx.s.cheated = true;
  return result;
}

/** Carry out a command known to the console. */
function run(ctx: SimContext, name: CheatName, args: string[], fastForward: (days: number) => void): CheatResult {
  const s = ctx.s;
  switch (name) {
    case 'help':
      return done(CHEAT_ORDER.map((n) => `${CHEATS[n].usage}: ${CHEATS[n].desc}`).join('\n'));
    case 'money': {
      const n = Math.round(amountOr(args[0], 10000));
      if (!Number.isFinite(n) || n === 0) return refused('Say how much, such as money 50000.');
      s.money += n;
      emit(ctx, { type: 'sfx', name: 'cash' });
      return done(`${n > 0 ? 'Added' : 'Took away'} ${money(Math.abs(n))}. The bank now holds ${money(s.money)}.`);
    }
    case 'rep': {
      const n = amountOr(args[0], 10);
      if (!Number.isFinite(n) || n === 0) return refused('Say how many points, such as rep 20.');
      s.reputation = clamp(s.reputation + n, 0, 100);
      return done(`Reputation is now ${Math.round(s.reputation)}%.`);
    }
    case 'karma': {
      const n = Math.round(amountOr(args[0], 10));
      if (!Number.isFinite(n) || n <= 0) return refused('Say how much karma to add, such as karma 10.');
      return { ok: true, text: `+${n} ✨ karma to spend in any center.`, karma: n };
    }
    case 'star':
      return awardStar(ctx) ? done(`Star ${s.stars} earned.`) : refused('Every star here is already earned.');
    case 'win': {
      const from = s.stars;
      while (awardStar(ctx));
      return s.stars > from
        ? done(`Every star earned: ${s.stars} in all.`)
        : refused('Every star here is already earned.');
    }
    case 'staff': {
      const staff = s.staff.filter((x) => x.state !== 'leaving');
      if (!staff.length) return refused('There is nobody on the payroll.');
      for (const st of staff) {
        st.energy = 100;
        st.morale = 100;
        st.thirst = 0;
        st.hunger = 0;
        st.unhappyT = 0;
      }
      return done(`${staff.length} on the payroll at full energy and morale.`);
    }
    case 'happy':
      if (!s.guests.length) return refused('There are no guests here.');
      for (const g of s.guests) {
        g.patience = 100;
        g.thirst = 0;
        g.hunger = 0;
        g.bladder = 0;
      }
      return done(`${s.guests.length} ${s.guests.length === 1 ? 'guest is' : 'guests are'} perfectly content.`);
    case 'guests':
      return sendGuests(ctx, args);
    case 'emergency':
      if (s.offer || s.emergency) return refused('There is already an emergency on offer or under way.');
      return offerEmergency(ctx)
        ? done('An emergency is on offer.')
        : refused('No emergency can be offered: nobody on the payroll can treat what one would bring.');
    case 'outbreak':
      return offerOutbreak(ctx)
        ? done('A stress outbreak is on offer.')
        : refused('There is already a stress outbreak on offer or under way.');
    case 'unlock':
      if (s.unlockAll) return refused('Everything is already unlocked.');
      s.unlockAll = true;
      return done('Every room, item and treatment is unlocked in this game.');
    case 'skip': {
      const days = amountOr(args[0], 1);
      if (!Number.isInteger(days) || days < 1 || days > MAX_SKIP_DAYS)
        return refused(`Say a whole number of days from 1 to ${MAX_SKIP_DAYS}, such as skip 7.`);
      fastForward(days);
      return done(`Skipped ahead ${days} ${days === 1 ? 'day' : 'days'}.`);
    }
  }
}

/** The conditions guests can turn up with in this game's center. */
function conditionsHere(ctx: SimContext): ConditionId[] {
  return CONDITIONS.filter((c) => conditionHere(c, ctx.s.center)).map((c) => c.id);
}

/** Send in some guests, with a condition if one is named, whether or not anyone here could treat it. */
function sendGuests(ctx: SimContext, args: string[]): CheatResult {
  if (!ctx.s.open) return refused('The center is not open yet.');
  // the count and the condition can come in either order
  const countArg = args.find((a) => !Number.isNaN(parseAmount(a)));
  const condArg = args.find((a) => a !== countArg);
  const count = amountOr(countArg, 5);
  if (!Number.isInteger(count) || count < 1 || count > MAX_CHEAT_GUESTS)
    return refused(`Say how many guests, from 1 to ${MAX_CHEAT_GUESTS}.`);
  const here = conditionsHere(ctx);
  if (condArg !== undefined && !here.includes(condArg as ConditionId))
    return refused(`Unknown condition "${condArg}". Try one of: ${here.join(', ')}.`);
  let sent = 0;
  for (let i = 0; i < count; i++) if (spawnGuest(ctx, condArg as ConditionId | undefined)) sent++;
  if (!sent) return refused('Nobody could get in: the way from the street to the lobby is blocked.');
  return done(`${sent} ${sent === 1 ? 'guest is' : 'guests are'} on the way in.`);
}
