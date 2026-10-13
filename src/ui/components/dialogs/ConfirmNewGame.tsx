// Asking before starting over.

import { useGame, useHud } from '../../hooks/use-hud';
import { Button } from '../common/Button';
import { Dialog } from './Dialog';

/** A last check before leaving this game for a new one. */
export function ConfirmNewGame() {
  const hud = useHud();
  const { newGame } = useGame();
  return (
    <Dialog>
      <h2>Start a new game?</h2>
      <p>Your current center is not lost: it moves to "Previous game" in the saved games list.</p>{' '}
      <div class="btnrow">
        <Button
          onPress={() => {
            hud.close();
          }}
        >
          Keep playing
        </Button>
        <Button class="danger" onPress={newGame}>
          Start a new game
        </Button>
      </div>
    </Dialog>
  );
}
