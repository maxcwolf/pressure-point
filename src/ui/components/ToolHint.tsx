// Top center: what the tool in hand does, as a row of chips, why it cannot be used here, and what an item in hand
// would change, with a rug's patterns to pick from.

import './ToolHint.css';

import { toolIcon } from '../../app/tools/hints';
import type { IconId } from '../../core/data';
import { useGame } from '../hooks/use-hud';
import { cx } from '../lib/cx';
import { type HintChip, hintChips } from '../lib/hint-chips';
import { placeEffects } from '../lib/item-stats';
import { IconText } from './common/Icon';
import { RugPatterns } from './common/RugPatterns';

/** One phrase of the hint as a chip: the name with the icon of the tool in hand, a key as a key, a square's color. */
function Chip({ chip, icon }: { chip: HintChip; icon: IconId | null }) {
  switch (chip.kind) {
    case 'name':
      return icon ? <IconText id={icon}>{chip.text}</IconText> : <>{chip.text}</>;
    case 'key':
      return (
        <>
          <kbd>{chip.key}</kbd> {chip.text}
        </>
      );
    case 'legend':
      return (
        <>
          <i
            class={cx('square', chip.squares)}
            role="img"
            aria-label={`${chip.squares === 'staff' ? 'purple' : 'orange'} squares:`}
          />
          {chip.text}
        </>
      );
    default:
      return <>{chip.text}</>;
  }
}

/** The hint for the tool in hand, what an item in hand would change, and a new rug's patterns to choose from. */
export function ToolHint() {
  const { sim, tools } = useGame();
  const effects = tools.preview ? placeEffects(sim, tools.preview) : [];
  const icon = toolIcon(tools.tool);
  return (
    <div id="hint">
      {tools.hint && (
        <div class={cx('hintpill', tools.problem && 'bad')}>
          <ul class="chips">
            {hintChips(tools.hint).map((chip) => (
              <li key={chip.text} class={chip.kind}>
                <Chip chip={chip} icon={icon} />
              </li>
            ))}
          </ul>
          {tools.problem && (
            <b key={tools.refusals} class={cx(tools.justRefused && 'refused')}>
              {tools.problem}
            </b>
          )}
          {effects.length > 0 && (
            <ul class="effects">
              {effects.map((e) => (
                <li key={e.text} class={e.tone}>
                  <IconText id={e.icon}>{e.text}</IconText>
                </li>
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
