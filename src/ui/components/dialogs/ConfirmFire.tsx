// Asking before letting a member of staff go, once their inspector's Let go is pressed. The game waits meanwhile.

import { ROLES } from '../../../core/data';
import { buttonRow, dangerButton } from '../../../styled-system/recipes';
import { useGame, useHud } from '../../hooks/use-hud';
import { Button } from '../common/Button';
import { Dialog } from './Dialog';

/** The member of staff asked about, by name, with a button to let them go. */
export function ConfirmFire() {
  const hud = useHud();
  const { sim, tools } = useGame();
  const st = sim.s.staff.find((q) => q.id === hud.fireAsked);
  if (!st || st.state === 'leaving') {
    // gone or going meanwhile: nothing left to ask
    return (
      <Dialog>
        <h2>Already leaving</h2>
        <div class={buttonRow()}>
          <Button
            onPress={() => {
              hud.fireAsked = null;
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
      <h2>{`Are you sure you want to fire ${st.name}?`}</h2>
      <p>{`Your ${ROLES[st.role].name} packs up and leaves the center for good.`}</p>{' '}
      <div class={buttonRow()}>
        <Button
          onPress={() => {
            hud.fireAsked = null;
            hud.close();
          }}
        >
          Keep them on
        </Button>
        <Button
          class={dangerButton()}
          onPress={() => {
            sim.fire(st.id);
            hud.fireAsked = null;
            tools.select(null);
            hud.close();
          }}
        >
          Let go
        </Button>
      </div>
    </Dialog>
  );
}
