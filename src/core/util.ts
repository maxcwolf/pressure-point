// Small helpers with no knowledge of the game.

/**
 * The element at an index that is known to be in range.
 * A miss is a bug in the caller, so it throws rather than returning undefined.
 */
export function at<T>(list: ArrayLike<T>, index: number): T {
  const value = list[index];
  if (value === undefined)
    throw new RangeError(`index ${String(index)} is out of range (length ${String(list.length)})`);
  return value;
}

/** A value that is known to be present. Throws if it is missing. */
export function must<T>(value: T | null | undefined, what: string): T {
  if (value === null || value === undefined) throw new Error(`missing ${what}`);
  return value;
}

/** Keep a number between a lower and an upper bound. */
export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
