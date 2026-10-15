// The Money menu: the books, prices (overall and per treatment), marketing, and the loan, a tab each.

import './MoneyMenu.css';

import { LOAN_MAX, LOAN_RATE, LOAN_STEP, PRICE_MAX, PRICE_MIN } from '../../../core/data';
import { money } from '../../../core/format';
import { netOf } from '../../../core/sim/economy';
import type { Ledger } from '../../../core/state/types';
import { useGame, useHud } from '../../hooks/use-hud';
import type { MoneyTab } from '../../hud';
import { barHeights } from '../../lib/chart';
import { cx } from '../../lib/cx';
import { Button } from '../common/Button';
import { MarketingTab } from './MarketingTab';
import { TechniquePrices } from './TechniquePrices';

/** A line of the books: income in green, spending in red. */
function Line({ name, amount, cost = false }: { name: string; amount: number; cost?: boolean }) {
  return (
    <div>
      <span>{name}</span>
      <b class={cost ? 'neg' : 'pos'}>{money(cost ? -amount : amount)}</b>
    </div>
  );
}

/** One month's income and costs. */
function LedgerTable({ title, ledger }: { title: string; ledger: Ledger }) {
  const net = netOf(ledger);
  return (
    <div class="ledger">
      <h4>{title}</h4>
      <Line name="Consultations" amount={ledger.consult} />
      <Line name="Treatments" amount={ledger.treatment} />
      <Line name="Tea &amp; snacks" amount={ledger.vending} />
      <Line name="Shop sales" amount={ledger.shop} />
      <Line name="House calls" amount={ledger.calls} />
      <Line name="Bonuses and prizes" amount={ledger.bonus} />
      <Line name="Salaries" amount={ledger.salaries} cost />
      <Line name="Building" amount={ledger.building} cost />
      <Line name="Training" amount={ledger.training} cost />
      <Line name="Marketing" amount={ledger.marketing} cost />
      <Line name="Loan interest" amount={ledger.interest} cost />
      <div class="total">
        <span>Net</span>
        <b class={net < 0 ? 'neg' : 'pos'}>{money(net)}</b>
      </div>
    </div>
  );
}

/** This month and last, the monthly net chart, and the running totals. */
function Books() {
  const { sim } = useGame();
  const s = sim.s;
  const heights = barHeights(s.history);
  return (
    <>
      <div class="ledgers">
        <LedgerTable title="This month" ledger={s.ledger} />
        <LedgerTable title="Last month" ledger={s.lastLedger} />
      </div>
      {heights.length > 0 && (
        <>
          <div class="chart">
            {heights.map((height, i) => {
              const value = s.history[i] ?? 0;
              return (
                <i key={i} class={value < 0 ? 'neg' : ''} style={{ height: `${height}px` }} title={money(value)} />
              );
            })}
          </div>
          <p class="sub">Monthly net, oldest to newest</p>
        </>
      )}{' '}
      <p class="sub">
        {`Healed ${s.stats.healed} · Failed ${s.stats.failed} · Stormed out ${s.stats.stormed} · Put off by prices ${s.stats.priced} · Sent home ${s.stats.sent} · Salaries are paid at the end of each month. More in Stats.`}
      </p>
    </>
  );
}

/** The overall price level, then each treatment's own price on top of it. */
function Prices() {
  const { sim } = useGame();
  const s = sim.s;
  return (
    <>
      <div class="ledger price-level">
        <h4>{`Overall: ${Math.round(s.priceLevel * 100)}% of standard`}</h4>
        <p class="sub">Higher prices earn more per guest, but build reputation more slowly and some guests walk out.</p>
        <p class="priced">
          {`Put off by prices: ${s.tally.priced} this month, ${s.months.at(-1)?.priced ?? 0} last month`}
        </p>
        <div class="btnrow left">
          <Button
            locked={s.priceLevel <= PRICE_MIN}
            onPress={() => {
              sim.setPrice(s.priceLevel - 0.1);
            }}
          >
            −10%
          </Button>
          <Button
            locked={s.priceLevel >= PRICE_MAX}
            onPress={() => {
              sim.setPrice(s.priceLevel + 0.1);
            }}
          >
            +10%
          </Button>
        </div>
      </div>
      <TechniquePrices />
    </>
  );
}

/** The loan: what is owed, what it costs, and borrowing or repaying a step of it. */
function Loan() {
  const { sim, audio } = useGame();
  const s = sim.s;
  return (
    <div class="ledger">
      <h4>{`Loan: ${money(s.loan)} of ${money(LOAN_MAX)}`}</h4>
      <p class="sub">
        {`Costs ${(LOAN_RATE * 100).toFixed(0)}% interest a month, currently ${money(s.loan * LOAN_RATE)}.`}
      </p>
      <div class="btnrow left">
        <Button
          quiet
          locked={s.loan + LOAN_STEP > LOAN_MAX}
          onPress={() => {
            if (!sim.borrow()) audio.play('error');
          }}
        >
          {`Borrow ${money(LOAN_STEP)}`}
        </Button>
        <Button
          quiet
          locked={s.loan <= 0 || s.money <= 0}
          onPress={() => {
            if (!sim.repay()) audio.play('error');
          }}
        >
          {`Repay ${money(LOAN_STEP)}`}
        </Button>
      </div>
    </div>
  );
}

/** The Money menu's tabs, in order. */
const TABS: readonly { id: MoneyTab; name: string }[] = [
  { id: 'books', name: '📒 Books' },
  { id: 'prices', name: '🏷️ Prices' },
  { id: 'marketing', name: '📣 Marketing' },
  { id: 'loan', name: '🏦 Loan' },
];

/** A tab for the books, prices, marketing and the loan, and the one chosen. */
export function MoneyMenu() {
  const hud = useHud();
  return (
    <div class="panel menu money-menu">
      <h3>Money</h3>
      <div class="tabs">
        {TABS.map((t) => (
          <Button
            key={t.id}
            class={cx('tab', hud.moneyTab === t.id && 'on')}
            onPress={() => {
              hud.moneyTab = t.id;
            }}
          >
            {t.name}
          </Button>
        ))}
      </div>
      {hud.moneyTab === 'books' && <Books />}
      {hud.moneyTab === 'prices' && <Prices />}
      {hud.moneyTab === 'marketing' && <MarketingTab />}
      {hud.moneyTab === 'loan' && <Loan />}
    </div>
  );
}
