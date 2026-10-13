// Bottom left: the advisor's current nudge.

import './Advisor.css';

import { useGame, useHud } from '../hooks/use-hud';

/** The advisor, who steps aside while a build menu or a blueprint is open in the same spot. */
export function Advisor() {
  const hud = useHud();
  const { sim, tools } = useGame();
  if (hud.menu || tools.plan) return <div id="advisor" />;
  return (
    <div id="advisor">
      <div class="face">🧘</div>
      <p>{sim.advice()}</p>
    </div>
  );
}
