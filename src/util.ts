// Small helpers for the parts of the app that deal with storage and HTML.

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
