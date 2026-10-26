// The inspector for a room pencilled in: what it is, what it will cost, whether it still fits, and Erase, Move and
// Build here.

import { ROOMS } from '../../../core/data';
import { money } from '../../../core/format';
import { sketchCost } from '../../../core/sim/sketches';
import type { Sketch } from '../../../core/state/types';
import { useGame } from '../../hooks/use-hud';
import { cx } from '../../lib/cx';
import { sketchNote } from '../../lib/sketches';
import { Button } from '../common/Button';
import { IconText } from '../common/Icon';

/** A sketch: its room and size, its price when built, whether it fits today and why not, and what can be done with it. */
export function SketchInfo({ sketch }: { sketch: Sketch }) {
  const { sim, tools } = useGame();
  const def = ROOMS[sketch.type];
  const cost = sketchCost(sketch);
  // worked out once each time the world changes under it, and shared with the floor and its label
  const { fit, standing } = sim.world.sketchFit(sketch);
  return (
    <>
      <h3 class="sketch-head">
        <IconText id={def.icon}>{def.name}</IconText>
        <span class="pencilled">✎ pencilled in</span>
      </h3>
      <div class="chips sketch-chips">
        <span class="chip">{`${sketch.w}×${sketch.h}`}</span>
        <span class="chip">{`${money(cost)} to build`}</span>
        <span class={cx('chip', fit.ok ? 'done' : standing !== 'waits' && 'unfit')}>
          {fit.ok ? '✔ Fits here today' : standing === 'waits' ? '⌛ Waits for its land' : "⚠ Doesn't fit today"}
        </span>
      </div>
      {!fit.ok && <p class={cx('sub', standing !== 'waits' && 'unfit')}>{fit.reason}</p>}
      <p class="sub">{sketchNote(sketch, sim.s)}</p>
      <div class="sketch-buttons">
        <Button
          class="danger"
          quiet
          onPress={() => {
            sim.eraseSketch(sketch.id);
            tools.select(null);
          }}
        >
          Erase
        </Button>
        <Button
          class="sketchmove"
          title="Pick the sketch up and draw it again somewhere else. Free."
          onPress={() => {
            tools.moveSketch(sketch.id);
          }}
        >
          Move
        </Button>
        <Button
          class="go"
          title={
            fit.ok ? 'Open its blueprint right here.' : 'Drag its floor out again where it fits, then its blueprint.'
          }
          onPress={() => {
            tools.buildSketch(sketch.id);
          }}
        >
          {`Build here · ${money(ROOMS[sketch.type].cost)}`}
        </Button>
      </div>
    </>
  );
}
