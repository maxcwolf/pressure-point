// The tool hint as a row of chips: the hints are written as phrases joined by middle dots, and each phrase becomes a
// chip of its own kind, so the name, the cost, the keys and the colored squares can be told apart at a glance.

/** One phrase of a hint, and what kind of phrase it is. */
export type HintChip =
  /** What is in hand, or what to do first, which leads the row. */
  | { kind: 'name'; text: string }
  /** What it costs, or gives back. */
  | { kind: 'cost'; text: string }
  /** A key, and what pressing it does. */
  | { kind: 'key'; key: string; text: string }
  /** Who the squares of one color are for. */
  | { kind: 'legend'; squares: 'staff' | 'guest'; text: string }
  /** Any other step. */
  | { kind: 'step'; text: string };

/** A key a hint can lead a phrase with. */
const KEY = /^(R|Esc|Enter) /;
/** The start of a phrase saying what the colored squares mean, as `legend` in the tools writes it. */
const LEGEND = /^(purple|orange) square: /;

/** A hint's phrases, each as a chip. */
export function hintChips(hint: string): HintChip[] {
  return hint.split(' · ').map((text, i): HintChip => {
    if (i === 0) return { kind: 'name', text };
    const legend = LEGEND.exec(text)?.[0];
    if (legend)
      return {
        kind: 'legend',
        squares: legend.startsWith('purple') ? 'staff' : 'guest',
        text: text.slice(legend.length),
      };
    const key = KEY.exec(text)?.[0];
    if (key) return { kind: 'key', key: key.trim(), text: text.slice(key.length) };
    if (text.includes('$')) return { kind: 'cost', text };
    return { kind: 'step', text };
  });
}
