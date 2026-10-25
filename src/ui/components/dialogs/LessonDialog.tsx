// The tutorial's lesson for something that has just happened for the first time: a strip of pictures with a line
// each, a closing word, and Show me when it is about someone or points at a menu, or an item to place.

import './LessonDialog.css';

import { ITEMS } from '../../../core/data';
import { an } from '../../../core/format';
import { lessonCard } from '../../../core/sim/lessons';
import { useGame, useHud } from '../../hooks/use-hud';
import { Button } from '../common/Button';
import { Icon } from '../common/Icon';
import { Dialog } from './Dialog';

/** The lesson raised last. */
export function LessonDialog() {
  const hud = useHud();
  const { sim } = useGame();
  const raised = hud.lesson;
  if (!raised) return null;
  // worked out as it is shown, the game paused under it, so the numbers on it are the bank's as it stands
  const lesson = lessonCard(raised.id, sim.s);
  // someone to go to, a menu to open, or an item to place, which the button names
  const showsMe = !!raised.about || !!lesson.showMe;
  const place = !raised.about && lesson.showMe && 'place' in lesson.showMe ? lesson.showMe.place : undefined;
  return (
    <Dialog wide>
      <p class="lesson-kicker">Tutorial</p>
      <h2>{lesson.title}</h2>
      <p>{lesson.intro}</p>
      <ol class="lesson-strip">
        {lesson.panels.map((p) => (
          <li key={p.label}>
            <span class="picture">
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
            {place ? `Place ${an(ITEMS[place].name)}` : 'Show me'}
          </Button>
        )}
        <Button
          class="go"
          onPress={() => {
            hud.close();
          }}
        >
          Got it
        </Button>
      </div>
    </Dialog>
  );
}
