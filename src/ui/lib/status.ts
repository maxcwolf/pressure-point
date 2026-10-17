// Describing what people are up to, in a few words.

import { DISCIPLINES, GENERAL_COURSES, isGeneral, ITEMS, modalityLabel, ROOMS } from '../../core/data';
import { slots, trained, xpToNext } from '../../core/sim/careers';
import { missNote } from '../../core/sim/classes';
import type { Sim } from '../../core/sim/sim';
import type { CourseId, Guest, Staff } from '../../core/state/types';

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
          ? `Waiting for a working ${ROOMS[DISCIPLINES[sim.modalityOf(g).discipline].room].name}`
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
      if (g.needKind === 'play')
        return sim.world.item(g.claimItem)?.type === 'fortune_teller'
          ? 'Having their fortune told'
          : 'Playing a round on the arcade';
      if (g.needKind === 'eat') return 'Getting a snack';
      return DRINKS[sim.world.item(g.claimItem)?.type ?? ''] ?? 'Getting a herbal tea';
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
    job && job.kind !== 'litter' && job.kind !== 'smudge' && job.kind !== 'soul' && job.kind !== 'ward'
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
    case 'refresh':
      return it?.type === 'snack_machine' ? 'Getting a snack' : 'Getting a drink';
    default:
      return 'Clearing litter';
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

/** The display name of a training course. */
export function courseName(id: CourseId) {
  if (id === 'skill') return 'professional development';
  return isGeneral(id) ? GENERAL_COURSES[id].name : modalityLabel(id);
}

/** How a morale bar is drawn: red once it is low enough to worry about. */
export function moraleLook(morale: number): string {
  return morale < 30 ? 'bad' : 'gold';
}

/** A warning about someone on course to quit, from the days they have left; empty while they are not. */
export function quitWarning(days: number | null): string {
  if (days === null) return '';
  const left = Math.max(1, Math.ceil(days));
  const plural = left === 1 ? 'day' : 'days';
  return days <= 2 ? `⚠️ About to quit: ${left} ${plural} left` : `😠 Miserable: will quit in ${left} ${plural}`;
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
