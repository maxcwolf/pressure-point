// A line of words for the interface with the icon that goes before it, for the notes that lead with one.

import type { IconId } from '../../core/data';

/** Words, and the icon before them where they have one. */
export interface IconLine {
  icon?: IconId | undefined;
  text: string;
}
