// Top center: what the tool in hand does, why it cannot be used here, and what an item in hand would change, with a
// rug's patterns to pick from.

import './ToolHint.css';

import { useGame } from '../hooks/use-hud';
import { cx } from '../lib/cx';
import { placeEffects } from '../lib/item-stats';
import { RugPatterns } from './common/RugPatterns';

/** The hint for the tool in hand, what an item in hand would change, and a new rug's patterns to choose from. */
export function ToolHint() {
  const { sim, tools } = useGame();
  const effects = tools.preview ? placeEffects(sim, tools.preview) : [];
  return (
    <div id="hint">
      {tools.hint && (
        <div class={cx('hintpill', tools.problem && 'bad')}>
          {tools.hint}
          {tools.problem && <b>{tools.problem}</b>}
          {effects.length > 0 && (
            <ul class="effects">
              {effects.map((e) => (
                <li key={e.text} class={e.tone}>{`${e.icon} ${e.text}`}</li>
              ))}
            </ul>
          )}
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
