// Top center, under any emergency: a stress outbreak on offer, which can be put aside to decide on later.

import { track } from '../../app/analytics';
import { gameProps } from '../../app/play-events';
import { OUTBREAK_DAYS } from '../../core/data';
import { money } from '../../core/format';
import { useGame, useHud } from '../hooks/use-hud';
import { offerTimeLeft, timeLeftLabel } from '../lib/emergency';
import { Bar } from './common/Bar';
import { Button } from './common/Button';

/** The stress outbreak on offer: in full with Accept and Decline, or tucked away as a button showing the time left. */
export function OutbreakOffer() {
  const hud = useHud();
  const { sim } = useGame();
  const offer = sim.s.outbreakOffer;
  if (!offer) return null;
  const left = offerTimeLeft(offer.deadline, sim.s.day);
  const timer = <Bar value={left.share * 100} class={left.share < 0.3 ? 'thin bad' : 'thin need'} />;
  if (hud.outbreakAside === offer.deadline)
    return (
      <Button
        class="panel offer-pill outbreak-pill"
        title="Show the stress outbreak"
        onPress={() => {
          hud.outbreakAside = null;
        }}
      >
        <span>{`😰 Stress outbreak on offer: ${timeLeftLabel(left.days)} to decide`}</span>
        {timer}
      </Button>
    );
  return (
    <div class="panel offer outbreak">
      <Button
        class="later"
        title="Decide later"
        onPress={() => {
          hud.outbreakAside = offer.deadline;
        }}
      >
        ✕
      </Button>
      <h3>😰 Stress outbreak</h3>
      <p>
        {`${offer.cause} `}
        <b>{`${offer.seed} stressed guests`}</b>
        {' are on their way, and stress spreads to anyone waiting close by.'}
      </p>{' '}
      <p class="sub">
        {`You get ${offer.calms} calming sessions to hand out: spot the stressed by their sweating and fidgeting, click them, and calm them. If no more than ${offer.lostMax} leave still stressed within ${OUTBREAK_DAYS} days, it pays a `}
        <b>{money(offer.reward)}</b>
        {' bonus. More, and your reputation suffers.'}
      </p>
      <div class="time-left">
        <span>{`Offer lapses: ${timeLeftLabel(left.days)}`}</span>
        {timer}
      </div>
      <div class="btnrow">
        <Button
          class="go"
          onPress={() => {
            sim.acceptOutbreak();
            track('offer_answered', { ...gameProps(sim.s), offer: 'outbreak', answer: 'accepted' });
          }}
        >
          Accept
        </Button>
        <Button
          onPress={() => {
            sim.declineOutbreak();
            track('offer_answered', { ...gameProps(sim.s), offer: 'outbreak', answer: 'declined' });
          }}
        >
          Decline
        </Button>
      </div>
    </div>
  );
}
