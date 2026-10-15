// Finding parts of the page that are always there, and handing files to the browser.

import { must } from '../core/util';

/** The element with this id, which must exist. */
export function byId(id: string): HTMLElement {
  return must(document.getElementById(id), `#${id}`);
}

/** Hand a file to the browser to download. */
export function download(filename: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 2000);
}
