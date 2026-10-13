// Top center: what the tool in hand does, and why it cannot be used here.

import './ToolHint.css';

import { useGame } from '../hooks/use-hud';
import { cx } from '../lib/cx';

/** The hint for the tool in hand. */
export function ToolHint() {
  const { tools } = useGame();
  return (
    <div id="hint">
      {tools.hint && (
        <div class={cx('hintpill', tools.problem && 'bad')}>
          {tools.hint}
          {tools.problem && <b>{tools.problem}</b>}
        </div>
      )}
    </div>
  );
}
