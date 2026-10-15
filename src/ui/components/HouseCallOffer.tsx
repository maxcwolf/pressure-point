// Top center, under any emergency: a house call on offer, with who could go and what each would earn, which can be
// put aside to decide on later.

import { CALL_OFFER_DAYS } from '../../core/data';
import { money } from '../../core/format';
import { callWants } from '../../core/sim/calls';
import { rankName } from '../../core/sim/careers';
import { useGame, useHud } from '../hooks/use-hud';
import { offerTimeLeft, timeLeftLabel } from '../lib/emergency';
import { Bar } from './common/Bar';
import { Button } from './common/Button';

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
        class="panel offer-pill call-pill"
        title="Show the house call"
        onPress={() => {
          hud.callAside = null;
        }}
      >
        <span>{`🧳 House call on offer: ${timeLeftLabel(left.days)} to decide`}</span>
        {timer}
      </Button>
    );
  const who = sim.whoCanGo();
  return (
    <div class="panel offer call">
      <Button
        class="later"
        title="Decide later"
        onPress={() => {
          hud.callAside = call.deadline;
        }}
      >
        ✕
      </Button>
      <h3>🧳 House call</h3>
      <p>
        {`${call.client.charAt(0).toUpperCase()}${call.client.slice(1)} would like a `}
        <b>{callWants(call)}</b>
        {` to come to them for ${call.days} day${call.days === 1 ? '' : 's'}.`}
      </p>
      <p class="sub">
        Whoever goes is away until they are back, and their station stands empty. A higher rank earns more.
      </p>
      {who.length ? (
        <div class="call-who">
          {who.slice(0, 4).map((st) => (
            <Button
              key={st.id}
              class="go"
              onPress={() => {
                sim.acceptCall(st.id);
              }}
            >
              {`Send ${st.name} (${rankName(st.skill)}) · ${money(sim.callFee(st))}`}
            </Button>
          ))}
        </div>
      ) : (
        <p class="sub warn">{`Nobody here can go: it needs a ${callWants(call)} who is free.`}</p>
      )}
      <div class="time-left">
        <span>{`Offer lapses: ${timeLeftLabel(left.days)}`}</span>
        {timer}
      </div>
      <div class="btnrow">
        <Button
          class="danger"
          onPress={() => {
            sim.declineCall();
          }}
        >
          Decline
        </Button>
      </div>
    </div>
  );
}
