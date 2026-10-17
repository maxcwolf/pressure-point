// The training courses a member of staff can take.

import './Courses.css';

import { money } from '../../../core/format';
import type { Staff } from '../../../core/state/types';
import { useGame, useHud } from '../../hooks/use-hud';
import { Button } from '../common/Button';

/**
 * A button per course, locked when it cannot start, with the reason underneath; while they are on one, a button to
 * cancel it.
 */
export function Courses({ staff: st }: { staff: Staff }) {
  const hud = useHud();
  const { sim } = useGame();
  if (st.training && !sim.cancelBlocker(st))
    return (
      <>
        <h4>Training</h4>
        <Button
          class="cancel-course"
          title={`Call them back to work, with the ${money(st.training.cost)} fee refunded`}
          onPress={() => {
            hud.askToCancelCourse(st.id);
          }}
        >
          Cancel course
        </Button>
      </>
    );
  if (st.state === 'leaving' || st.training) return null;
  const courses = sim.courses(st);
  const first = courses[0];
  if (!first) return null;
  const blocker = sim.trainBlocker(st, first);
  return (
    <>
      <h4>Training</h4>
      {courses.map((c) => {
        const why = sim.trainBlocker(st, c);
        return (
          <Button
            key={c.id}
            class="course"
            locked={!!why}
            quiet
            title={why || c.desc}
            onPress={() => {
              sim.train(st.id, c.id);
            }}
          >
            <i>{c.icon}</i>
            <span>
              {c.name}
              <small>{`${c.days} days`}</small>
            </span>
            <b>{money(c.cost)}</b>
          </Button>
        );
      })}
      {blocker && blocker !== 'Not enough money.' && <p class="sub">{blocker}</p>}
    </>
  );
}
