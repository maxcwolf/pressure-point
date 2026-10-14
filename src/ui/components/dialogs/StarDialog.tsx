// The celebration when a star is earned.

import './StarDialog.css';

import { centerOf } from '../../../core/data';
import { money } from '../../../core/format';
import { useGame, useHud } from '../../hooks/use-hud';
import { roomsUnlockedAt, treatmentsUnlockedAt } from '../../lib/unlocks';
import { Button } from '../common/Button';
import { StarRow } from '../common/Stars';
import { Dialog } from './Dialog';

/** The new star, the grant that comes with it, and what it unlocks. */
export function StarDialog() {
  const hud = useHud();
  const { sim } = useGame();
  const n = hud.star;
  const goals = centerOf(sim.s).goals;
  /** Whether a discipline is switched on. */
  const enabled = sim.enabled.bind(sim);
  const rooms = roomsUnlockedAt(n, enabled);
  const treatments = treatmentsUnlockedAt(n, enabled);
  return (
    <Dialog>
      <div class="bigstars">
        <StarRow earned={n} of={goals.length} />
      </div>{' '}
      <h2>{n >= goals.length ? 'Three stars!' : `Star ${n} earned!`}</h2>{' '}
      <p>{`The wellness inspectors were deeply relaxed by what they saw. Here is a ${money(5000 * n)} grant.`}</p>
      {rooms.length > 0 && (
        <p class="unlock">
          <b>New room:</b>
          {` ${rooms.join(', ')}. Build one and hire its staff to bring in a new kind of guest.`}
        </p>
      )}
      {treatments.length > 0 && (
        <p class="unlock">
          <b>New treatments:</b>
          {` ${treatments.join(', ')}.`}
          <br />
          Guests who need them will start arriving. Train your staff in a Training Room and check the Treatments menu
          for equipment.
        </p>
      )}{' '}
      <p class="sub">
        {goals[n]
          ? 'New objectives are waiting in the top-left corner.'
          : 'You have mastered the lot. Every treatment is open to you.'}
      </p>{' '}
      <Button
        class="go"
        onPress={() => {
          hud.close();
        }}
      >
        Keep healing
      </Button>
    </Dialog>
  );
}
