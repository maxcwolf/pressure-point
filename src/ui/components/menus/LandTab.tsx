// The Money menu's Land tab: the center's plots of land, which are the game's, which are for sale and for how much, and
// a way to go and look at each in the world, where the Expand tool buys it.

import { money } from '../../../core/format';
import type { PlotOffer } from '../../../core/land';
import { useGame, useHud } from '../../hooks/use-hud';
import { daysToGo, plotMiddle, plotSize } from '../../lib/land';
import { Button } from '../common/Button';

/** What a plot's card says under its name: how big it is and whether it is the game's, or what it costs. */
function landLine(o: PlotOffer): string {
  if (o.state === 'owned') return `${plotSize(o.def)} · yours`;
  if (o.state === 'building') return `${plotSize(o.def)} · 🚧 being built on, ${daysToGo(o.daysLeft)}`;
  return `${o.def.blurb} · ${plotSize(o.def)} · ${money(o.price)}${o.why ? ` · ${o.why}` : ''}`;
}

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
        here, then click a plot to buy it. The builders take a few days over each before the building grows into it.
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
            <h4>{o.name}</h4>
            <span class="sub">{landLine(o)}</span>
          </span>
          <Button
            quiet
            onPress={() => {
              hud.landPointedAt = null;
              hud.closeMenu();
              // a plot of the game's opens in the inspector; the rest are shown with the Expand tool, to buy
              if (o.state === 'owned' || o.state === 'building') tools.select({ kind: 'plot', id: o.def.id });
              else tools.startExpand(o.def.id);
              view.lookAt(...plotMiddle(o.def));
            }}
          >
            Show me
          </Button>
        </div>
      ))}
    </>
  );
}
