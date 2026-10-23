// Top center: an emergency waiting to be accepted or declined, which can be put aside to decide on later.

import './EmergencyOffer.css';

import { useRef } from 'preact/hooks';

import { answerOffer } from '../../app/analytics';
import { conditionOf, EMERGENCY_DAYS, modalityLabel } from '../../core/data';
import { money } from '../../core/format';
import type { Sim } from '../../core/sim/sim';
import { useGame, useHud } from '../hooks/use-hud';
import { offerTimeLeft, timeLeftLabel } from '../lib/emergency';
import { Bar } from './common/Bar';
import { Button } from './common/Button';
import { IconText } from './common/Icon';
import { HarmNotice } from './HarmNotice';
import { HouseCallOffer } from './HouseCallOffer';
import { MishapNotice } from './MishapNotice';
import { OutbreakOffer } from './OutbreakOffer';
import { RunnerNotice } from './RunnerNotice';

/** What the column at the top can show, in the order they go when several are there at once. */
const PARTS = {
  runner: RunnerNotice,
  emergency: Emergency,
  outbreak: OutbreakOffer,
  call: HouseCallOffer,
  mishap: MishapNotice,
  harm: HarmNotice,
} as const;
type Part = keyof typeof PARTS;

/** Which parts of the column have something to show. */
function present(s: Sim['s']): Part[] {
  const there: Record<Part, boolean> = {
    runner: s.guests.some((g) => g.state === 'running'),
    emergency: s.offer !== null,
    outbreak: s.outbreakOffer !== null,
    call: s.callOffer !== null,
    mishap: s.mishap !== null,
    harm: s.harmNotes.length > 0,
  };
  return (Object.keys(PARTS) as Part[]).filter((p) => there[p]);
}

/**
 * The offers waiting on an answer, an emergency, a stress outbreak and a house call, any mishap, why harm keeps coming
 * to guests, and anyone running round on a really bad trip, in one column. Each new one goes below those already there,
 * so nothing moves an open offer's buttons out from under the pointer.
 */
export function EmergencyOffer() {
  const { sim } = useGame();
  const order = useRef<Part[]>([]);
  const now = present(sim.s);
  order.current = [...order.current.filter((p) => now.includes(p)), ...now.filter((p) => !order.current.includes(p))];
  return (
    <div id="offer">
      {order.current.map((p) => {
        const Shown = PARTS[p];
        return <Shown key={p} />;
      })}
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
          <span>
            <IconText id="ui-emergency">{`Emergency on offer: ${timeLeftLabel(left.days)} to decide`}</IconText>
          </span>
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
        <h3>
          <IconText id="ui-emergency">Emergency</IconText>
        </h3>
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
              const offer = sim.s.offer;
              sim.acceptEmergency();
              answerOffer(sim.s, offer, 'emergency', 'accepted');
            }}
          >
            Accept
          </Button>
          <Button
            onPress={() => {
              const offer = sim.s.offer;
              sim.declineEmergency();
              answerOffer(sim.s, offer, 'emergency', 'declined');
            }}
          >
            Decline
          </Button>
        </div>
      </div>
    </>
  );
}
