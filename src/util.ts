// Small helpers shared across the game.

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

/** A value that is known to exist. A miss is a bug in the caller, so it throws. */
/** Whether a value read from storage or a file is a plain object whose fields can be inspected. */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

const HTML_ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };

/** Make text safe to put inside HTML. */
export function escapeHtml(text: string): string {
  return text.replace(/[&<>"]/g, (c) => HTML_ESCAPES[c] ?? c);
}

export function must<T>(value: T | null | undefined, what: string): T {
  if (value === null || value === undefined) throw new Error(`missing ${what}`);
  return value;
}
