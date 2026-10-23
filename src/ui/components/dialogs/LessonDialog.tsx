// The tutorial's lesson for something that has just happened for the first time: a strip of pictures with a line
// each, a closing word, and Show me when it is about someone.

import './LessonDialog.css';

import { LESSONS } from '../../../core/sim/lessons';
import { useHud } from '../../hooks/use-hud';
import { Button } from '../common/Button';
import { Icon } from '../common/Icon';
import { Dialog } from './Dialog';

/** The lesson raised last. */
export function LessonDialog() {
  const hud = useHud();
  const raised = hud.lesson;
  if (!raised) return null;
  const lesson = LESSONS[raised.id];
  const about = raised.about;
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
        {about && (
          <Button
            onPress={() => {
              hud.close();
              hud.show(about);
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
