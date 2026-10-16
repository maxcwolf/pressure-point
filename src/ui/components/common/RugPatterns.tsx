// A row of swatches, one for each pattern a Woven Rug can have.

import './RugPatterns.css';

import { RUG_ORDER, RUG_PATTERNS, type RugPatternId } from '../../../core/data';
import { cx } from '../../lib/cx';
import { Button } from './Button';

/** The rug patterns to pick from, the current one picked out and named. */
export function RugPatterns({ current, onPick }: { current: RugPatternId; onPick: (id: RugPatternId) => void }) {
  return (
    <div class="rugpatterns">
      <span>{`Pattern: ${RUG_PATTERNS[current].name}`}</span>
      <div class="rugswatches" aria-label="Rug pattern">
        {RUG_ORDER.map((id) => (
          <Button
            key={id}
            class={cx('rugswatch', current === id && 'on')}
            title={RUG_PATTERNS[id].name}
            onPress={() => {
              onPick(id);
            }}
          >
            <i style={{ background: RUG_PATTERNS[id].swatch }} />
          </Button>
        ))}
      </div>
    </div>
  );
}
