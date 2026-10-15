// The Money menu's prices for each treatment, on top of the overall level.

import { DISCIPLINE_ORDER, MODALITIES, MODALITY_ORDER, PRICE_MAX, PRICE_MIN } from '../../../core/data';
import { useGame } from '../../hooks/use-hud';
import { pricedFor } from '../../lib/casebook';
import { Button } from '../common/Button';

/** A row for each treatment on offer: its own price, what it comes to all told, and how many it has put off. */
export function TechniquePrices() {
  const { sim } = useGame();
  const s = sim.s;
  const techniques = MODALITY_ORDER.filter((m) => {
    const d = MODALITIES[m].discipline;
    return DISCIPLINE_ORDER.includes(d) && sim.enabled(d) && sim.unlocked(m);
  });
  return (
    <div class="ledger technique-prices">
      <h4>Each treatment</h4>
      <p class="sub">
        On top of the overall level: charge more for what is in demand, and keep the everyday treatments cheap.
      </p>
      {techniques.map((m) => {
        const own = s.prices[m] ?? 1;
        const def = MODALITIES[m];
        return (
          <div key={m} class="technique-price">
            <span>{`${def.icon} ${def.name}`}</span>
            <small>{`${pricedFor(s.casebook, m)} put off so far`}</small>
            <Button
              locked={own <= PRICE_MIN}
              onPress={() => {
                sim.setTechniquePrice(m, own - 0.1);
              }}
            >
              −
            </Button>
            <b title={`${Math.round(sim.priceFor(m) * 100)}% of standard, all told`}>{`${Math.round(own * 100)}%`}</b>
            <Button
              locked={own >= PRICE_MAX}
              onPress={() => {
                sim.setTechniquePrice(m, own + 0.1);
              }}
            >
              +
            </Button>
          </div>
        );
      })}
    </div>
  );
}
