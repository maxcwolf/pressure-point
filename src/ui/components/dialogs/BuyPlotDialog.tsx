// Asking before buying a plot of land, once it is clicked with the Expand tool. The game waits meanwhile.

import { money } from '../../../core/format';
import { nameInSentence } from '../../../core/land';
import { buttonRow } from '../../../styled-system/recipes';
import { useGame, useHud } from '../../hooks/use-hud';
import { afterBuying, plotSize } from '../../lib/land';
import { Button } from '../common/Button';
import { Dialog } from './Dialog';

/** The plot asked about, what it is and what it costs, with a button to buy it. */
export function BuyPlotDialog() {
  const hud = useHud();
  const { sim, tools, audio } = useGame();
  const offer = sim.landOffers().find((o) => o.def.id === hud.plotAsked);
  if (offer?.state !== 'open') {
    // bought or gone meanwhile: nothing left to ask
    return (
      <Dialog>
        <h2>No longer for sale</h2>
        <div class={buttonRow()}>
          <Button
            onPress={() => {
              hud.close();
            }}
          >
            OK
          </Button>
        </div>
      </Dialog>
    );
  }
  const { def, price } = offer;
  const short = sim.s.money < price;
  return (
    <Dialog>
      <h2>{`Buy ${nameInSentence(def.name)}?`}</h2>
      <p>{`${def.blurb}. ${plotSize(def)} for ${money(price)}. ${afterBuying(def)}`}</p>
      {short && <p class="sub">{`You have ${money(sim.s.money)}.`}</p>}{' '}
      <div class={buttonRow()}>
        <Button
          onPress={() => {
            hud.close();
          }}
        >
          Not now
        </Button>
        <Button
          locked={short}
          onPress={() => {
            if (!sim.buyPlot(def.id)) {
              audio.play('error');
              return;
            }
            hud.plotAsked = null;
            tools.cancel();
            hud.close();
          }}
        >
          {`Buy for ${money(price)}`}
        </Button>
      </div>
    </Dialog>
  );
}
