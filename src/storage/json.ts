// Checking what comes back out of storage before trusting it.

/** Whether a value read from storage or a file is a plain object whose fields can be inspected. */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
