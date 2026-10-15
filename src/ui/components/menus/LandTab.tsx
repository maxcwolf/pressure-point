// The Money menu's Land tab: the plots next to the building that are for sale, to grow it into.

import { LAND_STAR } from '../../../core/data';
import { money } from '../../../core/format';
import { useGame, useHud } from '../../hooks/use-hud';
import { LAND_NAMES, landSize } from '../../lib/land';
import { Button } from '../common/Button';

/** A card for each plot of land for sale, outlined on the ground while the tab is open. */
export function LandTab() {
  const { sim, audio } = useGame();
  const hud = useHud();
  const s = sim.s;
  if (!sim.landForSale())
    return <p class="sub">{`Land next to the building comes up for sale at star ${LAND_STAR}.`}</p>;
  const offers = sim.landOffers();
  return (
    <>
      <p class="sub">
        Grow the building into the land next door. The plots for sale are outlined on the ground. The front stays on the
        street, so the building can grow to the sides and the back.
      </p>
      {offers.length === 0 && <p class="sub">The building fills its whole lot. There is no more land to buy.</p>}
      {offers.map((o) => (
        <div
          key={o.side}
          class="ledger land"
          onPointerEnter={() => {
            hud.landPointedAt = o.side;
          }}
          onPointerLeave={() => {
            if (hud.landPointedAt === o.side) hud.landPointedAt = null;
          }}
        >
          <span>
            <h4>{LAND_NAMES[o.side]}</h4>
            <span class="sub">{`${landSize(o)} of lawn`}</span>
          </span>
          <Button
            quiet
            locked={s.money < o.price}
            onPress={() => {
              if (sim.buyLand(o.side)) hud.landPointedAt = null;
              else audio.play('error');
            }}
          >
            {`Buy for ${money(o.price)}`}
          </Button>
        </div>
      ))}
    </>
  );
}
