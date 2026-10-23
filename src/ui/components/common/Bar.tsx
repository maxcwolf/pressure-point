// A progress bar.

import './Bar.css';

import { cx } from '../../lib/cx';
import { meterValue } from '../../lib/meters';

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
  const bar = (
    <div class={cx('bar', bare && className, tone)}>
      <i style={{ width: `${width}%` }} />
    </div>
  );
  if (bare) return bar;
  return (
    <div class={cx('meter', className)}>
      {bar}
      <span class="meter-value">{show === true ? meterValue(value) : show}</span>
    </div>
  );
}
