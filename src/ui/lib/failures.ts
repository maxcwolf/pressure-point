// Failed treatments as the interface shows them: one guest's, and the latest broken down by technique, with the main
// causes and what helps.

import { type Modality, modalityLabel } from '../../core/data';
import { NAMED_COST } from '../../core/sim/failures';
import type { FailedTreatment, FailureReason } from '../../core/state/types';
import { percent } from './chance';

/** A reason a treatment failed, in a few words, for the breakdown. */
const CAUSE_NAMES: Readonly<Record<string, string>> = {
  unqualified: 'Untrained',
  'no-equipment': 'No equipment',
  'out-of-action': 'Equipment broken',
  cold: 'Cold stones',
  tired: 'Worn-out staff',
  worse: 'Got worse waiting',
  vibes: 'Bad vibes',
  noise: 'Noise',
  linens: 'Stale linens',
  temperature: 'Too hot or cold',
  rest: 'Nowhere to rest',
  guess: 'Best-guess diagnosis',
  skill: 'Junior hands',
  diagnosis: 'Unsure diagnosis',
  prestige: 'Plain room',
  upgrade: 'Basic equipment',
  difficulty: 'A hard technique',
  odds: 'Bad luck',
};

/** What helps with each reason a treatment fails. */
const FIXES: Readonly<Record<string, string>> = {
  unqualified: 'Send them on the course in a Training Room',
  'no-equipment': 'Place the equipment in the same room',
  'out-of-action': 'A Caretaker repairs it before it gives out',
  cold: 'A Caretaker keeps the Stone Warmer hot',
  tired: 'Breaks sooner, or a Staff Room nearer',
  worse: 'Shorter lines: another table and someone to work it',
  vibes: 'Smudge the room, and Wind Chimes to clear them',
  noise: 'Soundproof Panels, or the noise moved away',
  linens: 'A Caretaker with a Linen Hamper',
  temperature: 'Radiators or Air Conditioners',
  rest: 'A Recovery Lounge with a Lounger',
  guess: 'A Posture Lab to scan them first',
  skill: 'Skill grows with every guest; promote, or hire a higher rank',
  diagnosis: 'A skilled Consultant, or a surer diagnosis in Policy',
  prestige: 'Decorate: decor, plants and windows',
  upgrade: 'Upgrade the equipment from its inspector',
  difficulty: 'Skilled hands make up for it',
  odds: 'Nothing much was wrong: every treatment fails now and then',
};

/** A reason a treatment failed, in a few words. */
export const causeName = (cause: string) => CAUSE_NAMES[cause] ?? cause;

/** What helps with a reason a treatment failed, if anything does. */
export const fixFor = (cause: string) => FIXES[cause] ?? '';

/** What a reason took off, as a minus percentage: "−15%". */
export const minus = (amount: number) => `−${percent(amount)}`;

/** A failed treatment's heading: which technique, where, by whom, and the chance it had. */
export function failureHead(f: FailedTreatment): string {
  return `${modalityLabel(f.modality)} ${f.place}, given by ${f.staff}, at a ${percent(f.chance)} chance`;
}

/**
 * The reasons a failed treatment shows, biggest first after the one it is counted under: everything listed, up to
 * four, each marked if it is the main one. A failure down to the odds says so first.
 */
export function failureLines(f: FailedTreatment): { text: string; amount: string; main: boolean }[] {
  const ordered: FailureReason[] = [
    ...f.reasons.filter((r) => r.cause === f.cause),
    ...f.reasons.filter((r) => r.cause !== f.cause),
  ];
  const lines = ordered.slice(0, 4).map((r) => ({ text: r.text, amount: minus(r.amount), main: r.cause === f.cause }));
  if (f.cause === 'odds')
    lines.unshift({ text: `Bad luck: it fails ${percent(1 - f.chance)} of the time`, amount: '', main: true });
  return lines;
}

/** One technique's latest failures: how many, the main causes with how often and how much, and what would help most. */
export interface TechniqueFailures {
  modality: Modality;
  count: number;
  causes: { cause: string; count: number; amount: number }[];
  fix: string;
}

/**
 * The latest failed treatments, technique by technique, those that failed most first: each with its causes, the most
 * common first, and the fix for the commonest. The size of a cause is what it took off on average when it was the
 * reason; for bad luck it is the chance that was missed. A run of bad luck points to the biggest shortfall instead, and
 * untrained hands to the room and the colleague to post there, as the latest such failure put it.
 */
export function failureBreakdown(failures: readonly FailedTreatment[]): TechniqueFailures[] {
  const by = new Map<Modality, FailedTreatment[]>();
  for (const f of failures) by.set(f.modality, [...(by.get(f.modality) ?? []), f]);
  const rows = [...by].map(([modality, list]): TechniqueFailures => {
    const causes = new Map<string, { count: number; total: number }>();
    for (const f of list) {
      const c = causes.get(f.cause) ?? { count: 0, total: 0 };
      c.count++;
      c.total += f.cause === 'odds' ? f.chance : (f.reasons.find((r) => r.cause === f.cause)?.amount ?? 0);
      causes.set(f.cause, c);
    }
    const ranked = [...causes]
      .map(([cause, c]) => ({ cause, count: c.count, amount: c.total / c.count }))
      .sort((a, b) => b.count - a.count || b.amount - a.amount);
    const top = ranked[0]?.cause ?? 'odds';
    // the latest failure for that cause that says what to do here, naming who and where, says it best
    const own = list.filter((f) => f.cause === top && f.fix).at(-1)?.fix;
    return {
      modality,
      count: list.length,
      causes: ranked,
      fix: own ?? fixFor(top === 'odds' ? biggestShortfall(list) : top),
    };
  });
  return rows.sort((a, b) => b.count - a.count);
}

/** What took the most off a run of failures, on average across them, among what was named or listed. */
function biggestShortfall(list: readonly FailedTreatment[]): string {
  const totals = new Map<string, number>();
  for (const f of list) for (const r of f.reasons) totals.set(r.cause, (totals.get(r.cause) ?? 0) + r.amount);
  const [best] = [...totals].sort((a, b) => b[1] - a[1]);
  return best && best[1] / list.length >= NAMED_COST ? best[0] : 'odds';
}

/** A cause in the breakdown, with how often and how much: "Untrained ×4, −42%", or "Bad luck ×2, at 81%". */
export function causeText(c: { cause: string; count: number; amount: number }): string {
  const size = c.cause === 'odds' ? `at ${percent(c.amount)}` : minus(c.amount);
  return `${causeName(c.cause)} ×${c.count}, ${size}`;
}
