// Asking before dismissing every message on the right at once, once the close button on the pile under them is pressed.
// The game waits meanwhile.

import { useHud } from '../../hooks/use-hud';
import { Button } from '../common/Button';
import { Dialog } from './Dialog';

/** How many messages there are, and buttons to keep them or dismiss them all. */
export function ConfirmDismissMessages() {
  const hud = useHud();
  const count = hud.toasts.length;
  return (
    <Dialog>
      <h2>{`Dismiss all ${count} ${count === 1 ? 'message' : 'messages'}?`}</h2>
      <p>Once they are dismissed, they cannot be brought back.</p>{' '}
      <div class="btnrow">
        <Button
          onPress={() => {
            hud.close();
          }}
        >
          Keep them
        </Button>
        <Button
          class="danger"
          onPress={() => {
            hud.dismissAllToasts();
            hud.close();
          }}
        >
          Dismiss all
        </Button>
      </div>
    </Dialog>
  );
}
