// Top center: an emergency waiting to be accepted or declined, which can be put aside to decide on later.

import './EmergencyOffer.css';

import { conditionOf, EMERGENCY_DAYS, modalityLabel } from '../../core/data';
import { money } from '../../core/format';
import { useGame, useHud } from '../hooks/use-hud';
import { offerTimeLeft, timeLeftLabel } from '../lib/emergency';
import { Bar } from './common/Bar';
import { Button } from './common/Button';
import { HouseCallOffer } from './HouseCallOffer';
import { OutbreakOffer } from './OutbreakOffer';

/** The offers waiting on an answer, an emergency and a stress outbreak over a house call, in one column. */
export function EmergencyOffer() {
  return (
    <div id="offer">
      <Emergency />
      <OutbreakOffer />
      <HouseCallOffer />
    </div>
  );
}

/** The emergency on offer: in full with Accept and Decline, or tucked away as a button showing the time left. */
function Emergency() {
  const hud = useHud();
  const { sim } = useGame();
  const offer = sim.s.offer;
  if (!offer) return null;
  const condition = conditionOf(offer.condition);
  const left = offerTimeLeft(offer.deadline, sim.s.day);
  const timer = <Bar value={left.share * 100} class={left.share < 0.3 ? 'thin bad' : 'thin need'} />;
  if (hud.offerAside === offer.deadline)
    return (
      <>
        <Button
          class="panel offer-pill"
          title="Show the emergency"
          onPress={() => {
            hud.offerAside = null;
          }}
        >
          <span>{`🚨 Emergency on offer: ${timeLeftLabel(left.days)} to decide`}</span>
          {timer}
        </Button>
      </>
    );
  return (
    <>
      <div class="panel offer">
        <Button
          class="later"
          title="Decide later"
          onPress={() => {
            hud.offerAside = offer.deadline;
          }}
        >
          ✕
        </Button>
        <h3>🚨 Emergency</h3>
        <p>
          {`${offer.cause} `}
          <b>{`${offer.total} guests`}</b> with <b>{condition.name}</b>
          {` need ${modalityLabel(condition.modality)}.`}
        </p>{' '}
        <p class="sub">
          {`Heal ${offer.target} of them within ${EMERGENCY_DAYS} days for a `}
          <b>{money(offer.reward)}</b>
          {' bonus. Fail and your reputation suffers.'}
        </p>
        <div class="time-left">
          <span>{`Offer lapses: ${timeLeftLabel(left.days)}`}</span>
          {timer}
        </div>
        <div class="btnrow">
          <Button
            class="go"
            onPress={() => {
              sim.acceptEmergency();
            }}
          >
            Accept
          </Button>
          <Button
            onPress={() => {
              sim.declineEmergency();
            }}
          >
            Decline
          </Button>
        </div>
      </div>
    </>
  );
}
