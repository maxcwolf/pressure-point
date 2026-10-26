// Star ratings.

import { css } from '../../../styled-system/css';

/** Gold stars outlined in navy, a little apart. */
const stars = css({
  color: 'star',
  WebkitTextStroke: '[{borderWidths.hairline} {colors.outline}]',
  paintOrder: 'stroke fill',
  letterSpacing: '[1px]',
});

/** A row of stars, with the ones not earned shown faintly. */
export function StarRow({ earned, of }: { earned: number; of: number }) {
  return (
    <>
      {'★'.repeat(earned)}
      <s>{'★'.repeat(of - earned)}</s>
    </>
  );
}

/** A rating out of five, for skill and prestige. */
export function Stars({ count, of = 5 }: { count: number; of?: number }) {
  return (
    <span class={`skill ${stars}`}>
      <StarRow earned={count} of={of} />
    </span>
  );
}
