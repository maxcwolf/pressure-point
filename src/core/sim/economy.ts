// Money and reputation: income, spending, payday, loans and prices.

import { LOAN_MAX, LOAN_RATE, LOAN_STEP, PRICE_MAX, PRICE_MIN } from '../data';
import { money } from '../format';
import { refillCandidates } from '../people';
import { emptyLedger } from '../state/game';
import { type Ledger } from '../state/types';
import { clamp } from '../util';
import { System } from './system';

export function netOf(l: Ledger) {
  return l.consult + l.treatment + l.vending + l.bonus - l.salaries - l.building - l.training - l.interest;
}

export class Economy extends System {
  earn(amount: number, kind: 'consult' | 'treatment' | 'vending', x: number, y: number) {
    this.s.money += amount;
    this.s.ledger[kind] += amount;
    this.sim.events.emit({ type: 'float', text: `+${money(amount)}`, x, y, kind: 'good' });
    if (amount >= 100) this.sim.events.emit({ type: 'sfx', name: 'cash' });
  }

  spend(amount: number, kind: 'salaries' | 'building' | 'training' | 'interest') {
    this.s.money -= amount;
    this.s.ledger[kind] += amount;
  }

  changeRep(delta: number) {
    const s = this.s;
    // gains taper off as reputation climbs
    if (delta > 0) delta *= 1.15 - s.reputation / 120;
    s.reputation = clamp(s.reputation + delta, 0, 100);
  }

  monthEnd() {
    const s = this.s;
    const wages = s.staff.filter((x) => x.state !== 'leaving').reduce((a, x) => a + x.salary, 0);
    if (wages > 0) {
      this.spend(wages, 'salaries');
      this.sim.events.toast(`Payday: ${money(wages)} in salaries.`, s.money < 0 ? 'bad' : 'info');
      this.sim.events.emit({ type: 'sfx', name: 'payday' });
    }
    const interest = Math.round(s.loan * LOAN_RATE);
    if (interest > 0) this.spend(interest, 'interest');
    s.history.push(netOf(s.ledger));
    if (s.history.length > 12) s.history.shift();
    s.lastLedger = s.ledger;
    s.ledger = emptyLedger();
    refillCandidates(s, true);
    if (s.money < 0) this.sim.events.toast('You are in the red. Heal faster!', 'bad');
  }

  borrow(): boolean {
    const s = this.s;
    if (s.loan + LOAN_STEP > LOAN_MAX) return false;
    s.loan += LOAN_STEP;
    s.money += LOAN_STEP;
    this.sim.events.emit({ type: 'sfx', name: 'cash' });
    return true;
  }

  repay(): boolean {
    const s = this.s;
    const amount = Math.min(LOAN_STEP, s.loan, Math.max(0, s.money));
    if (amount <= 0) return false;
    s.loan -= amount;
    s.money -= amount;
    this.sim.events.emit({ type: 'sfx', name: 'sell' });
    return true;
  }

  setPrice(level: number) {
    this.s.priceLevel = clamp(Math.round(level * 10) / 10, PRICE_MIN, PRICE_MAX);
  }
}
