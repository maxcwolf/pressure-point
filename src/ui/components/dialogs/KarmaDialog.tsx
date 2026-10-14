// Unlocking a locked item for good with karma.

import './KarmaDialog.css';

import { cannotBuy, karmaLeft } from '../../../core/campaign';
import { ITEMS } from '../../../core/data';
import { buyWithKarma, loadCampaign } from '../../../storage/campaign';
import { useHud } from '../../hooks/use-hud';
import { karmaText } from '../../lib/karma';
import { Button } from '../common/Button';
import { Dialog } from './Dialog';

/** The price of the item asked about, the karma there is to spend, and a way to unlock it if there is enough. */
export function KarmaDialog() {
  const hud = useHud();
  const type = hud.karmaItem;
  if (!type) return null;
  const def = ITEMS[type];
  const progress = loadCampaign();
  const short = cannotBuy(progress, type) === 'short';
  const price = karmaText(def.karma ?? 0);
  return (
    <Dialog>
      <div class="bigicon">{def.icon}</div>
      <h2>{`Unlock the ${def.name}?`}</h2>
      <p>
        {def.unlock === undefined
          ? `Only karma unlocks it. It costs ${price}.`
          : `It unlocks at star ${def.unlock} in each center, or now and for good for ${price}.`}{' '}
        Once unlocked, it can be built in every center and in the sandbox.
      </p>
      <p class="sub">
        {`You have ${karmaText(karmaLeft(progress))}. `}
        {short ? 'Earn more with stars and achievements in the campaign.' : ''}
      </p>
      <div class="btnrow">
        <Button
          onPress={() => {
            hud.close();
          }}
        >
          {short ? 'OK' : 'Not now'}
        </Button>
        {!short && (
          <Button
            class="go"
            quiet
            onPress={() => {
              if (buyWithKarma(type)) {
                hud.host.audio.play('cash');
                hud.toast(`${def.icon} ${def.name} unlocked for good.`, 'good');
              }
              hud.close();
            }}
          >
            {`Unlock for ${price}`}
          </Button>
        )}
      </div>
    </Dialog>
  );
}
