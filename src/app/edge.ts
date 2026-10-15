// Edge scrolling: the camera moves while the mouse is held at the edge of the window.

/** How close to the edge of the window, in pixels, the mouse must be to move the camera. */
export const EDGE_PX = 8;

/** Which way to move the camera for the mouse at this point in a window this size: -1, 0 or 1 across and up. */
export function edgePan(x: number, y: number, width: number, height: number): [number, number] {
  const across = x < EDGE_PX ? -1 : x >= width - EDGE_PX ? 1 : 0;
  const up = y < EDGE_PX ? 1 : y >= height - EDGE_PX ? -1 : 0;
  return [across, up];
}

/** Where the mouse is in the window, or null when it is outside it. */
export interface MouseSpot {
  at: { x: number; y: number } | null;
}

/** Follow the mouse around the window, forgetting it when it leaves or the window loses focus. */
export function trackMouse(): MouseSpot {
  const spot: MouseSpot = { at: null };
  window.addEventListener('mousemove', (e) => {
    spot.at = { x: e.clientX, y: e.clientY };
  });
  document.addEventListener('mouseleave', () => {
    spot.at = null;
  });
  window.addEventListener('blur', () => {
    spot.at = null;
  });
  return spot;
}
