// Panels and dialogs that leave rather than vanish: what was showing stays a moment as it goes.

import { Component, type ComponentChildren } from 'preact';
import { useEffect, useRef } from 'preact/hooks';

import { useRedraw } from './use-redraw';

/** How long a panel or a dialog takes to go, in milliseconds. */
export const EXIT_MS = 140;

/**
 * What to show for something that can be open or shut: while open, itself; for a moment after it shuts, the last of it,
 * marked as leaving so it can play its way out.
 */
export function useExit<T>(value: T | null): { shown: T | null; leaving: boolean } {
  const redraw = useRedraw();
  const last = useRef<T | null>(value);
  const going = useRef<T | null>(null);
  if (value !== null) {
    last.current = value;
    going.current = null;
  } else if (last.current !== null) {
    going.current = last.current;
    last.current = null;
  }
  const leaving = going.current !== null;
  useEffect(() => {
    if (!leaving) return undefined;
    const timer = setTimeout(() => {
      going.current = null;
      redraw();
    }, EXIT_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [leaving, redraw]);
  return value !== null ? { shown: value, leaving: false } : { shown: going.current, leaving };
}

/**
 * Its children as they were last drawn, while `still` is set: a panel on its way out reads nothing more from the game,
 * which may have moved on (the member of staff let go, the dialog's question answered).
 */
export class Still extends Component<{ still: boolean; children: ComponentChildren }> {
  /** Draw again only while not held still. */
  override shouldComponentUpdate(next: { still: boolean }): boolean {
    return !next.still;
  }

  /** The children, as given. */
  override render() {
    return this.props.children;
  }
}
