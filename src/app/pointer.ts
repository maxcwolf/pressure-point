// The mouse on the game canvas: clicking with a tool, dragging the camera and zooming.

import type { Audio } from '../audio';
import type { View } from '../render/view';
import type { UI } from '../ui/ui';
import { isClick, isDragging } from './click';
import type { Tools } from './tools';

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
  /** Whether a room's floor is being dragged out. */
  const draggingRoom = () => tools.tool.kind === 'room' && tools.tool.phase === 'drag';

  canvas.addEventListener('pointerdown', (e) => {
    audio.unlock();
    canvas.setPointerCapture(e.pointerId);
    down = { x: e.clientX, y: e.clientY, button: e.button, moved: false, at: performance.now() };
    last = { x: e.clientX, y: e.clientY };
    if (e.button === 0) {
      ui.closeMenu();
      tools.pointerDown(e.clientX, e.clientY);
    }
  });
  canvas.addEventListener('pointermove', (e) => {
    if (down) {
      if (isDragging(e.clientX - down.x, e.clientY - down.y)) down.moved = true;
      // with no tool in hand a left drag moves the camera, as do right and middle drags
      const pans = down.button !== 0 || (!tools.active && down.moved);
      if (pans && down.moved) view.panPixels(e.clientX - last.x, e.clientY - last.y);
    }
    last = { x: e.clientX, y: e.clientY };
    tools.pointerMove(e.clientX, e.clientY);
  });
  canvas.addEventListener('pointerup', (e) => {
    const d = down;
    down = null;
    if (!d) return;
    const click = isClick(d.moved, performance.now() - d.at, Math.hypot(e.clientX - d.x, e.clientY - d.y));
    if (d.button === 0) {
      if (click || draggingRoom()) tools.pointerUp(e.clientX, e.clientY);
    } else if (d.button === 2 && click) {
      if (tools.active) tools.back();
      else tools.select(null);
    }
  });
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
  ui: UI;
}
