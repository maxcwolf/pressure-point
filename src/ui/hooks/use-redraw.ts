// Redrawing on demand.

import { useReducer } from 'preact/hooks';

/** A function that redraws the component calling this, for state kept outside it. */
export function useRedraw(): () => void {
  const [, redraw] = useReducer((n: number) => n + 1, 0);
  return () => {
    redraw(0);
  };
}
