// Redrawing on demand.

import { useCallback, useReducer } from 'preact/hooks';

/**
 * A function that redraws the component calling this, for state kept outside it. It is the same function on every
 * render, so an effect that depends on it does not run again each time.
 */
export function useRedraw(): () => void {
  const [, redraw] = useReducer((n: number) => n + 1, 0);
  return useCallback(() => {
    redraw(0);
  }, []);
}
