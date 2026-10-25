// The pause menu.

import { GAME_TITLE } from '../../../core/data';
import { loadControls } from '../../../storage/controls';
import { buttonRow, dangerButton, goButton } from '../../../styled-system/recipes';
import { useGame, useHud } from '../../hooks/use-hud';
import { autosaveNote } from '../../lib/keys';
import { Button } from '../common/Button';
import { Controls } from './Controls';
import { Dialog } from './Dialog';

/** The controls, and the way to saves, settings, feedback, the main menu, a new game and the exit. */
export function PauseMenu() {
  const hud = useHud();
  const { mainMenu, exit } = useGame();
  return (
    <Dialog>
      <h2>{GAME_TITLE}</h2>
      <Controls /> <p class="sub">{autosaveNote(loadControls().autosave)} Use Save or load to keep named saves.</p>{' '}
      <div class={buttonRow()}>
        <Button
          class={goButton()}
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
        <Button
          onPress={() => {
            hud.open('feedback');
          }}
        >
          Give feedback
        </Button>
      </div>{' '}
      <div class={buttonRow()}>
        <Button onPress={mainMenu}>Main menu</Button>
        <Button
          class={dangerButton()}
          onPress={() => {
            hud.open('confirm-new');
          }}
        >
          New game
        </Button>{' '}
        {exit && (
          <Button class={dangerButton()} onPress={exit}>
            Exit game
          </Button>
        )}
      </div>{' '}
      <p class="sub">Main menu{exit ? ' and Exit game both save' : ' saves'} your game first.</p>
    </Dialog>
  );
}
