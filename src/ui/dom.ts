// Finding parts of the page that are always there.

import { must } from '../core/util';

/** The element with this id, which must exist. */
export function byId(id: string): HTMLElement {
  return must(document.getElementById(id), `#${id}`);
}
