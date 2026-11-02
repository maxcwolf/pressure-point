// The Stats menu's Paper tab: the latest issue of the town paper, kept so a message that fades loses nothing.

import { useGame } from '../../hooks/use-hud';
import { PaperPage } from '../PaperPage';

/** The latest issue, or when the first is due. */
export function PaperTab() {
  const { sim } = useGame();
  const paper = sim.s.paper;
  if (!paper)
    return (
      <p class="sub">
        The town paper prints on the payday that ends each quarter, every third month, with the quarter’s biggest story
        on the front page. The latest issue is kept here.
      </p>
    );
  return <PaperPage paper={paper} />;
}
