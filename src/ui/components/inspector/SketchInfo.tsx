// The inspector for a room pencilled in: what it is, what it will cost, whether it still fits, the template it
// remembers if any, and Erase, Move, Forget template and Build here.

import { ROOMS } from '../../../core/data';
import { money } from '../../../core/format';
import { sketchCost } from '../../../core/sim/sketches';
import type { Sketch } from '../../../core/state/types';
import { css } from '../../../styled-system/css';
import { dangerButton, goButton } from '../../../styled-system/recipes';
import { useGame } from '../../hooks/use-hud';
import { cx } from '../../lib/cx';
import { sketchNote } from '../../lib/sketches';
import { Button } from '../common/Button';
import { IconText } from '../common/Icon';
import { smallButton } from './looks';

/** The room's name, with the tag saying it is pencilled in at the far end. */
const head = css({ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8' });

/** A dashed pill saying the room is pencilled in, not built. */
const pencilled = css({
  fontSize: '12',
  fontWeight: 'bold',
  border: '[{borderWidths.fine} dashed {colors.outline}]',
  borderRadius: 'pill',
  py: '1',
  px: '8',
  whiteSpace: 'nowrap',
});

/** A row of chips. */
const chips = css({ display: 'flex', flexWrap: 'wrap', gap: '6', mb: '6' });

/**
 * A chip: its size, its price, whether it fits, the template it remembers. Green and ticked when it fits, amber when it
 * no longer does.
 */
const chip = css({
  fontSize: '12',
  fontWeight: 'medium',
  border: 'outline.thin',
  borderRadius: 'pill',
  py: '2',
  px: '8',
  bg: 'bg.card',
  '&.done': { bg: 'good.bg', color: 'good', borderColor: 'good' },
  '&.unfit': { bg: 'warn.bg', color: 'warn', borderColor: 'warn' },
});

/** Why it no longer fits, in amber. */
const unfit = css({ color: 'warn', fontWeight: 'bold' });

/** Its buttons: Erase and Move at either end, then Forget template and Build here, each on a line of its own. */
const buttons = css({
  display: 'flex',
  flexWrap: 'wrap',
  justifyContent: 'space-between',
  gap: '6',
  '& button': { mt: '4', py: '4', px: '12', fontSize: '14' },
});

/** What puts the buttons after it on a line of their own. */
const lineBreak = css({ flexBasis: 'full', h: '0' });

/** A sketch: its room and size, its price when built, whether it fits today and why not, and what can be done with it. */
export function SketchInfo({ sketch }: { sketch: Sketch }) {
  const { sim, tools } = useGame();
  const def = ROOMS[sketch.type];
  const cost = sketchCost(sketch);
  // worked out once each time the world changes under it, and shared with the floor and its label
  const { fit, standing } = sim.world.sketchFit(sketch);
  return (
    <>
      {/* `sketch-head` is for the visual tests to find it by */}
      <h3 class={cx('sketch-head', head)}>
        <IconText id={def.icon}>{def.name}</IconText>
        <span class={pencilled}>✎ pencilled in</span>
      </h3>
      <div class={chips}>
        <span class={chip}>{`${sketch.w}×${sketch.h}`}</span>
        <span class={chip}>{`${money(cost)} to build`}</span>
        <span class={cx(chip, fit.ok ? 'done' : standing !== 'waits' && 'unfit')}>
          {fit.ok ? '✔ Fits here today' : standing === 'waits' ? '⌛ Waits for its land' : "⚠ Doesn't fit today"}
        </span>
        {sketch.template !== undefined && <span class={chip}>{`Template: ${sketch.template}`}</span>}
      </div>
      {!fit.ok && <p class={cx('sub', standing !== 'waits' && unfit)}>{fit.reason}</p>}
      <p class="sub">{sketchNote(sketch, sim.s)}</p>
      {/* the panel's two rows of buttons: what to do with the sketch, then what to do with the room */}
      <div class={buttons}>
        <Button
          class={dangerButton()}
          quiet
          onPress={() => {
            sim.eraseSketch(sketch.id);
            tools.select(null);
          }}
        >
          Erase
        </Button>
        <Button
          class={smallButton}
          title="Pick the sketch up and draw it again somewhere else. Free."
          onPress={() => {
            tools.moveSketch(sketch.id);
          }}
        >
          Move
        </Button>
        {sketch.layout && <i class={lineBreak} />}
        {sketch.layout && (
          <Button
            class={smallButton}
            title="Keep the floor and door pencilled in, without the furniture and windows."
            onPress={() => {
              sim.forgetTemplate(sketch.id);
            }}
          >
            Forget template
          </Button>
        )}
        {sketch.layout && <i class={lineBreak} />}
        <Button
          class={goButton()}
          title={
            sketch.layout
              ? 'Build the whole room right here, furniture, windows and all.'
              : fit.ok
                ? 'Open its blueprint right here.'
                : 'Drag its floor out again where it fits, then its blueprint.'
          }
          onPress={() => {
            tools.buildSketch(sketch.id);
          }}
        >
          {`Build here · ${money(sketch.layout ? cost : ROOMS[sketch.type].cost)}`}
        </Button>
      </div>
    </>
  );
}
