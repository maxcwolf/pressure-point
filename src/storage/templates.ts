// Room templates, kept apart from any one game so they can be built in every game of the profile that saved them.
import { readTemplates, type Template } from '../core/templates';
import { currentProfile, profileGone, profileKey, scoped } from './profiles';

const KEY = 'pressure-point-room-templates';

/** The templates saved, or none: this profile's, or another's for the profiles list to say what deleting it loses. */
export function loadTemplates(profile = currentProfile()): Template[] {
  try {
    return readTemplates(JSON.parse(localStorage.getItem(scoped(profile, KEY)) ?? '[]'));
  } catch {
    return [];
  }
}

/** Keep the templates for this game and the next. False if the browser's storage is full, or the profile deleted. */
export function saveTemplates(list: readonly Template[]): boolean {
  if (profileGone()) return false;
  try {
    localStorage.setItem(profileKey(KEY), JSON.stringify(list.map(({ name, layout }) => ({ name, layout }))));
    return true;
  } catch {
    return false;
  }
}
