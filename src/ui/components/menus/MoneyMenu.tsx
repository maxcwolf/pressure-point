// The Money menu: this month and last, prices, the loan and the monthly net chart.

import './MoneyMenu.css';

import { LOAN_MAX, LOAN_RATE, LOAN_STEP, PRICE_MAX, PRICE_MIN } from '../../../core/data';
import { money } from '../../../core/format';
import { netOf } from '../../../core/sim/economy';
import type { Ledger } from '../../../core/state/types';
import { useGame } from '../../hooks/use-hud';
import { barHeights } from '../../lib/chart';
import { Button } from '../common/Button';

/** One month's income and costs. */
function LedgerTable({ title, ledger }: { title: string; ledger: Ledger }) {
  const net = netOf(ledger);
  return (
    <div class="ledger">
      <h4>{title}</h4>
      <div>
        <span>Consultations</span>
        <b class="pos">{money(ledger.consult)}</b>
      </div>
      <div>
        <span>Treatments</span>
        <b class="pos">{money(ledger.treatment)}</b>
      </div>
      <div>
        <span>Tea &amp; snacks</span>
        <b class="pos">{money(ledger.vending)}</b>
      </div>
      <div>
        <span>Salaries</span>
        <b class="neg">{money(-ledger.salaries)}</b>
      </div>
      <div>
        <span>Building</span>
        <b class="neg">{money(-ledger.building)}</b>
      </div>
      <div>
        <span>Emergency bonuses</span>
        <b class="pos">{money(ledger.bonus)}</b>
      </div>
      <div>
        <span>Training</span>
        <b class="neg">{money(-ledger.training)}</b>
      </div>
      <div>
        <span>Loan interest</span>
        <b class="neg">{money(-ledger.interest)}</b>
      </div>
      <div class="total">
        <span>Net</span>
        <b class={net < 0 ? 'neg' : 'pos'}>{money(net)}</b>
      </div>
    </div>
  );
}

/** The books, with the price and loan controls. */
export function MoneyMenu() {
  const { sim, audio } = useGame();
  const s = sim.s;
  const heights = barHeights(s.history);
  return (
    <div class="panel menu">
      <h3>Money</h3>
      <div class="ledgers">
        <LedgerTable title="This month" ledger={s.ledger} />
        <LedgerTable title="Last month" ledger={s.lastLedger} />
      </div>
      <div class="ledgers controls">
        <div class="ledger">
          <h4>{`Prices: ${Math.round(s.priceLevel * 100)}% of standard`}</h4>
          <p class="sub">
            Higher prices earn more per guest, but build reputation more slowly and some guests walk out.
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
        </div>{' '}
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
        {`Healed ${s.stats.healed} · Failed ${s.stats.failed} · Stormed out ${s.stats.stormed} · Salaries are paid at the end of each month.`}
      </p>
    </div>
  );
}
