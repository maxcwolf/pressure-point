// Lookups for parts of the page that are always there, so a missing one fails loudly.
import { must } from '../core/util';

/** The element with this id, which must exist. */
export function byId(id: string): HTMLElement {
  return must(document.getElementById(id), `#${id}`);
}

/** The first element matching a selector, which must exist. */
export function query(parent: ParentNode, selector: string): HTMLElement {
  return must(parent.querySelector<HTMLElement>(selector), selector);
}
