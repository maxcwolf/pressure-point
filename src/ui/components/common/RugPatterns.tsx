// A row of swatches, one for each pattern a Woven Rug can have.

import { RUG_ORDER, RUG_PATTERNS, type RugPatternId } from '../../../core/data';
import { css } from '../../../styled-system/css';
import { cx } from '../../lib/cx';
import { Button } from './Button';

/** The pattern's name, and the swatches beside it, centered and wrapping as one. */
const row = css({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '[6px 10px]',
  fontSize: 'body',
  fontWeight: '[500]',
});

/** One pattern's swatch: a small square of it in a frame, ringed in teal while it is the one laid. */
const swatch = css({
  w: 'control',
  h: 'control',
  p: '[2px]',
  border: '[2px solid rgba(36, 56, 74, 0.35)]',
  borderRadius: '[8px]',
  bg: 'white',
  '& i': { display: 'block', w: '[100%]', h: '[100%]', borderRadius: '[5px]' },
  _on: { borderColor: 'teal-dark', boxShadow: '[0 0 0 2px {colors.teal}]' },
});

/** The rug patterns to pick from, the current one picked out and named. */
export function RugPatterns({ current, onPick }: { current: RugPatternId; onPick: (id: RugPatternId) => void }) {
  return (
    <div class={row}>
      <span>{`Pattern: ${RUG_PATTERNS[current].name}`}</span>
      <div class={css({ display: 'flex', gap: 'xs' })} aria-label="Rug pattern">
        {RUG_ORDER.map((id) => (
          <Button
            key={id}
            class={cx(swatch, current === id && 'on')}
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
