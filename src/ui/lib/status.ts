// Describing what people are up to, in a few words.

import { ITEMS, POOR_CONDITION, ROLES, ROOMS } from '../../core/data';
import { expert, slots, trained, xpToNext } from '../../core/sim/careers';
import { missNote } from '../../core/sim/classes';
import { roomForModality } from '../../core/sim/machines';
import type { Sim } from '../../core/sim/sim';
import { courseName } from '../../core/sim/training';
import { conditionDays, worsening } from '../../core/sim/worsening';
import type { Guest, Staff } from '../../core/state/types';
import { cx } from './cx';
import type { IconLine } from './icon-line';
import { meterTone } from './meters';

export { courseName };

/** What a guest getting a drink is having, by what they are getting it from, other than a herbal tea. */
const DRINKS: Readonly<Record<string, string>> = {
  water_cooler: 'Getting a glass of water',
  kombucha_tap: 'Pouring a kombucha',
};

/** What a class-goer is doing, in a few words. */
function classgoerStatus(g: Guest, sim: Sim): string {
  const spot = sim.world.item(g.station);
  switch (g.state) {
    case 'enter':
      return 'Arriving for a Qi Gong class';
    case 'called':
      return 'Heading to their Practice Spot';
    case 'served':
      return spot && sim.classPlaying(spot) ? 'In the Qi Gong class' : 'On their Practice Spot, waiting for the class';
    case 'leaving':
      if (g.feelings.includes('no-class'))
        return g.missed ? `Going home without a class: ${missNote(g.missed)}` : 'Going home: the class never happened';
      return g.outcome === 'class' ? 'Going home after the class' : 'Leaving';
    default:
      return spot ? 'Waiting for a place in the class' : 'Looking for a Qi Gong Studio';
  }
}

/** What a guest is doing, in a few words. */
export function guestStatus(g: Guest, sim: Sim): string {
  const st = sim.world.item(g.station);
  const where = st ? ITEMS[st.type].name : '';
  if (g.classDay) return classgoerStatus(g, sim);
  switch (g.state) {
    case 'enter':
      return 'Arriving';
    case 'toWait':
    case 'waiting':
      if (!st)
        return g.goal === 'treat'
          ? `Waiting for a working ${ROOMS[roomForModality(sim.modalityOf(g).id)].name}`
          : g.goal === 'consult'
            ? 'Waiting for a Consultation Room to exist'
            : g.goal === 'assess'
              ? 'Waiting for a working Posture Lab'
              : 'Looking for Reception';
      return g.goal === 'reception'
        ? 'In line at Reception'
        : g.goal === 'consult'
          ? 'Waiting for a consultation'
          : g.goal === 'assess'
            ? 'Waiting for a posture scan'
            : g.goal === 'shop'
              ? 'In line at the Shop Counter'
              : 'Waiting for treatment';
    case 'called':
      return `Heading to the ${where}`;
    case 'served':
      return g.goal === 'reception'
        ? 'Checking in'
        : g.goal === 'consult'
          ? 'Being diagnosed'
          : g.goal === 'assess'
            ? 'Being scanned'
            : g.goal === 'shop'
              ? 'Buying something to take home'
              : 'Being treated';
    case 'toRest':
      return 'Heading to the Recovery Lounge for a lie-down';
    case 'resting':
      return 'Resting in the Recovery Lounge';
    case 'toNeed':
    case 'need':
      if (g.needKind === 'toilet') return 'Answering a call of nature';
      if (g.needKind === 'play') {
        const played = sim.world.item(g.claimItem);
        if (played?.type === 'fortune_teller') return 'Having their fortune told';
        if (played && ITEMS[played.type].station) return `Taking a ride on the ${ITEMS[played.type].name}`;
        return 'Playing a round on the arcade';
      }
      if (g.needKind === 'eat') return 'Getting a snack';
      return DRINKS[sim.world.item(g.claimItem)?.type ?? ''] ?? 'Getting a herbal tea';
    case 'running':
      return 'Running round the institute on a really bad trip';
    case 'leaving':
      return g.outcome === 'healed'
        ? 'Going home healed'
        : g.outcome === 'failed'
          ? 'Going home, still knotted'
          : g.outcome === 'stormed'
            ? 'Leaving in a huff'
            : g.outcome === 'sent'
              ? 'Sent home'
              : 'Leaving';
  }
}

/** The chore a member of staff is on, in a few words. */
function choreStatus(st: Staff, sim: Sim): string {
  const job = st.job;
  const it =
    job &&
    job.kind !== 'litter' &&
    job.kind !== 'smudge' &&
    job.kind !== 'soul' &&
    job.kind !== 'ward' &&
    job.kind !== 'calm'
      ? sim.world.item(job.id)
      : undefined;
  switch (job?.kind) {
    case 'repair':
      return `Repairing the ${ITEMS[it?.type ?? 'bin'].name}`;
    case 'clean':
      return it && ITEMS[it.type].linens ? 'Changing the linens' : 'Cleaning a toilet';
    case 'launder':
      return 'Laundering the linens';
    case 'water':
      return it?.type === 'stone_warmer' ? 'Reheating the massage stones' : 'Watering a plant';
    case 'smudge':
      return st.role === 'shaman' ? 'Clearing bad vibes, and blessing the room' : 'Clearing bad vibes with sage';
    case 'ward':
      return 'Warding off the mishap coming';
    case 'soul':
      return `Retrieving ${sim.staff(job.id)?.name ?? 'someone'}’s soul`;
    case 'calm':
      return `${st.state === 'doingJob' ? 'Calming' : 'Going to calm'} ${sim.guest(job.id)?.name ?? 'someone'} down`;
    case 'refresh':
      return it?.type === 'snack_machine' ? 'Getting a snack' : 'Getting a drink';
    case 'douse':
      return `${st.state === 'doingJob' ? 'Putting out' : 'Running to put out'} the fire on the ${ITEMS[it?.type ?? 'bin'].name}`;
    default: {
      const flood = st.job && sim.s.litter.find((l) => l.id === st.job?.id)?.flood;
      const room = flood ? sim.world.room(flood) : undefined;
      return room ? `Mopping out the flooded ${ROOMS[room.type].name}` : flood ? 'Mopping up' : 'Clearing litter';
    }
  }
}

/** What a member of staff is doing, in a few words. */
export function staffStatus(st: Staff, sim: Sim): string {
  const post = sim.world.item(st.post);
  switch (st.state) {
    case 'arriving':
      return 'Arriving for their first day';
    case 'idle':
    case 'wander':
      return st.role === 'caretaker' ? 'Looking for something to clean' : 'Idle: no open station to staff';
    case 'toPost':
      return `Heading to the ${post ? ITEMS[post.type].name : 'station'}`;
    case 'atPost':
      return st.busy ? 'Working' : 'Waiting for a guest';
    case 'toBreak':
      return 'Off for a break';
    case 'onBreak':
      return 'Resting in the Staff Room';
    case 'toJob':
    case 'doingJob':
      return choreStatus(st, sim);
    case 'toTrain':
      return 'Heading to the Training Room';
    case 'training':
      return `Studying: ${st.training ? courseName(st.training.course) : ''}`;
    case 'toCall':
      return `Setting off on a house call to ${st.call?.client ?? 'a client'}`;
    case 'away':
      return `On a house call to ${st.call?.client ?? 'a client'}`;
    case 'leaving':
      return 'Leaving for good';
  }
}

/** How a morale bar is drawn: green, then amber as it sags, and red once it is low enough to worry about. */
export function moraleLook(morale: number): string {
  return meterTone('morale', morale);
}

/** A warning about someone on course to quit, from the days they have left; empty while they are not. */
export function quitWarning(days: number | null): IconLine | null {
  if (days === null) return null;
  const left = Math.max(1, Math.ceil(days));
  const plural = left === 1 ? 'day' : 'days';
  return days <= 2
    ? { icon: 'ui-warning', text: `About to quit: ${left} ${plural} left` }
    : { icon: 'bubble-angry', text: `Miserable: will quit in ${left} ${plural}` };
}

/** The staff waiting on an answer about a raise, in payroll order. Anyone already on their way out is past asking. */
export function raiseRequests(staff: readonly Staff[]): Staff[] {
  return staff.filter((st) => st.raiseAsked && st.state !== 'leaving');
}

/** Staff ready for promotion, still waiting on it. */
export function promotionRequests(staff: readonly Staff[]): Staff[] {
  return staff.filter((st) => st.promotion && st.state !== 'leaving');
}

/** What still stands between a member of staff and a promotion they have the experience for, if anything. */
export function promotionNote(st: Staff, fullyTrained: boolean): string {
  if (st.promotion || xpToNext(st) !== 0 || fullyTrained) return '';
  return `To be promoted, fill every qualification slot (${trained(st)} of ${slots(st)} filled) with a course in a Training Room.`;
}

/** How many of their qualification slots are filled, and what more training can bring. */
export function slotNote(st: Staff): string {
  const filled = `Qualification slots: ${Math.min(trained(st), slots(st))} of ${slots(st)} filled.`;
  if (!expert(st)) return `${filled} Each promotion brings another.`;
  return ROLES[st.role].discipline ? `${filled} As an Expert, they can learn every treatment besides.` : filled;
}

/**
 * How long a waiting guest's condition has left, in words, red when it is poor: "Condition: 12 days left", or
 * "Condition runs out in 2 days: goes home worse off", with a warning icon. Nothing for a guest no longer worsening.
 */
export function conditionNote(g: Guest): (IconLine & { poor: boolean }) | null {
  if (!worsening(g)) return null;
  const days = Math.max(1, Math.ceil(conditionDays(g)));
  const word = `${days} day${days === 1 ? '' : 's'}`;
  if (g.health < POOR_CONDITION)
    return { icon: 'ui-warning', text: `Condition runs out in ${word}: goes home worse off`, poor: true };
  return { text: `Condition: ${word} left`, poor: false };
}

/** What a status line's look says: trouble, worth a look, plain news, or good news. */
export type StatusTone = 'bad' | 'warn' | 'neutral' | 'good';

/** The kinds of status line the inspector shows about someone or something. */
export type StatusKind =
  | 'doing'
  | 'staffed'
  | 'installing'
  | 'award'
  | 'rattling'
  | 'unstaffed'
  | 'smoking'
  | 'filthy'
  | 'stale'
  | 'rattled'
  | 'promotion'
  | 'offer'
  | 'miserable'
  | 'quitting'
  | 'broken'
  | 'burning'
  | 'stopped'
  | 'flooded';

/**
 * How each kind of status line looks. Trouble that is losing guests or staff now is red; what wants seeing to before it
 * becomes trouble is amber; what someone is doing, and who staffs what, is plain news.
 */
const STATUS_TONES: Readonly<Record<StatusKind, StatusTone>> = {
  doing: 'neutral',
  staffed: 'neutral',
  installing: 'neutral',
  rattling: 'neutral',
  award: 'good',
  unstaffed: 'warn',
  smoking: 'warn',
  filthy: 'warn',
  stale: 'warn',
  rattled: 'warn',
  promotion: 'warn',
  offer: 'warn',
  miserable: 'warn',
  quitting: 'bad',
  broken: 'bad',
  burning: 'bad',
  stopped: 'bad',
  flooded: 'bad',
};

/** The tone of a kind of status line. */
export function statusTone(kind: StatusKind): StatusTone {
  return STATUS_TONES[kind];
}

/** The classes for a status line of this kind: `status` and its tone, plus any of the caller's own. */
export function statusClass(kind: StatusKind, ...more: (string | false | null | undefined)[]): string {
  return cx('status', statusTone(kind), ...more);
}

/** The kind of a station's staffing line: staffed, closed for an upgrade, or wanting someone. */
export function staffingKind(staffed: boolean, line: IconLine): StatusKind {
  if (staffed) return 'staffed';
  return line.icon === 'bubble-installing' ? 'installing' : 'unstaffed';
}
