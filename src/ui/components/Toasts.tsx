// Right side: messages that fade after a few seconds. One about someone or something takes you there when clicked.

import './Toasts.css';

import { useHud } from '../hooks/use-hud';
import { cx } from '../lib/cx';
import { Button } from './common/Button';

/** The messages currently on screen. */
export function Toasts() {
  const hud = useHud();
  return (
    <div id="toasts">
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
