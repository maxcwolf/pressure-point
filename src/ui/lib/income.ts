// Where the money comes from: a month's income by source, so a center living on side income can see it.

import { incomeOf } from '../../core/sim/economy';
import type { Ledger } from '../../core/state/types';

/** A source of income as the readout groups it. */
export type IncomeSource = 'treatment' | 'consult' | 'classes' | 'calls' | 'sales' | 'bonus';

/** One source of income: what it is, what it brought in this month and last, and its share of this month's income. */
export interface IncomeRow {
  id: IncomeSource;
  name: string;
  now: number;
  last: number;
  /** Its share of this month's income, from 0 to 1, or 0 with no income yet. */
  share: number;
  /** Whether it is the center's own healing work, or money from the side. */
  healing: boolean;
}

/** The sources in the order they are shown, healing first, each with the lines of the books it gathers. */
const SOURCES: readonly { id: IncomeSource; name: string; healing: boolean; lines: readonly (keyof Ledger)[] }[] = [
  { id: 'treatment', name: 'Treatments', healing: true, lines: ['treatment'] },
  { id: 'consult', name: 'Consultations', healing: true, lines: ['consult'] },
  { id: 'classes', name: 'Qi Gong classes', healing: false, lines: ['classes'] },
  { id: 'calls', name: 'House calls', healing: false, lines: ['calls'] },
  { id: 'sales', name: 'Shop and vending', healing: false, lines: ['shop', 'vending', 'mushrooms'] },
  { id: 'bonus', name: 'Bonuses and prizes', healing: false, lines: ['bonus'] },
];

/** What a source took in a month: its lines of the books added up. */
const takeOf = (l: Ledger, lines: readonly (keyof Ledger)[]) => lines.reduce((sum, line) => sum + l[line], 0);

/** This month's income by source against last month's, with each source's share of this month's. */
export function incomeSources(now: Ledger, last: Ledger): IncomeRow[] {
  const total = incomeOf(now);
  return SOURCES.map((src) => {
    const amount = takeOf(now, src.lines);
    return {
      id: src.id,
      name: src.name,
      now: amount,
      last: takeOf(last, src.lines),
      share: total > 0 ? amount / total : 0,
      healing: src.healing,
    };
  });
}

/** A share as a percentage, to the nearest whole one. */
export const shareWord = (share: number) => `${Math.round(share * 100)}%`;

/**
 * The verdict on a month's income in a line: how much of it was healing (treatments and consultations), and a warning
 * when the side income is carrying the center. Nothing with no income yet.
 */
export function incomeVerdict(now: Ledger): string | null {
  const total = incomeOf(now);
  if (total <= 0) return null;
  const healing = now.treatment + now.consult;
  const share = healing / total;
  if (share >= 0.5) return `Healing brought in ${shareWord(share)} of this month's income.`;
  return `Only ${shareWord(share)} of this month's income is from healing: classes, house calls, sales and bonuses are carrying the center. Treatments are the income that grows with the center; the rest comes and goes.`;
}
