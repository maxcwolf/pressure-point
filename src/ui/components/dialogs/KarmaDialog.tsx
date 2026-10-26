// Unlocking a locked item, floor or walls for good with karma.

import { cannotBuy, cannotBuyDecor, karmaLeft } from '../../../core/campaign';
import { decorDef, type DecorKey, decorLabel, type IconId, ITEMS, type ItemType } from '../../../core/data';
import { decorChange } from '../../../core/sim/decor';
import { buyDecorWithKarma, buyWithKarma, loadCampaign } from '../../../storage/campaign';
import { Box } from '../../../styled-system/jsx';
import { buttonRow, goButton } from '../../../styled-system/recipes';
import { useGame, useHud } from '../../hooks/use-hud';
import { karmaText } from '../../lib/karma';
import { Button } from '../common/Button';
import { Icon, IconText } from '../common/Icon';
import { Dialog } from './Dialog';

/** What is on offer, in the dialog's words, and how to unlock it. */
interface Offer {
  icon: IconId;
  title: string;
  /** What unlocks it, and where it can be used once it is. */
  about: string;
  /** Why it cannot be unlocked now, if it cannot. */
  short: boolean;
  price: string;
  /** Unlock it, and say so. False if it could not be. */
  buy: () => boolean;
  done: string;
}

/** The offer for a locked item. */
function itemOffer(type: ItemType): Offer {
  const def = ITEMS[type];
  const price = karmaText(def.karma ?? 0);
  return {
    icon: def.icon,
    title: `Unlock the ${def.name}?`,
    about: `${
      def.unlock === undefined
        ? `Only karma unlocks it. It costs ${price}.`
        : `It unlocks at star ${def.unlock} in each center, or now and for good for ${price}.`
    } Once unlocked, it can be built in every center and in the sandbox.`,
    short: cannotBuy(loadCampaign(), type) === 'short',
    price,
    /** Unlock the item. */
    buy: () => buyWithKarma(type),
    done: `${def.name} unlocked for good.`,
  };
}

/** The offer for a locked floor or walls. */
function decorOffer(key: DecorKey): Offer {
  const price = karmaText(decorDef(key).karma ?? 0);
  const label = decorLabel(key);
  return {
    icon: 'ui-paint',
    title: `Unlock ${label}?`,
    about: `Only karma unlocks it. It costs ${price}. Once unlocked, it can be used in every center and in the sandbox.`,
    short: cannotBuyDecor(loadCampaign(), key) === 'short',
    price,
    /** Unlock the floor or walls. */
    buy: () => buyDecorWithKarma(key),
    done: `${label.charAt(0).toUpperCase()}${label.slice(1)} unlocked for good.`,
  };
}

/** The price of what was asked about, the karma there is to spend, and a way to unlock it if there is enough. */
export function KarmaDialog() {
  const hud = useHud();
  const { sim } = useGame();
  const asked = hud.karmaDecor;
  const offer = asked ? decorOffer(asked.key) : hud.karmaItem ? itemOffer(hud.karmaItem) : null;
  if (!offer) return null;
  /** Put a floor or walls just unlocked straight down in the room they were chosen for. */
  const putDown = () => {
    if (asked) sim.decorateRoom(asked.roomId, decorChange(asked.key));
  };
  return (
    <Dialog>
      <Box display="flex" justifyContent="center">
        <Icon id={offer.icon} size={60} />
      </Box>
      <h2>{offer.title}</h2>
      <p>{offer.about}</p>
      <p class="sub">
        <IconText id="ui-karma">{`You have ${karmaText(karmaLeft(loadCampaign()))}.`}</IconText>{' '}
        {offer.short ? 'Earn more with stars and achievements in the campaign.' : ''}
      </p>
      <div class={buttonRow()}>
        <Button
          onPress={() => {
            hud.close();
          }}
        >
          {offer.short ? 'OK' : 'Not now'}
        </Button>
        {!offer.short && (
          <Button
            class={goButton()}
            quiet
            onPress={() => {
              if (offer.buy()) {
                hud.host.audio.play('cash');
                hud.toast(offer.done, 'good', undefined, offer.icon);
                putDown();
              }
              hud.close();
            }}
          >
            {`Unlock for ${offer.price}`}
          </Button>
        )}
      </div>
    </Dialog>
  );
}
