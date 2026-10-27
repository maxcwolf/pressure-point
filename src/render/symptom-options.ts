// A switch for trying out ways to make a guest's ailment readable from the game's usual distance, the way a crowd in
// Two Point reads from across the map: ?symptoms=body, walk, grow or color in the address. Without it, symptoms are
// drawn as they always have been. A prototype for a handful of ailments each, to be judged from pictures; see
// docs/planning/fun/options/symptoms/.

export type SymptomOption = 'body' | 'walk' | 'grow' | 'color';

const OPTIONS: readonly SymptomOption[] = ['body', 'walk', 'grow', 'color'];

/** The option the address asks for, if any. */
export const SYMPTOM_OPTION: SymptomOption | null = (() => {
  if (typeof location === 'undefined') return null;
  const asked = new URLSearchParams(location.search).get('symptoms');
  return OPTIONS.find((o) => o === asked) ?? null;
})();

/** How many pixels across a symptom prop is kept at least, under `grow`, and the most it grows to get there. */
export const GROW = { px: 18, most: 2.6 } as const;

/**
 * How much the `grow` prototype's props are grown to begin with, from `&grow=` in the address: the model lab never
 * grows them as the game does, so a picture there can show them at the size they are drawn from afar.
 */
export const GROW_START: number = (() => {
  if (typeof location === 'undefined') return 1;
  return Number(new URLSearchParams(location.search).get('grow')) || 1;
})();

/**
 * Which variant of an ailment's model under `body` the address asks for, by its look's name: `&steam=2` for the second
 * kettle, say. Without it, the first prototype.
 */
export function variantOf(visual: string): number {
  if (typeof location === 'undefined') return 0;
  return Number(new URLSearchParams(location.search).get(visual)) || 0;
}
