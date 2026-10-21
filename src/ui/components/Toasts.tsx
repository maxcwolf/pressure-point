// Right side: a downloaded update, raise requests and promotions waiting on an answer, then messages that fade after a few seconds. One about someone
// or something takes you there when clicked.

import './Toasts.css';

import { useGame, useHud } from '../hooks/use-hud';
import { cx } from '../lib/cx';
import { promotionRequests, raiseRequests } from '../lib/status';
import { Button } from './common/Button';
import { IconText } from './common/Icon';

/** Raise requests and promotions still waiting, and the messages currently on screen. */
export function Toasts() {
  const hud = useHud();
  const { sim, update } = useGame();
  const version = update?.ready();
  return (
    <div id="toasts">
      {version && (
        <Button
          key="update"
          class="toast request link"
          title="Restart to update"
          onPress={() => {
            hud.open('update');
          }}
        >
          <IconText id="ui-update">{`Version ${version} is ready to install`}</IconText>
        </Button>
      )}
      {raiseRequests(sim.s.staff).map((st) => (
        <Button
          key={`raise-${st.id}`}
          class="toast request link"
          title="Show me"
          onPress={() => {
            hud.show({ kind: 'staff', id: st.id });
          }}
        >
          <IconText id="bubble-raise">{`${st.name} wants a raise`}</IconText>
        </Button>
      ))}
      {promotionRequests(sim.s.staff).map((st) => (
        <Button
          key={`promote-${st.id}`}
          class="toast request link"
          title="Show me"
          onPress={() => {
            hud.show({ kind: 'staff', id: st.id });
          }}
        >
          <IconText id="ui-upgrade">{`${st.name} is ready for promotion`}</IconText>
        </Button>
      ))}
      {hud.toasts.map((t) => {
        const about = t.about;
        const look = cx('toast', t.kind, t.leaving && 'out');
        const body = t.icon ? <IconText id={t.icon}>{t.text}</IconText> : t.text;
        return about ? (
          <Button
            key={t.id}
            class={cx(look, 'link')}
            title="Show me"
            onPress={() => {
              hud.show(about);
            }}
          >
            {body}
          </Button>
        ) : (
          <div key={t.id} class={look}>
            {body}
          </div>
        );
      })}
    </div>
  );
}
