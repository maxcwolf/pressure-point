// Lookups for parts of the page that are always there, so a missing one fails loudly.
import { must } from '../util';

export function byId(id: string): HTMLElement {
  return must(document.getElementById(id), `#${id}`);
}

export function query(parent: ParentNode, selector: string): HTMLElement {
  return must(parent.querySelector<HTMLElement>(selector), selector);
}
