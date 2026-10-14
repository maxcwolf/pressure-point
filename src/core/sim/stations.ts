// Stations where staff serve guests: the lines, the service itself and its outcome.

import {
  ASSESS_FEE,
  BOTCH_FACTOR,
  conditionOf,
  CONSULT_FEE,
  DIAGNOSIS_TARGET,
  DISCIPLINES,
  ITEMS,
  MODALITIES,
  modalityLabel,
  ROOMS,
  STONE_USE,
  traitOf,
} from '../data';
import { random, rnd } from '../random';
import type { Guest, Item, Staff } from '../state/types';
import { clamp, must } from '../util';
import { accessPose, accessTile } from '../world';
import { prestige } from './ambience';
import { guestById, say, staffById } from './chars';
import { accessIndex, findAccess, release } from './claims';
import type { SimContext } from './context';
import { changeRep, earn } from './economy';
import { emit, tipOnce } from './events';
import { decide, leave } from './guests';
import { goTo } from './movement';
import { hasRoom } from './progress';
import { countVisit } from './records';
import { deliveryProblem, modalityOf } from './treatments';
import { addWear } from './upkeep';

/** Lower is better. Guests steer toward tables that can actually deliver what they need. */
export function stationScore(ctx: SimContext, it: Item, g: Guest) {
  let score = it.queue.length + (it.serving ? 1 : 0) + (it.staffId ? 0 : 2.5);
  if (ITEMS[it.type].station?.goal === 'treat') {
    const problem = deliveryProblem(ctx, it, staffById(ctx, it.staffId), modalityOf(g));
    if (problem === 'unqualified') score += 6;
    else if (problem) score += 40;
  }
  return score;
}

/** The best usable station for a guest's current goal, if there is one. */
export function pickStation(ctx: SimContext, g: Guest): Item | null {
  const goal = g.goal;
  let best: Item | null = null;
  let bestScore = 1e9;
  for (const it of ctx.s.items) {
    const st = ITEMS[it.type].station;
    if (st?.goal !== goal || !ctx.world.usable(it)) continue;
    if (goal === 'treat' && st.discipline !== modalityOf(g).discipline) continue;
    const score = stationScore(ctx, it, g);
    if (score < bestScore) {
      bestScore = score;
      best = it;
    }
  }
  return best;
}

/** How long a service takes this member of staff, given their skill, traits, energy and morale. */
export function serviceSeconds(base: number, st: Staff) {
  let speed = 0.85 + st.skill * 0.05;
  for (const t of st.traits) speed *= traitOf(t).speed ?? 1;
  if (st.energy < 15) speed *= 0.6;
  speed *= 0.9 + st.morale / 500;
  return base / speed;
}

/** Run every station: tidy its line, call the next guest and move the service along. */
export function updateStations(ctx: SimContext, dt: number) {
  for (const it of ctx.s.items) {
    const def = ITEMS[it.type].station;
    if (!def) continue;
    let staff = staffById(ctx, it.staffId);
    // someone posted elsewhere does not work this station, this step or any other
    if (it.staffId && staff?.post !== it.id) {
      it.staffId = 0;
      staff = undefined;
    }
    const ready = !!staff && staff.state === 'atPost' && ctx.world.usable(it);
    let g = guestById(ctx, it.serving);
    if (it.serving && (g?.station !== it.id || (g.state !== 'called' && g.state !== 'served'))) {
      it.serving = 0;
      g = undefined;
    }
    if (it.queue.some((id) => guestById(ctx, id)?.station !== it.id))
      it.queue = it.queue.filter((id) => guestById(ctx, id)?.station === it.id);
    // tired staff finish with their current guest, then stop calling new ones so they can get away
    const wantsBreak = !!staff && staff.energy < 18 && !!findAccess(ctx, 'rest', staff.tx, staff.ty);
    if (!it.serving && ready && !wantsBreak) {
      for (const id of it.queue) {
        const q = guestById(ctx, id);
        if (q?.state === 'waiting' || q?.state === 'toWait') {
          callGuest(ctx, it, q);
          break;
        }
      }
    }
    if (staff && ready) {
      const served = g?.state === 'served' ? g : undefined;
      const mod = served && def.goal === 'treat' ? modalityOf(served) : null;
      staff.busy = !!served;
      staff.strain = mod ? mod.strain : 1;
      if (served) {
        it.progress += dt / serviceSeconds(mod ? mod.seconds : def.seconds, staff);
        if (it.progress >= 1) completeService(ctx, it, served, staff);
      }
    }
  }
}

/** Call a guest out of the line to be served. */
function callGuest(ctx: SimContext, it: Item, g: Guest) {
  it.queue = it.queue.filter((id) => id !== g.id);
  it.serving = g.id;
  it.progress = 0;
  release(ctx, g);
  const ai = accessIndex(it, 'guest');
  const [ax, ay] = accessTile(it, ai);
  g.state = 'called';
  g.timer = 40;
  if (!goTo(ctx, g, ax, ay, accessPose(it, ai))) {
    it.serving = 0;
    leave(ctx, g);
  }
}

/** Finish a service and apply its outcome: checked in, diagnosed or treated. */
function completeService(ctx: SimContext, it: Item, g: Guest, staff: Staff) {
  const def = must(ITEMS[it.type].station, 'station');
  it.serving = 0;
  it.progress = 0;
  staff.busy = false;
  staff.served++;
  g.patience = Math.min(100, g.patience + 30);
  addWear(ctx, it);
  const room = ctx.world.roomOfItem(it);
  const nice = room ? (prestige(ctx, room) - 1) * 0.02 : 0;
  const price = ctx.s.priceLevel;
  if (def.goal === 'reception') {
    g.goal = 'consult';
    say(g, '📋');
    emit(ctx, { type: 'sfx', name: 'blip' });
  } else if (def.goal === 'consult' || def.goal === 'assess') {
    g.consults++;
    const gain = def.goal === 'consult' ? 0.4 + staff.skill * 0.13 + rnd(0, 0.15) : 0.45 + staff.skill * 0.08;
    g.diagnosis = clamp(g.diagnosis + gain + nice, 0, 1);
    const fee = Math.round((def.goal === 'consult' ? CONSULT_FEE : ASSESS_FEE) * price);
    earn(ctx, fee, 'consult', g.x, g.y);
    g.spent += fee;
    if (g.diagnosis >= DIAGNOSIS_TARGET || g.consults >= 4) {
      g.goal = 'treat';
      say(g, '💡');
      // steep prices put some guests off once they hear what the treatment costs
      if (!g.emergency && random() < Math.max(0, (price - 1) * 0.35)) {
        g.outcome = 'stormed';
        g.goal = 'leave';
        countVisit(ctx, g, 'priced');
        changeRep(ctx, -1);
        say(g, '💸', 6);
        emit(ctx, { type: 'float', text: 'Too pricey!', x: g.x, y: g.y, kind: 'bad' });
        tipOnce(
          ctx,
          'pricey',
          'A guest balked at your prices and left. High prices earn more per guest but drive some away.',
          'bad',
        );
      }
    } else {
      // unsure: a scan settles it if there is a Posture Lab, otherwise it is back to the Consultant
      g.goal = def.goal === 'consult' && hasRoom(ctx, 'assess') ? 'assess' : 'consult';
      say(g, '❓');
      tipOnce(
        ctx,
        'rediagnose',
        'Some guests need more than one consultation before the diagnosis is certain. A skilled Consultant helps, and so does a Posture Lab.',
      );
    }
  } else {
    const cond = conditionOf(g.condition);
    const mod = MODALITIES[cond.modality];
    const problem = deliveryProblem(ctx, it, staff, mod);
    let chance = clamp(
      0.56 +
        staff.skill * 0.09 +
        Math.min(1, g.diagnosis) * 0.15 +
        nice -
        mod.difficulty -
        (staff.energy < 15 ? 0.15 : 0),
      0.3,
      0.98,
    );
    // the wrong hands or missing equipment: they try anyway, and it rarely works
    if (problem) chance *= BOTCH_FACTOR;
    else if (mod.equipment === 'stone_warmer') {
      const zone = ctx.world.zoneAt(it.x, it.y);
      const warmer = ctx.s.items
        .filter((i) => i.type === 'stone_warmer' && ctx.world.zoneAt(i.x, i.y) === zone && i.water >= STONE_USE)
        .sort((a, b) => b.water - a.water)[0];
      if (warmer) warmer.water -= STONE_USE;
    }
    g.goal = 'leave';
    if (random() < chance) {
      g.outcome = 'healed';
      countVisit(ctx, g, 'healed');
      const fee = Math.round(cond.fee * price);
      earn(ctx, fee, 'treatment', g.x, g.y);
      g.spent += fee;
      // good value earns a better name than a steep bill does
      changeRep(ctx, (1.8 + g.patience / 100) * (1.25 - 0.25 * price));
      if (g.emergency && ctx.s.emergency) ctx.s.emergency.healed++;
      say(g, '💖', 6);
      emit(ctx, { type: 'sfx', name: 'heal' });
    } else {
      g.outcome = 'failed';
      countVisit(ctx, g, 'failed');
      changeRep(ctx, -2.5);
      say(g, '💢', 6);
      const why = {
        '': 'Still knotted!',
        unqualified: 'Not qualified!',
        'no-equipment': 'No equipment!',
        cold: 'Cold stones!',
      }[problem];
      emit(ctx, { type: 'float', text: why, x: g.x, y: g.y, kind: 'bad' });
      emit(ctx, { type: 'sfx', name: 'fail' });
      if (problem === 'unqualified')
        tipOnce(
          ctx,
          `botch-qual-${mod.id}`,
          `${staff.name} is not trained in ${modalityLabel(mod.id)} and botched it. Send them on the course in a Training Room.`,
          'bad',
          { kind: 'staff', id: staff.id },
        );
      else if (problem === 'no-equipment')
        tipOnce(
          ctx,
          `botch-equipment-${mod.id}`,
          `${modalityLabel(mod.id)} needs a ${mod.equipment ? ITEMS[mod.equipment].name : 'piece of equipment'} in the same ${ROOMS[DISCIPLINES[mod.discipline].room].name} as the table.`,
          'bad',
        );
      else if (problem === 'cold')
        tipOnce(ctx, 'botch-cold', 'The massage stones were cold. A Janitor keeps Stone Warmers hot.', 'bad');
      else
        tipOnce(
          ctx,
          'failed',
          'A treatment failed, and that guest is not paying. Skilled, well-rested Therapists and a confident diagnosis improve the odds.',
          'bad',
        );
    }
  }
  decide(ctx, g);
}

/** Take a guest out of every line and off every station. */
export function removeFromStations(ctx: SimContext, g: Guest) {
  for (const it of ctx.s.items) {
    if (it.serving === g.id) it.serving = 0;
    if (it.queue.includes(g.id)) it.queue = it.queue.filter((id) => id !== g.id);
  }
  g.station = 0;
}
