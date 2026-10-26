// Asking before calling a member of staff off their course, once their inspector's Cancel course is pressed. The game
// waits meanwhile.

import { money } from '../../../core/format';
import { courseName } from '../../../core/sim/training';
import { buttonRow, dangerButton } from '../../../styled-system/recipes';
import { useGame, useHud } from '../../hooks/use-hud';
import { Button } from '../common/Button';
import { Dialog } from './Dialog';

/** The member of staff and course asked about, with the refund, and a button to call the course off. */
export function ConfirmCancelCourse() {
  const hud = useHud();
  const { sim } = useGame();
  const st = sim.s.staff.find((q) => q.id === hud.cancelAsked);
  const t = st?.training;
  if (!st || !t || sim.cancelBlocker(st)) {
    // finished, dropped or gone meanwhile: nothing left to ask
    return (
      <Dialog>
        <h2>No longer on a course</h2>
        <div class={buttonRow()}>
          <Button
            onPress={() => {
              hud.cancelAsked = null;
              hud.close();
            }}
          >
            OK
          </Button>
        </div>
      </Dialog>
    );
  }
  return (
    <Dialog>
      <h2>{`Cancel ${st.name}'s ${courseName(t.course)} course?`}</h2>
      <p>{`You'll get ${money(t.cost)} back. What they have learned so far is lost, and they go back to work.`}</p>{' '}
      <div class={buttonRow()}>
        <Button
          onPress={() => {
            hud.cancelAsked = null;
            hud.close();
          }}
        >
          Keep training
        </Button>
        <Button
          class={dangerButton()}
          onPress={() => {
            sim.cancelTraining(st.id);
            hud.cancelAsked = null;
            hud.close();
          }}
        >
          Cancel course
        </Button>
      </div>
    </Dialog>
  );
}
