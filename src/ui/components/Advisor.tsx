// Bottom left: the advisor's current nudge. One about someone or something takes you there when clicked.

import './Advisor.css';

import { useGame, useHud } from '../hooks/use-hud';
import { Button } from './common/Button';
import { Icon } from './common/Icon';

/** The advisor, who steps aside while a build menu or a blueprint is open in the same spot. */
export function Advisor() {
  const hud = useHud();
  const { sim, tools } = useGame();
  if (hud.menu || tools.plan) return <div id="advisor" />;
  const { text, about } = sim.adviceNote();
  return (
    <div id="advisor">
      <div class="face">
        <Icon id="ui-advisor" size={36} />
      </div>
      {about ? (
        <Button
          class="note link"
          title="Show me"
          onPress={() => {
            hud.show(about);
          }}
        >
          {text}
        </Button>
      ) : (
        <p class="note">{text}</p>
      )}
    </div>
  );
}
