// The labels on rooms pencilled in: the room's icon and name, and its size or what has gone wrong with it, over the
// middle of its sketch on the floor. With the Plans overlay on, every sketch has one, saying its price and fit.
// Like the floating text, each is put where its point is on screen every frame, so it stays on its sketch as the camera
// moves, and costs no draw calls.

import './SketchLabels.css';

import { useEffect, useRef } from 'preact/hooks';

import { ROOMS } from '../../core/data';
import { useHud } from '../hooks/use-hud';
import { cx } from '../lib/cx';
import { plansTag, sketchTag } from '../lib/sketches';
import { Icon } from './common/Icon';

/**
 * The label on each room pencilled in, but the one selected, which its outline and the inspector speak for; with the
 * Plans overlay on, every one, the selected one too.
 */
export function SketchLabels() {
  const hud = useHud();
  const { sim, view } = hud.host;
  const layer = useRef<HTMLDivElement>(null);
  const plans = hud.overlay === 'plans';
  const selected = view.selected?.kind === 'sketch' && !plans ? view.selected.id : 0;
  const shown = sim.s.sketches.filter((sk) => sk.id !== selected);
  const any = shown.length > 0;
  // a frame loop only while there is a label to place
  useEffect(() => {
    if (!any) return undefined;
    let frame = 0;
    /** Put each label over the middle of its sketch as it is on screen now. */
    const step = () => {
      for (const el of layer.current?.children ?? []) {
        if (!(el instanceof HTMLElement)) continue;
        const sk = sim.sketch(Number(el.dataset.id));
        if (!sk) continue;
        const at = view.project(sk.x + sk.w / 2, sk.y + sk.h / 2);
        const place = `translate(${Math.round(at.x)}px, ${Math.round(at.y)}px) translate(-50%, -50%)`;
        if (el.style.transform !== place) el.style.transform = place;
      }
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(frame);
    };
  }, [sim, view, any]);
  return (
    <div class="sketch-labels" ref={layer}>
      {shown.map((sk) => {
        // worked out once each time the world changes, and shared with the floor and the panel
        const fit = sim.world.sketchFit(sk);
        const unfit = fit.standing === 'doorway' || fit.standing === 'unfit';
        return (
          <div key={sk.id} data-id={sk.id} class={cx('sketch-label', unfit && 'unfit')}>
            <Icon id={ROOMS[sk.type].icon} size={18} />
            <b>{ROOMS[sk.type].name}</b>
            <small>{plans ? plansTag(sk, fit) : sketchTag(sk, fit)}</small>
          </div>
        );
      })}
    </div>
  );
}
