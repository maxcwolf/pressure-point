// The Money menu: the books, the payroll outlook, prices (overall and per treatment), marketing, the loan, and land, a tab each.

import './MoneyMenu.css';

import { type IconId, LOAN_RATE, LOAN_STEP, PRICE_MAX, PRICE_MIN } from '../../../core/data';
import { money } from '../../../core/format';
import { loanLimit } from '../../../core/sim/economy';
import { netOf } from '../../../core/sim/economy';
import { guestCap, INTAKE_CAP_MIN } from '../../../core/sim/guests';
import type { Ledger } from '../../../core/state/types';
import { useGame, useHud } from '../../hooks/use-hud';
import type { MoneyTab } from '../../hud';
import { barHeights } from '../../lib/chart';
import { cx } from '../../lib/cx';
import { incomeSources, incomeVerdict, shareWord } from '../../lib/income';
import { BALK_WHO, balkText } from '../../lib/prices';
import { Button } from '../common/Button';
import { IconText } from '../common/Icon';
import { LandTab } from './LandTab';
import { MarketingTab } from './MarketingTab';
import { PayrollTab } from './PayrollTab';
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
      <Line name="Qi Gong classes" amount={ledger.classes} />
      <Line name="Tea &amp; snacks" amount={ledger.vending} />
      <Line name="Shop sales" amount={ledger.shop} />
      {ledger.mushrooms > 0 && <Line name="Under the counter" amount={ledger.mushrooms} />}
      <Line name="House calls" amount={ledger.calls} />
      <Line name="Bonuses and prizes" amount={ledger.bonus} />
      <Line name="Salaries" amount={ledger.salaries} cost />
      <Line name="Building" amount={ledger.building} cost />
      {ledger.upkeep > 0 && <Line name="Machine upkeep" amount={ledger.upkeep} cost />}
      <Line name="Training" amount={ledger.training} cost />
      <Line name="Marketing" amount={ledger.marketing} cost />
      <Line name="Loan interest" amount={ledger.interest} cost />
      <Line name="Fines" amount={ledger.fines} cost />
      <div class="total">
        <span>Net</span>
        <b class={net < 0 ? 'neg' : 'pos'}>{money(net)}</b>
      </div>
    </div>
  );
}

/** Where the money comes from: each source's take this month and last, with its share of this month's income. */
function IncomeSources() {
  const { sim } = useGame();
  const s = sim.s;
  const rows = incomeSources(s.ledger, s.lastLedger);
  const verdict = incomeVerdict(s.ledger);
  return (
    <div class="ledger sources">
      <h4>Where the money comes from</h4>
      <div class="head">
        <span>Source</span>
        <b>This month</b>
        <b>Last month</b>
      </div>
      {rows.map((r) => (
        <div key={r.id} class={cx('source', r.healing ? 'healing' : 'side')}>
          <span>{r.name}</span>
          <b>{`${money(r.now)} · ${shareWord(r.share)}`}</b>
          <b>{money(r.last)}</b>
        </div>
      ))}
      {verdict && <p class="sub">{verdict}</p>}
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
      <IncomeSources />
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
        {`Healed ${s.stats.healed} · Failed ${s.stats.failed} · Stormed out ${s.stats.stormed} · Put off by prices ${s.stats.priced} · Sent home ${s.stats.sent} · Got worse ${s.stats.worse} · Found it full ${s.stats.turnedAway} · Salaries are paid at the end of each month. More in Stats.`}
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
        <p class="balk">{`${balkText(s.priceLevel, s.reputation)} ${BALK_WHO}`}</p>
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
      <IntakeCap />
    </>
  );
}

/** A limit of the player's own on guests at once, below what the building allows: a throttle for a busy season. */
function IntakeCap() {
  const { sim } = useGame();
  const s = sim.s;
  const cap = s.intakeCap;
  const building = guestCap(s);
  return (
    <div class="ledger intake-cap">
      <h4>
        {cap === null
          ? `Guests at once: no limit of your own (the building takes ${building})`
          : `Guests at once: ${cap} of the ${building} the building takes`}
      </h4>
      <p class="sub">
        Guests who find the center full go elsewhere, and their fees with them. A way to keep a summer's crowd to what
        your tables can treat, so nobody waits long enough to go home worse off.
      </p>
      <div class="btnrow left">
        <Button
          locked={cap !== null && cap <= INTAKE_CAP_MIN}
          onPress={() => {
            sim.setIntakeCap((cap ?? building) - 2);
          }}
        >
          −2
        </Button>
        <Button
          locked={cap === null}
          onPress={() => {
            sim.setIntakeCap(cap === null ? null : cap + 2);
          }}
        >
          +2
        </Button>
        <Button
          quiet
          locked={cap === null}
          onPress={() => {
            sim.setIntakeCap(null);
          }}
        >
          No limit
        </Button>
      </div>
    </div>
  );
}

/** The loan: what is owed, what it costs, and borrowing or repaying a step of it. */
function Loan() {
  const { sim, audio } = useGame();
  const s = sim.s;
  return (
    <div class="ledger">
      <h4>{`Loan: ${money(s.loan)} of ${money(loanLimit(s))}`}</h4>
      <p class="sub">
        {`Costs ${(LOAN_RATE * 100).toFixed(0)}% interest a month, currently ${money(s.loan * LOAN_RATE)}.`}
      </p>
      <div class="btnrow left">
        <Button
          quiet
          locked={s.loan + LOAN_STEP > loanLimit(s)}
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
const TABS: readonly { id: MoneyTab; icon: IconId; name: string }[] = [
  { id: 'books', icon: 'ui-books', name: 'Books' },
  { id: 'payroll', icon: 'ui-wages', name: 'Payroll' },
  { id: 'prices', icon: 'ui-prices', name: 'Prices' },
  { id: 'marketing', icon: 'ui-marketing', name: 'Marketing' },
  { id: 'loan', icon: 'ui-loan', name: 'Loan' },
  { id: 'land', icon: 'ui-expand', name: 'Land' },
];

/** A tab for the books, prices, marketing, the loan and land, and the one chosen. */
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
            <IconText id={t.icon}>{t.name}</IconText>
          </Button>
        ))}
      </div>
      {hud.moneyTab === 'books' && <Books />}
      {hud.moneyTab === 'payroll' && <PayrollTab />}
      {hud.moneyTab === 'prices' && <Prices />}
      {hud.moneyTab === 'marketing' && <MarketingTab />}
      {hud.moneyTab === 'loan' && <Loan />}
      {hud.moneyTab === 'land' && <LandTab />}
    </div>
  );
}
