// The feedback dialog, opened from the pause menu.

import { useGame } from '../../hooks/use-hud';
import { FeedbackPanel } from '../FeedbackPanel';
import { BackOrResume } from './BackOrResume';
import { Dialog } from './Dialog';

/** A box to send feedback from the game in progress. */
export function FeedbackDialog() {
  const { sim } = useGame();
  const { center, day } = sim.s;
  return (
    <Dialog wide>
      <h2>Give feedback</h2>
      <FeedbackPanel from={{ screen: 'game', center, day: Math.floor(day) }} /> <BackOrResume />
    </Dialog>
  );
}
