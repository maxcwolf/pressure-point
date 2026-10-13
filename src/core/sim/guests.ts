// Guests: arriving, waiting their turn, looking after their needs and leaving.

import {
  type ConditionId,
  conditionOf,
  CONDITIONS,
  DISCIPLINES,
  ENT_IN_Y,
  ENT_X,
  ITEMS,
  MODALITIES,
  ROOMS,
} from '../data';
import { randomLook, randomName } from '../people';
import { pick, random, rnd } from '../random';
import { type Guest, type Item } from '../state/types';
import { at } from '../util';
import { accessPose, accessTile, inBuilding, itemCenter, rotVec, tileIdx, Z_CORRIDOR } from '../world';
import { System } from './system';

const GOAL_NAME = {
  reception: 'Reception Desk',
  consult: 'Consultation Room',
  assess: 'Posture Lab',
  treat: 'Massage Suite',
} as const;

const NEED_ICON = { drink: '🍵', eat: '🥜', toilet: '🚻' } as const;

export class Guests extends System {
  /** Bring in a new guest now and then, more often as the center's reputation grows. */
  arrive(dt: number) {
    const s = this.s;
    if (!s.open) return;
    s.spawnT -= dt;
    if (s.spawnT > 0) return;
    if (s.guests.length < 14 + s.rooms.length * 5) this.spawn();
    s.spawnT = (30 - s.reputation * 0.2) * rnd(0.7, 1.3);
  }

  spawn(condition?: ConditionId, emergency = false) {
    const s = this.s;
    const [x, y] = this.sim.chars.streetTile();
    const g: Guest = {
      ...this.sim.chars.create(randomName(), randomLook(), x, y),
      kind: 'guest',
      condition: condition ?? this.rollCondition(),
      // emergency cases arrive already diagnosed and go straight to treatment
      goal: emergency ? 'treat' : 'reception',
      state: 'enter',
      station: 0,
      needKind: '',
      thirst: rnd(0, 45),
      hunger: rnd(0, 40),
      bladder: rnd(0, 40),
      patience: 100,
      diagnosis: emergency ? 1 : 0,
      consults: 0,
      outcome: '',
      spent: 0,
      hasWrapper: false,
      waited: 0,
      emergency,
    };
    const [lx, ly] = this.sim.chars.lobbyTile();
    if (!this.sim.movement.goTo(g, lx, ly)) return;
    s.guests.push(g);
    s.stats.arrived++;
  }

  /**
   * Guests only arrive with conditions the center could treat: the modality is unlocked and
   * its discipline has a finished room. Ones nobody on the payroll is qualified for turn up
   * less often, so a new star or a new clinic is not an instant flood of failures.
   */
  private rollCondition(): ConditionId {
    const staff = this.s.staff.filter((x) => x.state !== 'leaving');
    let pool = CONDITIONS.filter(
      (c) => this.sim.treatments.unlocked(c.modality) && this.sim.treatments.offered(MODALITIES[c.modality].discipline),
    );
    if (!pool.length) pool = CONDITIONS.filter((c) => c.modality === DISCIPLINES.massage.base);
    const weights = pool.map((c) => (staff.some((t) => t.quals.includes(c.modality)) ? 1 : 0.4));
    let roll = random() * weights.reduce((a, b) => a + b, 0);
    for (const [i, condition] of pool.entries()) {
      roll -= at(weights, i);
      if (roll <= 0) return condition.id;
    }
    return at(pool, 0).id;
  }

  /** Put a guest back to square one of their current goal. */
  reset(g: Guest) {
    this.sim.claims.release(g);
    this.sim.stations.removeGuest(g);
    this.sim.movement.halt(g);
    this.decide(g);
  }

  decide(g: Guest) {
    if (g.goal === 'leave') {
      this.leave(g);
      return;
    }
    const st = this.sim.stations.pickStation(g);
    g.station = st ? st.id : 0;
    if (st) st.queue.push(g.id);
    this.goWait(g);
  }

  /** The n-th spot in the line in front of a reception desk. */
  private queueTile(it: Item, n: number): [number, number] {
    const ai = this.sim.claims.accessIndex(it, 'guest');
    const [ax, ay] = accessTile(it, ai);
    const face = at(ITEMS[it.type].access, ai).face;
    const [dx, dy] = rotVec(it.rot, -face[0], -face[1]);
    let x = ax;
    let y = ay;
    for (let i = 0; i <= n; i++) {
      const nx = x + dx;
      const ny = y + dy;
      if (
        !inBuilding(nx, ny) ||
        this.world.zone[tileIdx(nx, ny)] !== Z_CORRIDOR ||
        this.world.blocked[tileIdx(nx, ny)]
      ) {
        const spots = this.world.standSpots(ax, ay, n + 6);
        return spots[Math.min(spots.length - 1, n + 2)] ?? [ax, ay];
      }
      x = nx;
      y = ny;
    }
    return [x, y];
  }

  private waitAnchor(g: Guest): [number, number] {
    const st = this.world.item(g.station);
    if (st) {
      const room = this.world.roomOfItem(st);
      if (room) return [room.door.x + room.door.dx, room.door.y + room.door.dy];
      return accessTile(st, this.sim.claims.accessIndex(st, 'guest'));
    }
    return [ENT_X[0], ENT_IN_Y - 3];
  }

  private goWait(g: Guest) {
    this.sim.claims.release(g);
    g.state = 'toWait';
    g.needKind = '';
    const st = this.world.item(g.station);
    let ok = false;
    if (st?.type === 'reception_desk') {
      const [qx, qy] = this.queueTile(st, Math.max(0, st.queue.indexOf(g.id)));
      ok = this.sim.movement.goTo(g, qx, qy);
    } else {
      const [ax, ay] = this.waitAnchor(g);
      const seat = this.sim.claims.findAccess('seat', ax, ay, 11);
      if (seat) {
        this.sim.claims.claim(g, seat.item, seat.idx);
        const [sx, sy] = accessTile(seat.item, seat.idx);
        ok = this.sim.movement.goTo(g, sx, sy, accessPose(seat.item, seat.idx));
        if (!ok) this.sim.claims.release(g);
      }
      if (!ok) {
        const spots = this.world.standSpots(ax, ay, 14);
        if (spots.length) {
          const [sx, sy] = pick(spots);
          ok = this.sim.movement.goTo(g, sx, sy);
        }
      }
    }
    if (!ok) {
      this.sim.movement.halt(g);
      g.state = 'waiting';
    }
  }

  private tryNeed(g: Guest): boolean {
    const kind = g.bladder > 75 ? 'toilet' : g.thirst > 70 ? 'drink' : g.hunger > 75 ? 'eat' : '';
    if (!kind) return false;
    const a = this.sim.claims.findAccess(kind, g.tx, g.ty);
    if (!a) return false;
    this.sim.claims.claim(g, a.item, a.idx);
    const [ax, ay] = accessTile(a.item, a.idx);
    if (!this.sim.movement.goTo(g, ax, ay, accessPose(a.item, a.idx))) {
      this.sim.claims.release(g);
      return false;
    }
    g.needKind = kind;
    g.state = 'toNeed';
    this.sim.chars.say(g, NEED_ICON[kind]);
    return true;
  }

  private waitingThink(g: Guest) {
    const st = this.world.item(g.station);
    if (!st || !this.world.usable(st)) {
      this.sim.stations.removeGuest(g);
      const ns = this.sim.stations.pickStation(g);
      if (ns) {
        ns.queue.push(g.id);
        g.station = ns.id;
        this.goWait(g);
        return;
      }
      if (g.goal === 'assess') {
        g.goal = 'consult';
        this.decide(g);
        return;
      }
      if (g.goal !== 'leave' && g.goal !== 'reception') {
        const place =
          g.goal === 'treat'
            ? ROOMS[DISCIPLINES[this.sim.treatments.modalityOf(g).discipline].room].name
            : GOAL_NAME[g.goal];
        this.sim.events.tipOnce(
          `missing-${place}`,
          `Guests are waiting for a ${place}, but there isn't a working one.`,
          'bad',
        );
      }
    } else {
      // hop to a clearly better line if one has opened up
      const better = this.sim.stations.pickStation(g);
      if (better && better !== st && this.sim.stations.score(better, g) + 2 < this.sim.stations.score(st, g) - 1) {
        this.sim.stations.removeGuest(g);
        better.queue.push(g.id);
        g.station = better.id;
        this.goWait(g);
        return;
      }
    }
    if (this.tryNeed(g)) return;

    if (g.hasWrapper && random() < 0.2) {
      g.hasWrapper = false;
      const nearBin = this.s.items.some((i) => i.type === 'bin' && Math.hypot(i.x - g.tx, i.y - g.ty) < 7);
      const clear = !this.s.litter.some((l) => l.x === g.tx && l.y === g.ty);
      if (clear && random() < (nearBin ? 0.12 : 0.9))
        this.s.litter.push({ id: this.s.nextId++, x: g.tx, y: g.ty, claimedBy: 0 });
    }

    if (st?.type === 'reception_desk') {
      const [qx, qy] = this.queueTile(st, Math.max(0, st.queue.indexOf(g.id)));
      if (qx !== g.tx || qy !== g.ty) {
        if (this.sim.movement.goTo(g, qx, qy)) g.state = 'toWait';
      }
    } else if (!g.claimItem) {
      const [ax, ay] = this.waitAnchor(g);
      if (this.sim.claims.findAccess('seat', ax, ay, 11)) this.goWait(g);
    }
  }

  update(g: Guest, dt: number) {
    g.thirst = Math.min(100, g.thirst + dt * 0.5);
    g.hunger = Math.min(100, g.hunger + dt * 0.36);
    g.bladder = Math.min(100, g.bladder + dt * 0.42);
    if (g.bubbleT > 0) g.bubbleT -= dt;
    const stiff = g.outcome !== 'healed' && conditionOf(g.condition).visual === 'stiff';
    const arrived = this.sim.movement.move(g, dt, stiff ? 1.75 : 2.1);

    const waiting = g.state === 'toWait' || g.state === 'waiting' || g.state === 'toNeed' || g.state === 'need';
    if (waiting) {
      let drain = 0.85 * this.sim.ambience.drainFactor(g.tx, g.ty);
      if (g.pose === 'sit') drain *= 0.6;
      if (g.bladder >= 100 || g.thirst >= 100 || g.hunger >= 100) drain *= 1.6;
      g.patience -= drain * dt;
      g.waited += dt;
      if (g.patience <= 0) {
        this.stormOut(g);
        return;
      }
    }

    switch (g.state) {
      case 'enter':
        if (arrived) this.decide(g);
        break;
      case 'toWait':
        if (arrived || !g.path) {
          g.state = 'waiting';
          g.timer = rnd(0.3, 1);
          const st = this.world.item(g.station);
          if (st && g.pose === 'stand') {
            const [cx, cy] = itemCenter(st);
            g.facing = Math.atan2(cx - g.x, cy - g.y);
          }
        }
        break;
      case 'waiting':
        g.timer -= dt;
        if (g.timer <= 0) {
          g.timer = 0.8;
          this.waitingThink(g);
        }
        break;
      case 'called':
        g.timer -= dt;
        if (arrived) g.state = 'served';
        else if (g.timer <= 0 || !g.path) this.reset(g);
        break;
      case 'served':
        break;
      case 'toNeed':
        if (arrived) {
          g.state = 'need';
          g.timer = g.needKind === 'toilet' ? 3.5 : 2.2;
          g.busy = g.needKind !== 'toilet';
        } else if (!g.path) this.goWait(g);
        break;
      case 'need':
        g.timer -= dt;
        if (g.timer <= 0) {
          if (g.needKind === 'drink') {
            g.thirst = 0;
            g.bladder = Math.min(100, g.bladder + 22);
            this.sim.economy.earn(15, 'vending', g.x, g.y);
          } else if (g.needKind === 'eat') {
            g.hunger = 0;
            g.hasWrapper = true;
            this.sim.economy.earn(25, 'vending', g.x, g.y);
          } else {
            g.bladder = 0;
          }
          g.patience = Math.min(100, g.patience + 8);
          this.goWait(g);
        }
        break;
      case 'leaving':
        if (arrived || !g.path) this.s.guests = this.s.guests.filter((x) => x !== g);
        break;
    }
  }

  private stormOut(g: Guest) {
    g.outcome = 'stormed';
    this.s.stats.stormed++;
    this.sim.economy.changeRep(-3);
    this.sim.chars.say(g, '😤', 8);
    this.sim.events.emit({ type: 'float', text: 'Fed up!', x: g.x, y: g.y, kind: 'bad' });
    this.sim.events.tipOnce(
      'stormed',
      'A guest ran out of patience and left. Benches, tea, plants and shorter lines all help.',
      'bad',
    );
    this.leave(g);
  }

  leave(g: Guest) {
    this.sim.claims.release(g);
    this.sim.stations.removeGuest(g);
    g.goal = 'leave';
    g.state = 'leaving';
    const [x, y] = this.sim.chars.streetTile();
    if (!this.sim.movement.goTo(g, x, y)) this.s.guests = this.s.guests.filter((q) => q !== g);
  }
}
