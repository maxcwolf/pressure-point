// Small helpers for working with the page.
import { must } from '../core/util';

/** The element with this id, which must exist. */
export function byId(id: string): HTMLElement {
  return must(document.getElementById(id), `#${id}`);
}

/** The first element matching a selector, which must exist. */
export function query(parent: ParentNode, selector: string): HTMLElement {
  return must(parent.querySelector<HTMLElement>(selector), selector);
}

const HTML_ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };

/** Make text safe to put inside HTML. */
export function escapeHtml(text: string): string {
  return text.replace(/[&<>"]/g, (c) => HTML_ESCAPES[c] ?? c);
}
