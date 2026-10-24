// The tutorial's lesson for something that has just happened for the first time: a strip of pictures with a line
// each, a closing word, and Show me when it is about someone or points at a menu.

import './LessonDialog.css';

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
  // someone to go to, or a menu to open
  const showsMe = !!raised.about || !!lesson.showMe;
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
            Show me
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
