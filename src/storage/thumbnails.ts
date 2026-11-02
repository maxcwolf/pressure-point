// A small picture of each saved game, kept beside it for the title screen.
//
// Pictures are stored apart from the saves, as JPEG data URLs, so a save's data stays plain JSON
// and a missing picture never stops a game loading. Each profile keeps its own, as it keeps its saves.
import { profileGone, profileKey } from './profiles';

/** The storage key a save's picture is kept under. */
const thumbKey = (id: string) => profileKey(`pressure-point-thumb:${id}`);

/** Keep a picture for a save. Out of room, or with its profile deleted since, the save simply goes without one. */
export function storeThumb(id: string, dataUrl: string) {
  if (profileGone()) return;
  try {
    localStorage.setItem(thumbKey(id), dataUrl);
  } catch {
    // a save without a picture is still a save
  }
}

/** A save's picture, or null if it has none. */
export function readThumb(id: string): string | null {
  try {
    return localStorage.getItem(thumbKey(id));
  } catch {
    return null;
  }
}

/** Forget a save's picture. */
export function dropThumb(id: string) {
  try {
    localStorage.removeItem(thumbKey(id));
  } catch {
    // nothing more to do
  }
}

/** Give one save the picture of another, or none if the other has none. */
export function copyThumb(from: string, to: string) {
  const picture = readThumb(from);
  if (picture) storeThumb(to, picture);
  else dropThumb(to);
}
