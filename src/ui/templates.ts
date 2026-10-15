// Keeping room templates: saving a room as one, and storing the list after any change, with a message when it fails.

import type { Layout } from '../core/room-layout';
import { addTemplate, freshName, layoutProblem, MAX_TEMPLATES, type Template } from '../core/templates';
import { saveTemplates } from '../storage/templates';
import type { HudState } from './hud';

/** Replace the templates and store them for later games. False, with a message, if the browser's storage is full. */
export function keepTemplates(hud: HudState, list: Template[]): boolean {
  if (!saveTemplates(list)) {
    hud.toast("Could not keep the templates: the browser's storage is full. Delete or export some saves first.", 'bad');
    return false;
  }
  hud.templates = list;
  hud.update();
  return true;
}

/** Save a room's layout as a new template, named after the room, and say where to find it. */
export function saveAsTemplate(hud: HudState, layout: Layout) {
  if (hud.templates.length >= MAX_TEMPLATES) {
    hud.toast(`There is room for ${MAX_TEMPLATES} templates. Delete one in the Rooms menu first.`, 'bad');
    return;
  }
  const problem = layoutProblem(layout);
  if (problem) {
    hud.toast(`Can't save this room as a template: ${problem}.`, 'bad');
    return;
  }
  const name = freshName(
    layout.type,
    hud.templates.map((t) => t.name),
  );
  if (keepTemplates(hud, addTemplate(hud.templates, name, layout)))
    hud.toast(`Saved as the template "${name}". Build it again from the Rooms menu.`, 'good');
}
