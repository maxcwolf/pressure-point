// Room templates, kept apart from any one game so they can be built in every game.
import { readTemplates, type Template } from '../core/templates';

const KEY = 'pressure-point-room-templates';

/** The templates saved, or none. */
export function loadTemplates(): Template[] {
  try {
    return readTemplates(JSON.parse(localStorage.getItem(KEY) ?? '[]'));
  } catch {
    return [];
  }
}

/** Keep the templates for this game and the next. False if the browser's storage is full. */
export function saveTemplates(list: readonly Template[]): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.map(({ name, layout }) => ({ name, layout }))));
    return true;
  } catch {
    return false;
  }
}
