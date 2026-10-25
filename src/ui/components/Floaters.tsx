// Text that drifts up from a point in the world, such as money earned. It is drawn where that point is on screen every
// frame, so it stays put in the world as the camera moves, and rises by `transform`, which costs no layout.

import { useEffect, useRef } from 'preact/hooks';

import { css } from '../../styled-system/css';
import { useHud } from '../hooks/use-hud';
import { cx } from '../lib/cx';
import { FLOAT_LIFE } from '../lib/floaters';

/** How high a floater rises over its life, and how far apart the rows of floaters close together are, in pixels. */
const RISE = 60;
const ROW = 24;
/** How high above the ground the text starts, in meters. */
const HEIGHT = 1.6;

/**
 * A floater: white words outlined in navy, green for good news and red for bad. It is placed and faded every frame from
 * its point in the world (see `Floaters` below); hidden until then.
 */
const floater = css({
  position: 'absolute',
  left: '[0]',
  top: '[0]',
  opacity: '[0]',
  fontWeight: '[700]',
  fontSize: '[19px]',
  color: 'white',
  WebkitTextStroke: '[4px {colors.navy}]',
  paintOrder: 'stroke fill',
  whiteSpace: 'nowrap',
  willChange: 'transform, opacity',
  '&.good': { color: '[#7dffb0]' },
  '&.bad': { color: '[#ff9a92]' },
});

/** The floating text currently on screen. */
export function Floaters() {
  const hud = useHud();
  const layer = useRef<HTMLDivElement>(null);
  const any = hud.floaters.length > 0;
  // a frame loop only while there is something floating: it stops once the last has gone, and starts with the next
  useEffect(() => {
    if (!any) return undefined;
    let frame = 0;
    let prev = performance.now();
    /** Run the floaters on, and put each where its point is on screen now. */
    const step = (now: number) => {
      hud.ageFloaters(Math.min(0.1, (now - prev) / 1000));
      prev = now;
      const byId = new Map(hud.floaters.map((f) => [String(f.id), f]));
      for (const el of layer.current?.children ?? []) {
        const f = el instanceof HTMLElement ? byId.get(el.dataset.id ?? '') : undefined;
        if (!f || !(el instanceof HTMLElement)) continue;
        const at = hud.host.view.project(f.x, f.y, HEIGHT);
        const t = f.age / FLOAT_LIFE;
        const up = RISE * t + f.row * ROW;
        el.style.transform = `translate(${at.x}px, ${at.y - up}px) translate(-50%, -50%)`;
        el.style.opacity = String(Math.min(1, t / 0.15, (1 - t) / 0.35));
      }
      if (hud.floaters.length) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(frame);
    };
  }, [hud, any]);
  return (
    <div class="floaters" ref={layer}>
      {hud.floaters.map((f) => (
        // keyed by the floater, so one that money is added to keeps its place and just says more
        <div key={f.id} data-id={f.id} class={cx(floater, f.kind)}>
          {f.text}
        </div>
      ))}
    </div>
  );
}
