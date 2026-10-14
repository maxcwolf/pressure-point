// The settings the model lab offers, each kept on an object under a name so the page can read and change it.

/** The names on an object whose values are of one type. */
type KeyOf<O, V> = { [K in keyof O]-?: O[K] extends V ? K : never }[keyof O] & string;

/** Where a setting is kept. */
interface Slot {
  of: Record<string, unknown>;
  key: string;
  /** Build the model afresh when it changes, for a setting the model is built with. */
  rebuild: boolean;
}

export type Option = readonly [value: string, label: string];

/** A setting the lab offers, or a button that does something at once. */
export type Control =
  | (Slot & { kind: 'range'; label: string; min: number; max: number })
  | (Slot & { kind: 'toggle'; label: string })
  | (Slot & { kind: 'choice'; label: string; options: readonly Option[] })
  | { kind: 'button'; label: string; run: () => void; rebuild: boolean };

/** A slider for a number from min to max. */
export function range<O extends object>(label: string, of: O, key: KeyOf<O, number>, min = 0, max = 100): Control {
  return { kind: 'range', label, of: of as Record<string, unknown>, key, min, max, rebuild: false };
}

/** A switch for something on or off. */
export function toggle<O extends object>(label: string, of: O, key: KeyOf<O, boolean>, rebuild = false): Control {
  return { kind: 'toggle', label, of: of as Record<string, unknown>, key, rebuild };
}

/** A menu of choices. */
export function choice<O extends object>(
  label: string,
  of: O,
  key: KeyOf<O, string>,
  options: readonly Option[],
  rebuild = false,
): Control {
  return { kind: 'choice', label, of: of as Record<string, unknown>, key, options, rebuild };
}

/** A button. */
export function button(label: string, run: () => void, rebuild = false): Control {
  return { kind: 'button', label, run, rebuild };
}
