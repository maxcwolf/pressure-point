// The mouse on the game canvas: clicking with a tool, dragging the camera and zooming, and showing what a click would
// select.

import type { Audio } from '../audio';
import { nextPick } from '../render/picking';
import type { View } from '../render/view';
import type { HudState } from '../ui/hud';
import { isClick, isDragging } from './click';
import type { Tools } from './tools/tools';

/** How often what is under a still pointer is looked at again, in milliseconds, as people walk in and out from under it. */
const HOVER_RECHECK_MS = 250;

interface Press {
  x: number;
  y: number;
  button: number;
  moved: boolean;
  at: number;
}

/** Listen for the mouse on the canvas and pass what it does to the tools and the camera. */
export function bindPointer(canvas: HTMLCanvasElement, { audio, tools, view, ui }: PointerTargets) {
  let down: Press | null = null;
  let last = { x: 0, y: 0 };
  /** Whether a room's floor or wall is being dragged, so letting go counts even after a long drag. */
  const draggingRoom = () => tools.dragging;
  /** Where the pointer is over the canvas, or null once it has left. */
  let over: { x: number; y: number } | null = null;
  /** The frame and the timer waiting to look at what is under the pointer, if any. */
  let frame = 0;
  let recheck = 0;

  /**
   * Show what a click would select under the pointer, and a hand for the pointer if anything: nothing while a button is
   * held, while a tool in hand draws its own preview, or once the pointer has left the canvas.
   */
  const hover = () => {
    frame = 0;
    clearTimeout(recheck);
    const at = over && !down && !tools.active ? over : null;
    const sel = at ? nextPick(view.pickAll(at.x, at.y), tools.selected) : null;
    view.overlays.hovered = sel;
    canvas.style.cursor = sel ? 'pointer' : '';
    if (over) recheck = window.setTimeout(hoverSoon, HOVER_RECHECK_MS);
  };
  /** Look at what is under the pointer on the next frame, once however often it moves before then. */
  const hoverSoon = () => {
    if (!frame) frame = requestAnimationFrame(hover);
  };
  canvas.addEventListener('pointerleave', () => {
    over = null;
    hoverSoon();
  });

  canvas.addEventListener('pointerdown', (e) => {
    audio.unlock();
    canvas.setPointerCapture(e.pointerId);
    down = { x: e.clientX, y: e.clientY, button: e.button, moved: false, at: performance.now() };
    last = { x: e.clientX, y: e.clientY };
    if (e.button === 0) {
      ui.closeMenu();
      tools.pointerDown(e.clientX, e.clientY);
    }
    hoverSoon();
  });
  canvas.addEventListener('pointermove', (e) => {
    if (down) {
      if (isDragging(e.clientX - down.x, e.clientY - down.y)) down.moved = true;
      // with no tool in hand a left drag moves the camera, as do right and middle drags
      const pans = down.button !== 0 || (!tools.active && down.moved);
      if (pans && down.moved) view.panPixels(e.clientX - last.x, e.clientY - last.y);
    }
    last = { x: e.clientX, y: e.clientY };
    over = { x: e.clientX, y: e.clientY };
    tools.pointerMove(e.clientX, e.clientY);
    hoverSoon();
  });
  canvas.addEventListener('pointerup', (e) => {
    const d = down;
    down = null;
    hoverSoon();
    if (!d) return;
    const click = isClick(d.moved, performance.now() - d.at, Math.hypot(e.clientX - d.x, e.clientY - d.y));
    if (d.button === 0) {
      if (click || draggingRoom()) tools.pointerUp(e.clientX, e.clientY);
    } else if (d.button === 2 && click) {
      if (tools.active) tools.back();
      else tools.select(null);
    }
  });
  /** Forget a press the browser has taken away, without acting on it, so hovering afterwards does not pan. */
  const cancel = () => {
    down = null;
  };
  canvas.addEventListener('pointercancel', cancel);
  canvas.addEventListener('lostpointercapture', cancel);
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  canvas.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      view.zoom(Math.max(-0.25, Math.min(0.25, e.deltaY * 0.0015)));
    },
    { passive: false },
  );
}

/** What the mouse acts on. */
export interface PointerTargets {
  audio: Audio;
  tools: Tools;
  view: View;
  ui: HudState;
}
