// The Money menu's Payroll tab: the next payday against the bank and this month's pace, with a verdict in a line.

import { DAYS_PER_MONTH } from '../../../core/data';
import { dateOf, money } from '../../../core/format';
import {
  daysUntilBankrupt,
  loanLimit,
  netOf,
  paydayOf,
  payrollOutlook,
  payrollVerdict,
  projectedCashflow,
} from '../../../core/sim/economy';
import { useGame } from '../../hooks/use-hud';
import { cx } from '../../lib/cx';

/** A figure in the payroll table, red when it is money going out or a shortfall. */
function Figure({ name, value, look }: { name: string; value: string; look?: 'pos' | 'neg' | undefined }) {
  return (
    <div>
      <span>{name}</span>
      <b class={look}>{value}</b>
    </div>
  );
}

/** How long the center has at this pace, in words: a day count, or no end in sight. */
export function runwayNote(days: number | null): string {
  if (days === null) return 'At this pace the money does not run out in the next year.';
  const n = Math.max(1, Math.ceil(days));
  return `At this pace the money runs out in ${n} day${n === 1 ? '' : 's'}, grace days included.`;
}

/** Wages due, the bank, the loan room, last month's net and this month's projected net, and whether payday is covered. */
export function PayrollTab() {
  const { sim } = useGame();
  const s = sim.s;
  const o = payrollOutlook(s);
  const flow = projectedCashflow(s);
  const payday = dateOf(paydayOf(s));
  const lastNet = s.months.length ? netOf(s.lastLedger) : null;
  /** Green for money in hand or coming in, red for money going out or missing. */
  const sign = (n: number) => (n >= 0 ? 'pos' : 'neg');
  return (
    <>
      <div class={cx('ledger', 'verdict', o.covered === 'yes' ? 'ok' : o.covered === 'borrowing' ? 'warn' : 'bad')}>
        <h4>{payrollVerdict(o)}</h4>
        {s.bankruptcyOn && <p class="sub">{runwayNote(daysUntilBankrupt(s))}</p>}
      </div>
      <div class="ledgers">
        <div class="ledger">
          <h4>{`Payday: day ${payday.day} of month ${payday.month}, in ${Math.max(1, Math.ceil(o.daysLeft))} days`}</h4>
          <Figure name="Wages due" value={money(o.wages)} look="neg" />
          <Figure name="Bank balance" value={money(s.money)} look={sign(s.money)} />
          <Figure name="Coming in by then, at this pace" value={money(o.coming)} look="pos" />
          <Figure name={`Loan room left of ${money(loanLimit(s))}`} value={money(o.loanRoom)} />
          {o.short > 0 && <Figure name="Short at payday" value={money(o.short)} look="neg" />}
        </div>
        <div class="ledger">
          <h4>This month, projected</h4>
          <Figure name="Income so far" value={money(flow.soFar)} look="pos" />
          <Figure name="Income at this pace" value={money(flow.income)} look="pos" />
          <Figure name="Wages at payday" value={money(-flow.wages)} look="neg" />
          <Figure name="Loan interest at payday" value={money(-flow.interest)} look="neg" />
          <Figure name="Spent so far" value={money(-flow.spent)} look="neg" />
          <div class="total">
            <span>Projected net</span>
            <b class={sign(flow.net)}>{money(flow.net)}</b>
          </div>
          <Figure
            name="Last month's net"
            value={lastNet === null ? 'No month on file yet' : money(lastNet)}
            look={lastNet === null ? undefined : sign(lastNet)}
          />
        </div>
      </div>
      <p class="sub">
        {`The pace is this month's income so far, scaled to ${DAYS_PER_MONTH} days; for the first couple of days last month stands in. Wages are owed by the day worked, so someone hired mid-month costs less this payday. A payday the bank cannot cover is put to you as a loan; if the bank will not lend enough, you have a few days to find the money.`}
      </p>
    </>
  );
}
