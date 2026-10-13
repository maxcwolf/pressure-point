// Top center: an emergency waiting to be accepted or declined.

import './EmergencyOffer.css';

import { conditionOf, MODALITIES } from '../../core/data';
import { money } from '../../core/format';
import { useGame } from '../hooks/use-hud';
import { Button } from './common/Button';

/** The emergency on offer, with Accept and Decline. */
export function EmergencyOffer() {
  const { sim } = useGame();
  const offer = sim.s.offer;
  if (!offer) return <div id="offer" />;
  const condition = conditionOf(offer.condition);
  return (
    <div id="offer">
      <div class="panel offer">
        <h3>🚨 Emergency</h3>
        <p>
          {`${offer.cause} `}
          <b>{`${offer.total} guests`}</b> with <b>{condition.name}</b>
          {` need ${MODALITIES[condition.modality].name} massage.`}
        </p>{' '}
        <p class="sub">
          {`Heal ${offer.target} of them within 25 days for a `}
          <b>{money(offer.reward)}</b>
          {` bonus. Fail and your reputation suffers. Offer lapses in ${Math.max(1, Math.ceil(offer.deadline - sim.s.day))} days.`}
        </p>{' '}
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
    </div>
  );
}
