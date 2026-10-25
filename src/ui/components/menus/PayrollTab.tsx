// The Money menu's Payroll tab: the next payday against the bank and the pace of the books, with a verdict in a line.

import { FIRST_PAYDAYS, INSOLVENCY_DAYS, OVERDRAFT_RATE } from '../../../core/data';
import { dateOf, money } from '../../../core/format';
import {
  cashflow,
  daysUntilBankrupt,
  incomeOf,
  inHandLine,
  loanLimit,
  netOf,
  paydayOf,
  type PaydaysInHand,
  paydaysInHand,
  payrollOutlook,
  payrollVerdict,
  shortOfAMonth,
} from '../../../core/sim/economy';
import type { Ledger } from '../../../core/state/types';
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

/** What a month's books have paid out so far, all told. */
const spentOf = (l: Ledger) => incomeOf(l) - netOf(l);

/** Where the center stands with the bank, in words: content, or calling the overdraft in with so many days to go. */
export function runwayNote(days: number | null): string {
  if (days === null)
    return 'The bank judges the business, not the building: it calls the overdraft in only from a center in the red past what it will still lend and losing money.';
  const n = Math.max(1, Math.ceil(days));
  return `The bank is calling the overdraft in: ${n} day${n === 1 ? '' : 's'} to get back above zero or into profit, or the center is bankrupt.`;
}

/**
 * A month's wages against the bank and the loan left: through a new center's first paydays, with how many come before
 * the takings have a record, and at any time with less than a month in hand, what to hold off. Empty otherwise.
 */
export function inHandNote(h: PaydaysInHand, left: number): string {
  const short = shortOfAMonth(h);
  if (!short && !(h.opening && h.wages > 0)) return '';
  const head = h.opening ? 'The first paydays' : 'In hand';
  const paydays = left === 1 ? 'One payday comes' : `${left} paydays come`;
  const first = h.opening
    ? ` ${paydays} before the takings have a record, so what is hired, built or sent away before then is paid for out of this.`
    : '';
  const hold = short
    ? ' That is past what the paydays can carry: until there is a month in hand, hire nobody more, send nobody on a course and turn house calls down.'
    : '';
  return `${head}: ${inHandLine(h)}${first}${hold}`;
}

/** Wages due, the bank, the loan room, last month's net and the net a month at this pace, and whether payday is covered. */
export function PayrollTab() {
  const { sim } = useGame();
  const s = sim.s;
  const o = payrollOutlook(s);
  const h = paydaysInHand(s);
  const note = inHandNote(h, FIRST_PAYDAYS - s.months.length);
  const flow = cashflow(s);
  const payday = dateOf(paydayOf(s), s.startMonth);
  const lastNet = s.months.length ? netOf(s.lastLedger) : null;
  /** Green for money in hand or coming in, red for money going out or missing. */
  const sign = (n: number) => (n >= 0 ? 'pos' : 'neg');
  return (
    <>
      <div
        class={cx(
          'ledger',
          'verdict',
          o.covered === 'no'
            ? 'bad'
            : o.covered === 'borrowing' || (s.bankruptcyOn && shortOfAMonth(h))
              ? 'warn'
              : 'ok',
        )}
      >
        <h4>{payrollVerdict(o)}</h4>
        {s.bankruptcyOn && <p class="sub">{runwayNote(daysUntilBankrupt(s))}</p>}
        {s.bankruptcyOn && note && <p class="sub">{note}</p>}
      </div>
      <div class="ledgers">
        <div class="ledger">
          <h4>{`Payday: day ${payday.day} of month ${payday.month}, in ${Math.max(1, Math.ceil(o.daysLeft))} days`}</h4>
          <Figure name="Wages due" value={money(o.wages)} look="neg" />
          <Figure name="Bank balance" value={money(s.money)} look={sign(s.money)} />
          <Figure name="Coming in by then, at this pace" value={money(o.coming)} look="pos" />
          <Figure name={`Loan room left of ${money(loanLimit(s))}`} value={money(o.loanRoom)} />
          {o.short > 0 && <Figure name="Short at payday" value={money(o.short)} look="neg" />}
          <Figure
            name="Months of wages in hand"
            value={Number.isFinite(h.months) ? h.months.toFixed(1) : 'No wages yet'}
            look={h.months < 1 ? 'neg' : undefined}
          />
        </div>
        <div class="ledger">
          <h4>A month at this pace</h4>
          <Figure name="Income this month so far" value={money(incomeOf(s.ledger))} look="pos" />
          <Figure name="Income a month at this pace" value={money(flow.income)} look="pos" />
          <Figure name="Wages on the books" value={money(-flow.wages)} look="neg" />
          <Figure name="Interest at a month's end" value={money(-flow.interest)} look="neg" />
          {flow.upkeep > 0 && <Figure name="Running the machines" value={money(-flow.upkeep)} look="neg" />}
          <div class="total">
            <span>Net a month</span>
            <b class={sign(flow.net)}>{money(flow.net)}</b>
          </div>
          <Figure name="Spent this month so far, all told" value={money(-spentOf(s.ledger))} look="neg" />
          <Figure
            name="Last month's net"
            value={lastNet === null ? 'No month on file yet' : money(lastNet)}
            look={lastNet === null ? undefined : sign(lastNet)}
          />
        </div>
      </div>
      <p class="sub">
        {`The pace is what the center has taken in over the last month or so (this month so far and the last one finished, over the days they cover), less the wages on the books and the interest. Building, training, marketing and fines are left out: a one-off outlay is not a losing business. Wages are owed by the day worked, so someone hired mid-month costs less this payday. A payday the bank cannot cover is put to you as a loan, or paid into the red at ${(OVERDRAFT_RATE * 100).toFixed(0)}% a month; the bank calls the overdraft in only from a center in the red past what it will still lend and losing money, and then gives ${INSOLVENCY_DAYS} days to put one of the two right.`}
      </p>
    </>
  );
}
