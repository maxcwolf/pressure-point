// Right side: messages that fade after a few seconds.

import './Toasts.css';

import { useHud } from '../hooks/use-hud';
import { cx } from '../lib/cx';

/** The messages currently on screen. */
export function Toasts() {
  const { toasts } = useHud();
  return (
    <div id="toasts">
      {toasts.map((t) => (
        <div key={t.id} class={cx('toast', t.kind, t.leaving && 'out')}>
          {t.text}
        </div>
      ))}
    </div>
  );
}
