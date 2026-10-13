// A progress bar.

import './Bar.css';

import { cx } from '../../lib/cx';

/** A bar filled to a percentage. */
export function Bar({ value, class: className }: { value: number; class?: string }) {
  const width = Math.max(0, Math.min(100, value)).toFixed(0);
  return (
    <div class={cx('bar', className)}>
      <i style={{ width: `${width}%` }} />
    </div>
  );
}
