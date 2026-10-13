// The saved games dialog, opened from the pause menu.

import { useGame } from '../../hooks/use-hud';
import { SavesPanel } from '../SavesPanel';
import { BackOrResume } from './BackOrResume';
import { Dialog } from './Dialog';

/** Saving the game in progress, or loading another. */
export function SavesDialog() {
  const { sim, loadGame } = useGame();
  return (
    <Dialog wide>
      <h2>Saved games</h2>
      <div id="saves-panel">
        <SavesPanel current={sim.s} onLoad={loadGame} />
      </div>{' '}
      <BackOrResume />
    </Dialog>
  );
}
