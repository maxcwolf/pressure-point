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
import { IconText } from '../common/Icon';

/** Why a price cannot go higher. */
const TOP_NOTE = 'Overall level and this price together are at the highest a price can be.';

/** Whether the overall level and a technique's own price together are as high as a price can go. */
const atTop = (level: number, own: number) => own >= PRICE_MAX || level * own >= PRICE_MAX - 1e-6;

/** A technique's own price, with what it comes to all told once the overall level is in, when that differs. */
function PriceFigure({ own, total }: { own: number; total: number }) {
  const all = Math.round(total * 100);
  const mine = Math.round(own * 100);
  return (
    <b title={`${all}% of standard, all told`}>
      {`${mine}%`}
      {all !== mine && <small>{` → ${all}%`}</small>}
    </b>
  );
}

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
            <span>
              <IconText id={def.icon}>{def.name}</IconText>
            </span>
            <small>{`${pricedFor(s.casebook, m)} put off so far`}</small>
            <Button
              locked={own <= PRICE_MIN}
              onPress={() => {
                sim.setTechniquePrice(m, own - 0.1);
              }}
            >
              −
            </Button>
            <PriceFigure own={own} total={sim.priceFor(m)} />
            <Button
              locked={atTop(s.priceLevel, own)}
              title={atTop(s.priceLevel, own) ? TOP_NOTE : undefined}
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
      <span>
        <IconText id="technique-qigong">{`Qi Gong class (${money(Math.round(CLASS_FEE * sim.priceFor('qigong')))})`}</IconText>
      </span>
      <small>{`${sim.s.stats.classgoers} class-goers so far`}</small>
      <Button
        locked={own <= PRICE_MIN}
        onPress={() => {
          sim.setTechniquePrice('qigong', own - 0.1);
        }}
      >
        −
      </Button>
      <PriceFigure own={own} total={sim.priceFor('qigong')} />
      <Button
        locked={atTop(sim.s.priceLevel, own)}
        title={atTop(sim.s.priceLevel, own) ? TOP_NOTE : undefined}
        onPress={() => {
          sim.setTechniquePrice('qigong', own + 0.1);
        }}
      >
        +
      </Button>
    </div>
  );
}
