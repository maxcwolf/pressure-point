// Staff: hiring and firing, pay and morale, breaks and finding work to do.

import { ITEMS, ROLES, traitOf, WEAR_REPAIR } from '../data';
import { money } from '../format';
import { fairSalary, makeCandidate } from '../people';
import { pick, random } from '../random';
import { type Item, type Staff } from '../state/types';
import { clamp, must } from '../util';
import { accessPose, accessTile, footprint } from '../world';
import { System } from './system';

/** The four tiles beside a tile, for standing next to something. */
const BESIDE: readonly (readonly [dx: number, dy: number])[] = [
  [0, 1],
  [1, 0],
  [-1, 0],
  [0, -1],
];

export class Staffing extends System {
  hire(candidateId: number): Staff | null {
    const s = this.s;
    const c = s.candidates.find((x) => x.id === candidateId);
    if (!c) return null;
    const [x, y] = this.sim.chars.streetTile();
    const st: Staff = {
      ...this.sim.chars.create(c.name, c.look, x, y),
      kind: 'staff',
      role: c.role,
      skill: c.skill,
      salary: c.salary,
      traits: c.traits,
      energy: 100,
      state: 'arriving',
      post: 0,
      job: null,
      served: 0,
      quals: [...c.quals],
      training: null,
      strain: 1,
      morale: 75,
      raiseAsked: false,
      unhappyT: 0,
    };
    const [lx, ly] = this.sim.chars.lobbyTile();
    if (!this.sim.movement.goTo(st, lx, ly)) return null;
    s.staff.push(st);
    s.candidates = s.candidates.filter((x) => x !== c);
    s.candidates.push(makeCandidate(s, c.role));
    this.sim.events.emit({ type: 'sfx', name: 'hire' });
    this.sim.events.toast(`${c.name} joins as a ${ROLES[c.role].name}.`, 'good');
    return st;
  }

  /** Send a member of staff home for good, either fired or because they quit. */
  fire(id: number, quit = false) {
    const st = this.sim.chars.staff(id);
    if (!st || st.state === 'leaving') return;
    this.idle(st);
    st.state = 'leaving';
    st.raiseAsked = false;
    this.sim.chars.say(st, quit ? '😠' : '📦', 6);
    const [x, y] = this.sim.chars.streetTile();
    if (!this.sim.movement.goTo(st, x, y)) this.s.staff = this.s.staff.filter((q) => q !== st);
    if (quit) {
      this.sim.economy.changeRep(-2);
      this.sim.events.toast(`${st.name} has quit. Unhappy staff do not stay.`, 'bad');
      this.sim.events.emit({ type: 'sfx', name: 'fail' });
    } else this.sim.events.toast(`${st.name} has been let go.`, 'info');
  }

  /** What this member of staff could reasonably expect to be paid. */
  fairPay(st: Staff): number {
    return fairSalary(st.role, st.skill, st.traits, st.quals);
  }

  /** The salary a raise would take them to: the going rate, or 10% more if they already earn it. */
  raiseTo(st: Staff): number {
    return Math.max(this.fairPay(st), Math.round((st.salary * 1.1) / 10) * 10);
  }

  giveRaise(id: number) {
    const st = this.sim.chars.staff(id);
    if (!st || st.state === 'leaving') return;
    st.salary = this.raiseTo(st);
    st.morale = Math.min(100, st.morale + 22);
    st.raiseAsked = false;
    st.unhappyT = 0;
    this.sim.chars.say(st, '😊', 4);
    this.sim.events.emit({ type: 'sfx', name: 'cash' });
  }

  private updateMorale(st: Staff, dt: number) {
    if (st.state === 'leaving' || st.state === 'arriving') return;
    const fair = this.fairPay(st);
    let target = 62 + clamp((st.salary / fair - 1) * 90, -45, 20);
    if (st.energy < 20) target -= 18;
    const post = this.world.item(st.post);
    const room = post && st.state === 'atPost' ? this.world.roomOfItem(post) : undefined;
    if (room) target += (this.sim.ambience.prestige(room) - 2) * 5;
    if (this.s.litter.length > 6) target -= 6;
    st.morale = clamp(st.morale + (target - st.morale) * Math.min(1, dt * 0.03), 0, 100);

    if (!st.raiseAsked && st.salary < fair * 0.97 && st.morale < 56) {
      st.raiseAsked = true;
      this.sim.chars.say(st, '💰', 5);
      this.sim.events.toast(`${st.name} thinks they are worth ${money(fair)} a month and wants a raise.`, 'info');
    }
    const before = st.unhappyT;
    if (st.morale < 25) st.unhappyT += dt;
    else st.unhappyT = Math.max(0, st.unhappyT - dt);
    if (before < 20 && st.unhappyT >= 20) {
      this.sim.chars.say(st, '😠', 6);
      this.sim.events.toast(`${st.name} is miserable and thinking of quitting.`, 'bad');
    }
    if (st.unhappyT > 60 && !st.busy && !st.training) this.fire(st.id, true);
  }

  private leavePost(st: Staff) {
    const it = this.world.item(st.post);
    if (it?.staffId === st.id) it.staffId = 0;
    st.post = 0;
    st.busy = false;
  }

  private dropJob(st: Staff) {
    const job = st.job;
    if (!job) return;
    const claimed = job.kind === 'litter' ? this.s.litter.find((x) => x.id === job.id) : this.world.item(job.id);
    if (claimed?.claimedBy === st.id) claimed.claimedBy = 0;
    st.job = null;
  }

  idle(st: Staff) {
    if (st.training) {
      // interrupted before finishing: the course fee comes back
      this.s.money += st.training.cost;
      this.s.ledger.training -= st.training.cost;
      st.training = null;
    }
    this.leavePost(st);
    this.sim.claims.release(st);
    this.dropJob(st);
    this.sim.movement.halt(st);
    st.state = 'idle';
    st.timer = 0.2;
  }

  private tryBreak(st: Staff): boolean {
    const sofa = this.sim.claims.findAccess('rest', st.tx, st.ty);
    if (!sofa) return false;
    this.leavePost(st);
    this.dropJob(st);
    this.sim.claims.claim(st, sofa.item, sofa.idx);
    const [x, y] = accessTile(sofa.item, sofa.idx);
    if (!this.sim.movement.goTo(st, x, y, accessPose(sofa.item, sofa.idx))) {
      this.sim.claims.release(st);
      return false;
    }
    st.state = 'toBreak';
    this.sim.chars.say(st, '😴');
    return true;
  }

  private findWork(st: Staff) {
    if (st.energy < 18 && this.tryBreak(st)) return;
    const s = this.s;
    if (st.role === 'caretaker') {
      // broken equipment first, then litter, then routine watering and servicing
      interface Task {
        kind: 'litter' | 'water' | 'repair';
        id: number;
        x: number;
        y: number;
        urgency: number;
      }
      const tasks: Task[] = [];
      for (const l of s.litter) if (!l.claimedBy) tasks.push({ kind: 'litter', id: l.id, x: l.x, y: l.y, urgency: 1 });
      for (const p of s.items) {
        if (p.claimedBy) continue;
        if (p.wear >= WEAR_REPAIR)
          tasks.push({ kind: 'repair', id: p.id, x: p.x, y: p.y, urgency: p.wear >= 100 ? 2 : 0 });
        else if ((p.type === 'plant' && p.water <= 40) || (p.type === 'stone_warmer' && p.water <= 55))
          tasks.push({ kind: 'water', id: p.id, x: p.x, y: p.y, urgency: 0 });
      }
      const dist = (t: Task) => Math.hypot(t.x - st.tx, t.y - st.ty);
      tasks.sort((a, b) => b.urgency - a.urgency || dist(a) - dist(b));
      for (const task of tasks.slice(0, 4)) {
        let ok = false;
        if (task.kind === 'litter') ok = this.sim.movement.goTo(st, task.x, task.y);
        else {
          // stand next to the item, on whichever side can be reached
          const item = must(this.world.item(task.id), 'item to tend');
          search: for (const [fx, fy] of footprint(item)) {
            for (const [dx, dy] of BESIDE) {
              if (this.world.walkable(fx + dx, fy + dy) && this.sim.movement.goTo(st, fx + dx, fy + dy)) {
                ok = true;
                break search;
              }
            }
          }
        }
        if (!ok) continue;
        st.job = { kind: task.kind, id: task.id };
        const target = task.kind === 'litter' ? s.litter.find((l) => l.id === task.id) : this.world.item(task.id);
        if (target) target.claimedBy = st.id;
        st.state = 'toJob';
        return;
      }
    } else {
      let best: Item | null = null;
      let bestScore = -1e9;
      for (const it of s.items) {
        const def = ITEMS[it.type].station;
        if (def?.staff !== st.role || it.staffId || !this.world.usable(it)) continue;
        let score = it.queue.length * 10 - Math.hypot(it.x - st.tx, it.y - st.ty);
        if (def.goal === 'treat') {
          for (const id of it.queue) {
            const q = this.sim.chars.guest(id);
            if (q && !this.sim.treatments.deliveryProblem(it, st, this.sim.treatments.modalityOf(q))) score += 8;
          }
        }
        if (score > bestScore) {
          bestScore = score;
          best = it;
        }
      }
      if (best) {
        const ai = this.sim.claims.accessIndex(best, 'staff');
        const [x, y] = accessTile(best, ai);
        if (this.sim.movement.goTo(st, x, y, accessPose(best, ai))) {
          best.staffId = st.id;
          st.post = best.id;
          st.state = 'toPost';
          return;
        }
      }
    }
    // nothing to do: amble about
    if (st.state === 'idle' && random() < 0.25) {
      const spots = this.world.standSpots(st.tx, st.ty, 40);
      if (spots.length) {
        const [x, y] = pick(spots);
        if (this.sim.movement.goTo(st, x, y)) st.state = 'wander';
      }
    }
  }

  update(st: Staff, dt: number) {
    if (st.bubbleT > 0) st.bubbleT -= dt;
    let walk = 2.3;
    let stamina = 1;
    for (const t of st.traits) {
      walk *= traitOf(t).walk ?? 1;
      stamina *= traitOf(t).stamina ?? 1;
    }
    if (st.energy < 15) walk *= 0.75;
    const arrived = this.sim.movement.move(st, dt, walk);

    this.updateMorale(st, dt);
    if (st.state === 'leaving' && !this.s.staff.includes(st)) return;
    if (st.state === 'onBreak') st.energy = Math.min(100, st.energy + dt * 9);
    else if (st.state !== 'leaving' && st.state !== 'training') {
      const rate = st.busy ? 0.42 * (st.strain || 1) : st.state === 'atPost' ? 0.14 : 0.2;
      st.energy = Math.max(0, st.energy - rate * stamina * dt);
    }

    switch (st.state) {
      case 'arriving':
        if (arrived || !st.path) {
          st.state = 'idle';
          st.timer = 0;
        }
        break;
      case 'idle':
      case 'wander':
        if (st.state === 'wander' && (arrived || !st.path)) st.state = 'idle';
        st.timer -= dt;
        if (st.timer <= 0) {
          st.timer = 0.7;
          this.findWork(st);
        }
        break;
      case 'toPost': {
        const it = this.world.item(st.post);
        if (it?.staffId !== st.id) this.idle(st);
        else if (arrived) st.state = 'atPost';
        else if (!st.path) this.idle(st);
        break;
      }
      case 'atPost': {
        const it = this.world.item(st.post);
        if (it?.staffId !== st.id || !this.world.usable(it)) this.idle(st);
        else if (st.energy < 18 && !it.serving) {
          st.timer -= dt;
          if (st.timer <= 0) {
            st.timer = 2;
            if (!this.tryBreak(st))
              this.sim.events.tipOnce(
                'tired',
                'Tired staff members work slowly and botch treatments. Build a Staff Room so they can rest.',
                'bad',
              );
          }
        }
        break;
      }
      case 'toBreak':
        if (arrived) st.state = 'onBreak';
        else if (!st.path) this.idle(st);
        break;
      case 'onBreak':
        if (st.energy >= 100 || !st.claimItem) this.idle(st);
        break;
      case 'toJob':
        if (arrived) {
          st.state = 'doingJob';
          st.timer = st.job?.kind === 'repair' ? 3.2 : 1.6;
          st.busy = true;
          if (st.job && st.job.kind !== 'litter') {
            const p = this.world.item(st.job.id);
            if (p) st.facing = Math.atan2(p.x + 0.5 - st.x, p.y + 0.5 - st.y);
          }
        } else if (!st.path) this.idle(st);
        break;
      case 'doingJob':
        st.timer -= dt;
        if (st.timer <= 0) {
          const job = st.job;
          if (job?.kind === 'litter') this.s.litter = this.s.litter.filter((l) => l.id !== job.id);
          else if (job) {
            const p = this.world.item(job.id);
            if (p) {
              if (job.kind === 'repair') p.wear = 0;
              else p.water = 100;
              p.claimedBy = 0;
              if (job.kind === 'repair') this.world.version++;
            }
          }
          st.job = null;
          this.idle(st);
        }
        break;
      case 'toTrain':
        if (arrived) st.state = 'training';
        else if (!st.path) this.idle(st);
        break;
      case 'training': {
        const t = st.training;
        if (!t || !st.claimItem) {
          this.idle(st);
          break;
        }
        t.progress += dt / t.seconds;
        if (t.progress >= 1) this.sim.training.graduate(st);
        break;
      }
      case 'leaving':
        if (arrived || !st.path) this.s.staff = this.s.staff.filter((x) => x !== st);
        break;
    }
  }
}
