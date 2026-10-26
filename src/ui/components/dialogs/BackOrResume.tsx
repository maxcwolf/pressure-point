// The two buttons at the foot of the dialogs opened from the pause menu.

import { buttonRow, goButton } from '../../../styled-system/recipes';
import { useHud } from '../../hooks/use-hud';
import { Button } from '../common/Button';

/** Back to the pause menu, or straight back to the game. */
export function BackOrResume() {
  const hud = useHud();
  return (
    <div class={buttonRow()}>
      <Button
        onPress={() => {
          hud.open('pause');
        }}
      >
        Back
      </Button>
      <Button
        class={goButton()}
        onPress={() => {
          hud.close();
        }}
      >
        Resume
      </Button>
    </div>
  );
}
