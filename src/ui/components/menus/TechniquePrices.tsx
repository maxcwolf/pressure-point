// The Money menu's prices for each treatment, on top of the overall level.

import {
  CLASS_FEE,
  DISCIPLINE_ORDER,
  MODALITIES,
  MODALITY_ORDER,
  PRICE_MAX,
  PRICE_MIN,
  ROOMS,
} from '../../../core/data';
import { money } from '../../../core/format';
import { unlockedUpTo } from '../../../core/state/game';
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
  // a place in a class has its price too, once a studio can be built
  const classes = sim.enabled('qigong') && unlockedUpTo(s) >= (ROOMS.qigong.unlock ?? 0);
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
      {classes && <ClassPrice />}
    </div>
  );
}

/** The price of a place in a Qi Gong class, on top of the overall level, and how many have come to one. */
function ClassPrice() {
  const { sim } = useGame();
  const own = sim.s.prices.qigong ?? 1;
  return (
    <div class="technique-price">
      <span>{`☯️ Qi Gong class (${money(Math.round(CLASS_FEE * sim.priceFor('qigong')))})`}</span>
      <small>{`${sim.s.stats.classgoers} class-goers so far`}</small>
      <Button
        locked={own <= PRICE_MIN}
        onPress={() => {
          sim.setTechniquePrice('qigong', own - 0.1);
        }}
      >
        −
      </Button>
      <b title={`${Math.round(sim.priceFor('qigong') * 100)}% of standard, all told`}>{`${Math.round(own * 100)}%`}</b>
      <Button
        locked={own >= PRICE_MAX}
        onPress={() => {
          sim.setTechniquePrice('qigong', own + 0.1);
        }}
      >
        +
      </Button>
    </div>
  );
}
