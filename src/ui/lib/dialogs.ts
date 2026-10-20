// Which dialog the game is showing, and the ones it raised meanwhile, waiting their turn.

import type { GameState } from '../../core/state/types';
import type { DialogId } from '../hud';

/** A dialog as the game raised it, with the star it celebrates if it is the star dialog. */
export interface Raised {
  id: DialogId;
  star: number;
}

/** A payday and a bankruptcy have to be answered, and go ahead of anything else waiting. */
const FIRST: ReadonlySet<DialogId> = new Set(['payroll', 'bankrupt']);

/**
 * Where a dialog the game raises goes: shown now if nothing is showing, or if it has to be answered first and what is
 * showing does not, which then waits next in line; otherwise into the line, a payday or a bankruptcy ahead of the
 * rest. Nothing changes if it is showing or waiting already. `show` is the dialog to show now, if that changes.
 */
export function raise(
  showing: Raised | null,
  line: readonly Raised[],
  d: Raised,
): { show: Raised | null; line: Raised[] } {
  /** Whether a dialog is the one raised. */
  const same = (o: Raised) => o.id === d.id && o.star === d.star;
  if ((showing && same(showing)) || line.some(same)) return { show: null, line: [...line] };
  if (!showing) return { show: d, line: [...line] };
  if (FIRST.has(d.id) && !FIRST.has(showing.id)) return { show: d, line: [showing, ...line] };
  if (!FIRST.has(d.id)) return { show: null, line: [...line, d] };
  const after = line.filter((o) => FIRST.has(o.id)).length;
  return { show: null, line: [...line.slice(0, after), d, ...line.slice(after)] };
}

/** The dialog a stopped game is waiting on, if it is: a bankruptcy, a payday to borrow for, or an inspection to settle. */
export function pendingDialog(s: GameState): DialogId | null {
  if (s.bankrupt) return 'bankrupt';
  if (s.payrollDue?.until === null) return 'payroll';
  if (s.visitReport?.bribe !== undefined) return 'visit';
  return null;
}

/** Whether a dialog has to be answered from its own buttons, so Esc does not close it. */
export function mustAnswer(id: DialogId, s: GameState): boolean {
  return FIRST.has(id) || (id === 'visit' && s.visitReport?.bribe !== undefined);
}

/** Whether a dialog waiting in line still has something to show when its turn comes. */
export function stillDue(id: DialogId, s: GameState): boolean {
  if (id === 'payroll') return s.payrollDue?.until === null && !s.bankrupt;
  if (id === 'visit') return s.visitReport !== null;
  return true;
}
