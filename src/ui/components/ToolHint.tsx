// Top center: what the tool in hand does, and why it cannot be used here, with a rug's patterns to pick from.

import './ToolHint.css';

import { useGame } from '../hooks/use-hud';
import { cx } from '../lib/cx';
import { RugPatterns } from './common/RugPatterns';

/** The hint for the tool in hand, and the patterns to choose from while a new rug is in hand. */
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
      {tools.holdingRug && (
        <div class="hintpill rugpicker">
          <RugPatterns
            current={tools.rugPattern}
            onPick={(id) => {
              tools.pickRugPattern(id);
            }}
          />
        </div>
      )}
    </div>
  );
}
