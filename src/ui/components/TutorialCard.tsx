// The tutorial's step in hand, in the advisor's spot: which step it is, what it asks and why, a button that shows
// where, and a way to skip the rest.

import type { TutorialStep } from '../../core/sim/tutorial';
import { css } from '../../styled-system/css';
import { useHud } from '../hooks/use-hud';
import { cx } from '../lib/cx';
import { Button } from './common/Button';

/**
 * The card: the advisor's note, with a step count, a title and buttons. `note` takes the note's look from the advisor
 * (Advisor.tsx), and `tutorial-card` is for the end-to-end tests to find it by.
 */
const card = css({ pointerEvents: 'auto', maxW: 'panel.tutorial', '& p': { m: '0' } });

/** The step count, with the way to skip the rest at its right. */
const top = css({ display: 'flex', alignItems: 'baseline', gap: '12' });

/** The step count, in the advisor's word over a note (`kicker`), taking the room the skip leaves. */
const kicker = css({ flex: '1' });

/** Skip the tutorial, as a faint underlined link. */
const skip = css({
  flex: 'none',
  border: 'none',
  p: '0',
  bg: '[none]',
  fontSize: '12',
  color: 'fg',
  opacity: 'quiet',
  textDecoration: 'underline',
  _hover: { opacity: 'full' },
});

/** The step's title, over what it asks. */
const title = css({ display: 'block', fontSize: '15', mb: '2' });

/** Show me: a teal button that lifts under the pointer. */
const show = css({
  mt: '8',
  border: 'outline',
  borderRadius: '12',
  py: '4',
  px: '14',
  fontWeight: 'bold',
  fontSize: '14',
  bg: 'accent',
  color: 'fg.on-accent',
  boxShadow: 'low',
  _hover: { filter: '[brightness(1.06)]', transform: '[translateY(-1px)]' },
});

/** The card for a step, with Show me when there is a menu to open or someone to show. */
export function TutorialCard({ step }: { step: TutorialStep }) {
  const hud = useHud();
  const want = step.want;
  const opens = want !== undefined && want.kind !== 'look' && want.kind !== 'pause' && want.kind !== 'play';
  const showable = opens || step.about !== undefined;
  return (
    <div class={cx('note', 'tutorial-card', card)}>
      <div class={top}>
        <span class={cx('kicker', kicker)}>{`Tutorial · step ${step.n} of ${step.of}`}</span>
        <Button
          class={skip}
          onPress={() => {
            hud.skipTutorial();
          }}
        >
          Skip the tutorial
        </Button>
      </div>
      <b class={title}>{step.title}</b>
      <p>{step.text}</p>
      {showable && (
        <Button
          class={show}
          onPress={() => {
            hud.showStep(step);
          }}
        >
          Show me
        </Button>
      )}
    </div>
  );
}
