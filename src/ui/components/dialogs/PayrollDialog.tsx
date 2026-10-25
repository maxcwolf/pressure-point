// Payday, when the bank cannot cover the wages: borrow the difference or pay them into the red, or, past the loan, hear
// that they go into the red. The game waits meanwhile.

import { INSOLVENCY_DAYS, LOAN_RATE, OVERDRAFT_RATE } from '../../../core/data';
import { money } from '../../../core/format';
import { cashflow } from '../../../core/sim/economy';
import { buttonRow, dangerButton, goButton } from '../../../styled-system/recipes';
import { useGame, useHud } from '../../hooks/use-hud';
import { Button } from '../common/Button';
import { Dialog } from './Dialog';

/** A rate a month, as the dialog puts it. */
const rate = (r: number) => `${(r * 100).toFixed(0)}% a month`;

/**
 * The wages that cannot be paid and what the bank will do: lend them, or let them go into the red; with where the
 * books are heading, and what the bank does about a center in the red that is losing money.
 */
export function PayrollDialog() {
  const hud = useHud();
  const { sim } = useGame();
  const s = sim.s;
  const due = s.payrollDue;
  if (!due) return null;
  const red = s.money - due.wages;
  const flow = cashflow(s);
  const losing = flow.net < 0;
  const pace = losing ? `losing about ${money(-flow.net)} a month` : `making about ${money(flow.net)} a month`;
  const books = `At the pace of the last month or so you are ${pace}: ${money(flow.income)} coming in, against ${money(flow.wages)} in wages and ${money(flow.interest)} in interest.`;
  const then = losing
    ? ` In the red past what the bank will lend, with the books losing money, it calls the overdraft in: ${INSOLVENCY_DAYS} days to get back above zero or into profit, or the center is bankrupt.`
    : ' In the red with the books in profit, the bank is content, and the red clears.';
  return (
    <Dialog>
      <h2>Payday, and the bank is short</h2>
      <p>{`Wages come to ${money(due.wages)}, and there is ${money(s.money)} in the bank.`}</p>
      <p>
        {due.loan > 0
          ? `The bank will lend ${money(due.loan)} to cover them, at ${rate(LOAN_RATE)}. Or the wages go into the red, to ${money(red)}, at ${rate(OVERDRAFT_RATE)}, and the staff worry.`
          : `The bank will lend no more, so the wages go into the red, to ${money(red)}, at ${rate(OVERDRAFT_RATE)}, and the staff worry.`}
      </p>
      <p class="sub">{`${books}${then}`}</p>
      <div class={buttonRow()}>
        {due.loan > 0 && (
          <Button
            class={goButton()}
            onPress={() => {
              if (sim.takePayrollLoan()) hud.close();
            }}
          >
            {`Borrow ${money(due.loan)}`}
          </Button>
        )}
        <Button
          class={due.loan > 0 ? dangerButton() : goButton()}
          onPress={() => {
            sim.payIntoRed();
            hud.close();
            hud.openPending();
          }}
        >
          {due.loan > 0 ? 'Pay into the red' : 'Pay into the red and carry on'}
        </Button>
      </div>
    </Dialog>
  );
}
