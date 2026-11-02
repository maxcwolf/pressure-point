// The town paper's latest issue, opened from the message it came with.

import { buttonRow, goButton } from '../../../styled-system/recipes';
import { useGame, useHud } from '../../hooks/use-hud';
import { Button } from '../common/Button';
import { PaperPage } from '../PaperPage';
import { Dialog } from './Dialog';

/** The latest issue on one page, and the way back to the game. */
export function PaperDialog() {
  const hud = useHud();
  const { sim } = useGame();
  const paper = sim.s.paper;
  if (!paper) return null;
  /** Close the paper. */
  const close = () => {
    hud.close();
  };
  return (
    <Dialog wide>
      <PaperPage paper={paper} onLeave={close} />
      <div class={buttonRow()}>
        <Button class={goButton()} onPress={close}>
          Back to work
        </Button>
      </div>
    </Dialog>
  );
}
