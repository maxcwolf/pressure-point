// Top center, under any emergency: a stress outbreak on offer, which can be put aside to decide on later.

import { answerOffer } from '../../app/analytics';
import { OUTBREAK_DAYS } from '../../core/data';
import { money } from '../../core/format';
import { css } from '../../styled-system/css';
import { buttonRow, goButton, panelCard } from '../../styled-system/recipes';
import { useGame, useHud } from '../hooks/use-hud';
import { cx } from '../lib/cx';
import { offerTimeLeft, timeLeftLabel } from '../lib/emergency';
import { Bar } from './common/Bar';
import { Button } from './common/Button';
import { IconText } from './common/Icon';

/** A stress outbreak's panel, in purple; it takes an offer's look from the column it is in (EmergencyOffer.tsx). */
const outbreakColor = css({ borderColor: '[#8a6fd1]' });

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
        class={cx(panelCard(), 'offer-pill', outbreakColor)}
        title="Show the stress outbreak"
        onPress={() => {
          hud.outbreakAside = null;
        }}
      >
        <span>
          <IconText id="bubble-stressed">{`Stress outbreak on offer: ${timeLeftLabel(left.days)} to decide`}</IconText>
        </span>
        {timer}
      </Button>
    );
  return (
    <div class={cx(panelCard(), 'offer', outbreakColor)}>
      <Button
        class="later"
        title="Decide later"
        onPress={() => {
          hud.outbreakAside = offer.deadline;
        }}
      >
        ✕
      </Button>
      <h3>
        <IconText id="bubble-stressed">Stress outbreak</IconText>
      </h3>
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
      <div class={buttonRow()}>
        <Button
          class={goButton()}
          onPress={() => {
            const offer = sim.s.outbreakOffer;
            sim.acceptOutbreak();
            answerOffer(sim.s, offer, 'outbreak', 'accepted');
          }}
        >
          Accept
        </Button>
        <Button
          onPress={() => {
            const offer = sim.s.outbreakOffer;
            sim.declineOutbreak();
            answerOffer(sim.s, offer, 'outbreak', 'declined');
          }}
        >
          Decline
        </Button>
      </div>
    </div>
  );
}
