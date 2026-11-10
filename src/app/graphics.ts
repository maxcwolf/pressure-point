// The Graphics setting the scene is drawn with: the player's choice in Settings, kept with the display settings, which
// the renderer cannot read for itself, so it is handed over here before the view is built. Until the player chooses,
// the computer decides: Full with a graphics card, and Plain without one, where the game is drawn in software and Full
// takes about half as long again a frame (550 ms against 367 ms on a CI machine, 117 ms against 83 ms on a fast
// laptop). A dev build also takes it from the page's address, `?graphics=plain` or `?graphics=full`, so the tests and
// pictures of the game can draw either whatever is stored.

import { setGraphics } from '../render/fx';
import { GRAPHICS, type Graphics, loadDisplay } from '../storage/display';

/** The graphics an address's query asks for, if it names one the game has. */
export function askedGraphics(search: string): Graphics | undefined {
  const asked = new URLSearchParams(search).get('graphics');
  return GRAPHICS.find((g) => g === asked);
}

/**
 * Whether a graphics driver, by the name WebGL gives for it, draws in software rather than on a graphics card:
 * Chromium's own SwiftShader, Mesa's llvmpipe and softpipe, Windows's Basic Render Driver, and any that says so.
 */
export const softwareRenderer = (name: string): boolean =>
  /swiftshader|llvmpipe|softpipe|software|basic render/i.test(name);

/** Whether this computer draws in software: unknown until first asked. */
let software: boolean | undefined;

/**
 * Whether this computer draws the game in software, with no graphics card it can use: asked once of a WebGL context
 * made for the question and let go, and kept. Where there is no page to ask, or the driver is not named, it is taken
 * to have one.
 */
export function drawnInSoftware(): boolean {
  if (software !== undefined) return software;
  software = false;
  if (typeof document === 'undefined') return software;
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    const named = gl?.getExtension('WEBGL_debug_renderer_info');
    if (gl && named) software = softwareRenderer(String(gl.getParameter(named.UNMASKED_RENDERER_WEBGL)));
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
  } catch {
    // a computer that will not say is taken to have a graphics card
  }
  return software;
}

/**
 * The graphics to draw with: what a dev build's address asks for, else the player's choice, else what suits the
 * computer, Plain drawn in software and Full on a graphics card.
 */
export const graphicsFor = (asked: Graphics | undefined, chosen: Graphics | undefined, inSoftware: boolean): Graphics =>
  asked ?? chosen ?? (inSoftware ? 'plain' : 'full');

/** The graphics the game is drawn with on this computer, as Settings shows it. */
export function graphicsInUse(): Graphics {
  const asked = import.meta.env.DEV ? askedGraphics(location.search) : undefined;
  const chosen = loadDisplay().graphics;
  // the computer is only asked how it draws when neither settles it
  return graphicsFor(asked, chosen, !asked && !chosen && drawnInSoftware());
}

/** Hand the renderer the graphics to draw with. */
export function applyGraphics() {
  setGraphics(graphicsInUse());
}
