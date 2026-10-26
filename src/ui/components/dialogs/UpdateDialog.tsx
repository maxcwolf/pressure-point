// Offering to restart into a newer version of the desktop app.

import { buttonRow, goButton } from '../../../styled-system/recipes';
import { useGame, useHud } from '../../hooks/use-hud';
import { Button } from '../common/Button';
import { Dialog } from './Dialog';

/** The downloaded update: restart for it now, or keep playing and have it install on the way out. */
export function UpdateDialog() {
  const hud = useHud();
  const { update } = useGame();
  const version = update?.ready();
  if (!update || !version) return null;
  return (
    <Dialog>
      <h2>{`Version ${version} is ready`}</h2>
      <p>
        Restart now to play it. Your game is saved first, and Continue picks it straight up. What’s new on the title
        screen says what changed.
      </p>{' '}
      <p class="sub">Or keep playing: it installs by itself the next time you quit.</p>{' '}
      <div class={buttonRow()}>
        <Button
          onPress={() => {
            hud.close();
          }}
        >
          Keep playing
        </Button>
        <Button class={goButton()} onPress={update.install}>
          Restart now
        </Button>
      </div>
    </Dialog>
  );
}
