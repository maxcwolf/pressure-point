// The pause menu.

import { GAME_TITLE } from '../../../core/data';
import { useGame, useHud } from '../../hooks/use-hud';
import { Button } from '../common/Button';
import { Controls } from './Controls';
import { Dialog } from './Dialog';

/** The controls, and the way to saves, settings, the main menu, a new game and the exit. */
export function PauseMenu() {
  const hud = useHud();
  const { mainMenu, exit } = useGame();
  return (
    <Dialog>
      <h2>{GAME_TITLE}</h2>
      <Controls /> <p class="sub">The game autosaves every few seconds. Use Save or load to keep named saves.</p>{' '}
      <div class="btnrow">
        <Button
          class="go"
          onPress={() => {
            hud.close();
          }}
        >
          Resume
        </Button>{' '}
        <Button
          onPress={() => {
            hud.open('saves');
          }}
        >
          Save or load
        </Button>
        <Button
          onPress={() => {
            hud.open('settings');
          }}
        >
          Settings
        </Button>
      </div>{' '}
      <div class="btnrow">
        <Button onPress={mainMenu}>Main menu</Button>
        <Button
          class="danger"
          onPress={() => {
            hud.open('confirm-new');
          }}
        >
          New game
        </Button>{' '}
        {exit && (
          <Button class="danger" onPress={exit}>
            Exit game
          </Button>
        )}
      </div>{' '}
      <p class="sub">Main menu{exit ? ' and Exit game both save' : ' saves'} your game first.</p>
    </Dialog>
  );
}
