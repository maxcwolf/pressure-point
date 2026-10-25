// The training courses a member of staff can take.

import { money } from '../../../core/format';
import type { Staff } from '../../../core/state/types';
import { css } from '../../../styled-system/css';
import { useGame, useHud } from '../../hooks/use-hud';
import { cx } from '../../lib/cx';
import { Button } from '../common/Button';
import { Icon } from '../common/Icon';
import { smallButton } from './looks';

/**
 * A course's button, as wide as the panel: its icon, its name with how many days it takes underneath, and its fee on a
 * gold tag. One that cannot start is faded.
 */
const course = css({
  w: '[100%]',
  display: 'grid',
  gridTemplateColumns: '[24px 1fr auto]',
  alignItems: 'center',
  gap: '6',
  textAlign: 'left',
  bg: 'white',
  border: 'control',
  borderRadius: '10',
  py: '4',
  px: '8',
  mb: '4',
  fontSize: '13',
  fontWeight: '[500]',
  _hover: { bg: 'teal-tint' },
  '& small': { display: 'block', fontWeight: '[400]', fontSize: '11', opacity: '[0.7]' },
  '& b': {
    bg: 'gold',
    border: '[1.5px solid {colors.navy}]',
    borderRadius: '8',
    py: '0',
    px: '6',
    fontSize: '12',
  },
  _locked: { opacity: '[0.5]', cursor: 'not-allowed' },
});

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
          class={smallButton}
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
            // `course` is for the end-to-end tests to find it by
            class={cx('course', course)}
            locked={!!why}
            quiet
            title={why || c.desc}
            onPress={() => {
              sim.train(st.id, c.id);
            }}
          >
            <Icon id={c.icon} size={20} />
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
