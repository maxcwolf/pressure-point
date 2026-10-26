// Bottom left: the advisor's current nudge, held long enough to read, its first sentence bold and a word over it saying
// what kind it is if it has one. One about someone or something takes you there when clicked. While the tutorial has
// a step in hand, its card instead, which is never held.

import { css } from '../../styled-system/css';
import { useGame, useHud } from '../hooks/use-hud';
import { headline } from '../lib/advice-hold';
import { cx } from '../lib/cx';
import { Button } from './common/Button';
import { Icon } from './common/Icon';
import { TutorialCard } from './TutorialCard';

/**
 * Bottom left, standing on the bar along the bottom: the advisor's face, and their note beside it. The note, the
 * advisor's own or the tutorial's card (TutorialCard.tsx), takes its look from here by its `note` class, and the word
 * over it by `kicker`.
 */
const advisor = css({
  left: '[14px]',
  bottom: '[var(--bar-h)]',
  maxW: '[470px]',
  display: 'flex',
  alignItems: 'flex-end',
  gap: '8',
  // a speech bubble, its corner by the face cut small
  '& .note': {
    bg: 'bg.panel',
    border: 'outline.thick',
    borderRadius: '[16px 16px 16px 4px]',
    py: '8',
    px: '12',
    fontSize: '14',
    lineHeight: 'snug',
    boxShadow: 'raised',
    textAlign: 'left',
  },
  // a note about something going wrong now: a red edge down its left
  '& .note.alarm': { borderLeft: '[{borderWidths.stripe} solid {colors.bad.solid}]' },
  // what kind of note it is, or which step of the tutorial, in small teal capitals over it
  '& .kicker': {
    display: 'block',
    fontSize: '12',
    fontWeight: 'bold',
    letterSpacing: 'wider',
    textTransform: 'uppercase',
    color: 'fg.accent',
    mb: '2',
  },
});

/** The advisor's face, on a gold disc. */
const face = css({
  w: '[50px]',
  h: '[50px]',
  flex: 'none',
  borderRadius: 'disc',
  bg: 'highlight',
  border: 'outline.thick',
  display: 'grid',
  placeItems: 'center',
  boxShadow: 'raised',
});

/** A note's words: a new note fades in where the last one was, its first sentence bold. */
const words = css({
  display: 'block',
  animation: '[fadein {durations.slow} {easings.out}]',
  '& b': { fontWeight: 'bold' },
});

/** The rest of the note under its bold first sentence, all of it. */
const restStyle = css({ display: 'block' });

/**
 * A note about someone or something, a click to them: it lifts a little under the pointer, and has an arrow on its
 * last line, after its last word, not on a line of its own under the words.
 */
const link = css({
  pointerEvents: 'auto',
  _hover: { filter: '[brightness(1.04)]', transform: '[translateY(-1px)]' },
  '& .words > :last-child::after': { content: "' ›'", fontWeight: 'heavy', opacity: 'faint' },
});

/** The advisor, who steps aside while a build menu or a blueprint is open in the same spot. */
export function Advisor() {
  const hud = useHud();
  const { sim, tools } = useGame();
  if (hud.menu || tools.plan) return <div id="advisor" class={advisor} />;
  const raw = sim.adviceNote();
  const { step } = raw;
  if (step)
    return (
      <div id="advisor" class={advisor}>
        <div class={face}>
          <Icon id="ui-advisor" size={36} />
        </div>
        <TutorialCard step={step} />
      </div>
    );
  const note = hud.advice.show(raw, performance.now() / 1000, (about) => sim.whereIs(about) !== null);
  const { head, rest } = headline(note.text);
  const { about } = note;
  // keyed by the note, so a new one fades in while the box stays where it is; `words` is for a link's arrow to find
  const body = (
    <span key={note.id} class={cx('words', words)}>
      {note.label && <span class="kicker">{note.label}</span>}
      <b>{head}</b>
      {rest && <span class={restStyle}>{rest}</span>}
    </span>
  );
  const look = cx('note', note.level === 'alarm' && 'alarm');
  return (
    <div id="advisor" class={advisor}>
      <div class={face}>
        <Icon id="ui-advisor" size={36} />
      </div>
      {about ? (
        <Button
          class={cx(look, link)}
          title="Show me"
          onPress={() => {
            hud.show(about);
          }}
        >
          {body}
        </Button>
      ) : (
        <p class={look}>{body}</p>
      )}
    </div>
  );
}
