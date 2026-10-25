// Top center, under any emergency: a house call on offer, with who could go, what each would earn and who would wait
// for them at home, which can be put aside to decide on later.

import { answerOffer } from '../../app/analytics';
import { CALL_OFFER_DAYS } from '../../core/data';
import { an, money } from '../../core/format';
import { callWants } from '../../core/sim/calls';
import { rankName } from '../../core/sim/careers';
import { css } from '../../styled-system/css';
import { buttonRow, dangerButton, goButton, panelCard } from '../../styled-system/recipes';
import { useGame, useHud } from '../hooks/use-hud';
import { callCostNote } from '../lib/calls';
import { cx } from '../lib/cx';
import { offerTimeLeft, timeLeftLabel } from '../lib/emergency';
import { Bar } from './common/Bar';
import { Button } from './common/Button';
import { IconText, Line } from './common/Icon';

/**
 * A house call's panel, in blue; it takes the look of an offer from the column it is in (EmergencyOffer.tsx). `call` is
 * for the end-to-end tests to find it by.
 */
const callColor = css({ borderColor: 'blue' });

/** Who could go, a button each, one under another. */
const whoList = css({ display: 'flex', flexDirection: 'column', gap: '4', mt: '8' });

/** A button to send someone, in smaller words than usual. */
const send = css({ fontSize: '13' });

/** What sending them would cost, on a fainter line under their name. */
const sendCost = css({ display: 'block', fontSize: '12', opacity: '[0.8]' });

/** Nobody here can go, in red. */
const nobody = css({ color: 'bad', fontWeight: 'bold' });

/** The house call on offer: in full, with a button for each who could go, or tucked away as a button. */
export function HouseCallOffer() {
  const hud = useHud();
  const { sim } = useGame();
  const call = sim.s.callOffer;
  if (!call) return null;
  const left = offerTimeLeft(call.deadline, sim.s.day);
  const share = Math.min(1, left.days / CALL_OFFER_DAYS);
  const timer = <Bar value={share * 100} class={share < 0.3 ? 'thin bad' : 'thin blue'} />;
  if (hud.callAside === call.deadline)
    return (
      <Button
        class={cx(panelCard(), 'offer-pill', callColor)}
        title="Show the house call"
        onPress={() => {
          hud.callAside = null;
        }}
      >
        <span>
          <IconText id="bubble-house-call">{`House call on offer: ${timeLeftLabel(left.days)} to decide`}</IconText>
        </span>
        {timer}
      </Button>
    );
  const who = sim.whoCanGo();
  return (
    <div class={cx(panelCard(), 'offer', 'call', callColor)}>
      <Button
        class="later"
        title="Decide later"
        onPress={() => {
          hud.callAside = call.deadline;
        }}
      >
        ✕
      </Button>
      <h3>
        <IconText id="bubble-house-call">House call</IconText>
      </h3>
      <p>
        {`${call.client.charAt(0).toUpperCase()}${call.client.slice(1)} would like a `}
        <b>{callWants(call)}</b>
        {` to come to them for ${call.days} day${call.days === 1 ? '' : 's'}.`}
      </p>
      <p class="sub">
        Whoever goes is away until they are back, and their station stands empty while their line waits. A higher rank
        earns more.
      </p>
      {who.length ? (
        <div class={whoList}>
          {who.slice(0, 4).map((st) => (
            <Button
              key={st.id}
              class={cx(goButton(), send)}
              onPress={() => {
                const offer = sim.s.callOffer;
                sim.acceptCall(st.id);
                answerOffer(sim.s, offer, 'house_call', 'accepted');
              }}
            >
              <span>{`Send ${st.name} (${rankName(st.skill)}) · ${money(sim.callFee(st))}`}</span>
              <small class={sendCost}>
                <Line line={callCostNote(sim.callCost(st), call.days)} />
              </small>
            </Button>
          ))}
        </div>
      ) : (
        <p class={cx('sub', nobody)}>{`Nobody here can go: it needs ${an(callWants(call))} who is free.`}</p>
      )}
      <div class="time-left">
        <span>{`Offer lapses: ${timeLeftLabel(left.days)}`}</span>
        {timer}
      </div>
      <div class={buttonRow()}>
        <Button
          class={dangerButton()}
          onPress={() => {
            const offer = sim.s.callOffer;
            sim.declineCall();
            answerOffer(sim.s, offer, 'house_call', 'declined');
          }}
        >
          Decline
        </Button>
      </div>
    </div>
  );
}
