// Payday, when the bank cannot cover the wages: borrow the difference, or lose. The game waits meanwhile.

import { money } from '../../../core/format';
import { useGame, useHud } from '../../hooks/use-hud';
import { Button } from '../common/Button';
import { Dialog } from './Dialog';

/** The wages that cannot be paid, the loan that would cover them, and the choice between taking it and going bankrupt. */
export function PayrollDialog() {
  const hud = useHud();
  const { sim } = useGame();
  const due = sim.s.payrollDue;
  if (!due) return null;
  return (
    <Dialog>
      <h2>Payday, and the bank is short</h2>
      <p>{`Wages come to ${money(due.wages)}, and there is ${money(Math.max(0, sim.s.money))} in the bank.`}</p>
      <p>{`The bank will lend ${money(due.loan)} to cover them. Turn it down and the staff walk out: the center is bankrupt.`}</p>{' '}
      <div class="btnrow">
        <Button
          class="go"
          onPress={() => {
            if (sim.takePayrollLoan()) hud.close();
          }}
        >
          {`Borrow ${money(due.loan)}`}
        </Button>
        <Button
          class="danger"
          onPress={() => {
            sim.refusePayrollLoan();
            hud.close();
            hud.openPending();
          }}
        >
          Refuse and go bankrupt
        </Button>
      </div>
    </Dialog>
  );
}
