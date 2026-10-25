// The tutorial's lesson for something that has just happened for the first time: a strip of pictures with a line
// each, a closing word, and Show me when it is about someone or points at a menu, or a button to place the item it
// is about.

import { ITEMS } from '../../../core/data';
import { an } from '../../../core/format';
import { lessonCard } from '../../../core/sim/lessons';
import { css } from '../../../styled-system/css';
import { useGame, useHud } from '../../hooks/use-hud';
import { cx } from '../../lib/cx';
import { Button } from '../common/Button';
import { Icon } from '../common/Icon';
import { Dialog } from './Dialog';

/** The kicker over the title, small and in capitals. */
const kicker = css({
  fontSize: '[12px !important]',
  fontWeight: 'bold',
  letterSpacing: '[0.06em]',
  textTransform: 'uppercase',
  color: 'teal-dark',
  mb: 'xxs',
});

/**
 * The strip of pictures, each on a white card with its label and a line under it. `lesson-strip` is for the end-to-end
 * tests to find it by.
 */
const strip = css({
  listStyle: 'none',
  p: 'none',
  m: '[14px 0]',
  display: 'grid',
  gridTemplateColumns: '[repeat(auto-fit, minmax(120px, 1fr))]',
  gap: '[10px]',
  '& li': {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 'xs',
    p: '[10px 8px]',
    bg: 'white',
    border: '[2px solid rgba(36, 56, 74, 0.25)]',
    borderRadius: 'card',
  },
  '& b': { fontSize: '[14px]' },
  '& small': { fontSize: 'small', lineHeight: '[1.3]' },
});

/** A picture's icon, in a cream circle. */
const picture = css({
  w: '[64px]',
  h: '[64px]',
  display: 'grid',
  placeItems: 'center',
  borderRadius: '[50%]',
  bg: 'cream',
  border: '[2.5px solid {colors.navy}]',
});

/** The lesson raised last. */
export function LessonDialog() {
  const hud = useHud();
  const { sim } = useGame();
  const raised = hud.lesson;
  if (!raised) return null;
  // worked out as it is shown, the game paused under it, so the numbers on it are the bank's as it stands
  const lesson = lessonCard(raised.id, sim.s);
  // an item to put in hand, which is the card's main button
  const place = lesson.showMe?.kind === 'place' ? lesson.showMe.type : null;
  // someone to go to, or a menu to open
  const showsMe = !place && (!!raised.about || !!lesson.showMe);
  return (
    <Dialog wide>
      <p class={kicker}>Tutorial</p>
      <h2>{lesson.title}</h2>
      <p>{lesson.intro}</p>
      <ol class={cx('lesson-strip', strip)}>
        {lesson.panels.map((p) => (
          <li key={p.label}>
            <span class={picture}>
              <Icon id={p.icon} size={44} />
            </span>
            <b>{p.label}</b>
            <small>{p.note}</small>
          </li>
        ))}
      </ol>
      <p>{lesson.body}</p>
      <div class="btnrow">
        {showsMe && (
          <Button
            onPress={() => {
              hud.showLesson(raised);
            }}
          >
            Show me
          </Button>
        )}
        <Button
          class={cx(!place && 'go')}
          onPress={() => {
            hud.close();
          }}
        >
          Got it
        </Button>
        {place && (
          <Button
            class="go"
            onPress={() => {
              hud.showLesson(raised);
            }}
          >
            {`Place ${an(ITEMS[place].name)}`}
          </Button>
        )}
      </div>
    </Dialog>
  );
}
