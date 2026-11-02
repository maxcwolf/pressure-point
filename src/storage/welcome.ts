// Whether the player has read the welcome to the alpha, kept for each profile, so someone new to the game is welcomed.
import { profileKey } from './profiles';

const KEY = 'pressure-point-welcomed';

/** Whether the welcome has been read and put away. */
export function welcomeSeen(): boolean {
  try {
    return localStorage.getItem(profileKey(KEY)) !== null;
  } catch {
    // with no storage, welcoming the player every time is better than never
    return false;
  }
}

/** Remember that the welcome has been read. */
export function saveWelcomeSeen() {
  try {
    localStorage.setItem(profileKey(KEY), '1');
  } catch {
    // the welcome stays away until the page closes
  }
}
