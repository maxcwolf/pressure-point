// The Money menu's Land tab: the center's plots of land, which are the game's, which are for sale and for how much, and
// a way to go and look at each in the world, where the Expand tool buys it.

import { money } from '../../../core/format';
import { useGame, useHud } from '../../hooks/use-hud';
import { plotMiddle, plotSize } from '../../lib/land';
import { Button } from '../common/Button';

/** A card for each of the center's plots, outlined on the ground while the tab is open. */
export function LandTab() {
  const { sim, tools, view } = useGame();
  const hud = useHud();
  const offers = sim.landOffers();
  if (!offers.length) return <p class="sub">There is no land for sale around this building.</p>;
  return (
    <>
      <p class="sub">
        Grow the building into the land around it. Each plot has a For Sale board on it: press 🏡 Expand, or Show me
        here, then click a plot to buy it.
      </p>
      {offers.map((o) => (
        <div
          key={o.def.id}
          class="ledger land"
          onPointerEnter={() => {
            hud.landPointedAt = o.def.id;
          }}
          onPointerLeave={() => {
            if (hud.landPointedAt === o.def.id) hud.landPointedAt = null;
          }}
        >
          <span>
            <h4>{o.def.name}</h4>
            <span class="sub">
              {o.state === 'owned'
                ? `${plotSize(o.def)} · yours`
                : `${o.def.blurb} · ${plotSize(o.def)} · ${money(o.price)}${o.why ? ` · ${o.why}` : ''}`}
            </span>
          </span>
          {o.state !== 'owned' && (
            <Button
              quiet
              onPress={() => {
                hud.landPointedAt = null;
                hud.closeMenu();
                tools.startExpand(o.def.id);
                view.lookAt(...plotMiddle(o.def));
              }}
            >
              Show me
            </Button>
          )}
        </div>
      ))}
    </>
  );
}
