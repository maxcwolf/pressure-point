// A progress bar.

import { css } from '../../../styled-system/css';
import { cx } from '../../lib/cx';
import { meterValue } from '../../lib/meters';

/**
 * The bar and its fill. Its tone and thickness come as classes, from `tone` or from `class`, so a caller can pick them
 * with words such as `thin bad`; `bar` and the tones stay on it for the stylesheets that lay bars out in their own way.
 */
const bar = css({
  h: '[10px]',
  borderRadius: '[6px]',
  bg: '[rgba(36, 56, 74, 0.16)]',
  overflow: 'hidden',
  mt: '[3px]',
  '& i': { display: 'block', h: '[100%]', borderRadius: '[6px]', bg: 'green', transition: '[width 0.3s]' },
  '&.thin': { h: '[6px]' },
  '&.good i': { bg: 'green' },
  '&:is(.gold, .warn) i': { bg: 'gold' },
  '&.blue i': { bg: 'blue' },
  '&.bad i': { bg: 'red' },
  '&.need i': { bg: 'orange' },
  '&.energy i': { bg: '[#8a6fd1]' },
});

/** A bar with its value beside it, the numbers lined up down the panel. */
const meter = css({
  display: 'flex',
  alignItems: 'center',
  gap: 's',
  mt: '[3px]',
  '& .bar': { flex: '1', mt: 'none' },
});

/** The number beside a bar. */
const meterValueStyle = css({
  minW: '[2.2em]',
  textAlign: 'right',
  fontSize: '[11.5px]',
  fontWeight: 'bold',
  fontVariantNumeric: 'tabular-nums',
  lineHeight: '[1]',
});

/**
 * A bar filled to a percentage. `tone` colors the fill (good, warn, bad, or one of the plain colors), and `show` puts
 * the value beside it: the rounded number for `true`, or words of its own. With a value shown, `class` goes on the row
 * that holds the bar and its value.
 */
export function Bar({
  value,
  class: className,
  tone,
  show,
}: {
  value: number;
  class?: string;
  tone?: string | undefined;
  show?: boolean | string;
}) {
  const width = Math.max(0, Math.min(100, value)).toFixed(0);
  const bare = show === undefined || show === false;
  const filled = (
    <div class={cx('bar', bar, bare && className, tone)}>
      <i style={{ width: `${width}%` }} />
    </div>
  );
  if (bare) return filled;
  return (
    <div class={cx('meter', meter, className)}>
      {filled}
      <span class={cx('meter-value', meterValueStyle)}>{show === true ? meterValue(value) : show}</span>
    </div>
  );
}
