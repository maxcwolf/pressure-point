// Right side: raise requests waiting on an answer, then messages that fade after a few seconds. One about someone
// or something takes you there when clicked.

import './Toasts.css';

import { useGame, useHud } from '../hooks/use-hud';
import { cx } from '../lib/cx';
import { raiseRequests } from '../lib/status';
import { Button } from './common/Button';

/** Raise requests still waiting, and the messages currently on screen. */
export function Toasts() {
  const hud = useHud();
  const { sim } = useGame();
  return (
    <div id="toasts">
      {raiseRequests(sim.s.staff).map((st) => (
        <Button
          key={`raise-${st.id}`}
          class="toast request link"
          title="Show me"
          onPress={() => {
            hud.show({ kind: 'staff', id: st.id });
          }}
        >
          {`💸 ${st.name} wants a raise`}
        </Button>
      ))}
      {hud.toasts.map((t) => {
        const about = t.about;
        const look = cx('toast', t.kind, t.leaving && 'out');
        return about ? (
          <Button
            key={t.id}
            class={cx(look, 'link')}
            title="Show me"
            onPress={() => {
              hud.show(about);
            }}
          >
            {t.text}
          </Button>
        ) : (
          <div key={t.id} class={look}>
            {t.text}
          </div>
        );
      })}
    </div>
  );
}
