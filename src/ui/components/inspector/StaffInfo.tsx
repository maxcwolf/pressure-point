// The inspector for a member of staff.

import { ROLES, traitOf } from '../../../core/data';
import { money } from '../../../core/format';
import type { Staff } from '../../../core/state/types';
import { useGame } from '../../hooks/use-hud';
import { cx } from '../../lib/cx';
import { moraleLook, quitWarning, staffStatus } from '../../lib/status';
import { Bar } from '../common/Bar';
import { Button } from '../common/Button';
import { QualChips } from '../common/QualChips';
import { Stars } from '../common/Stars';
import { Courses } from './Courses';

/** A member of staff's skills, mood and pay, with raises, training and letting them go. */
export function StaffInfo({ staff: st }: { staff: Staff }) {
  const { sim, tools } = useGame();
  const leaving = st.state === 'leaving';
  return (
    <>
      <h3>{st.name}</h3>
      <p class="tag">{`${ROLES[st.role].icon} ${ROLES[st.role].name}`}</p>{' '}
      <p>
        {'Skill '}
        <Stars count={st.skill} />
      </p>
      <QualChips quals={st.quals} />
      {st.traits.map((t) => (
        <em key={t}>{`${traitOf(t).name}: ${traitOf(t).desc}`}</em>
      ))}{' '}
      <p class="status">{staffStatus(st, sim)}</p>{' '}
      {sim.daysUntilQuit(st) !== null && (
        <p class={cx('status', 'quitting', sim.aboutToQuit(st) && 'alarm')}>{quitWarning(sim.daysUntilQuit(st))}</p>
      )}{' '}
      {st.training && (
        <label>
          Course progress
          <Bar value={st.training.progress * 100} class="blue" />
        </label>
      )}{' '}
      <label>
        Energy
        <Bar value={st.energy} class={st.energy < 20 ? 'bad' : 'energy'} />
      </label>{' '}
      <label>
        Morale
        <Bar value={st.morale} class={moraleLook(st.morale)} />
      </label>{' '}
      <p class="sub">
        {`Salary ${money(st.salary)}/month (going rate ${money(sim.fairPay(st))}) · Guests served: ${st.served}`}
      </p>{' '}
      {!leaving && (
        <Button
          class={cx(st.raiseAsked && 'go', 'raise')}
          quiet
          onPress={() => {
            sim.giveRaise(st.id);
          }}
        >
          {`${st.raiseAsked ? '💰 Wants a raise: pay' : 'Raise to'} ${money(sim.raiseTo(st))}`}
        </Button>
      )}{' '}
      <Courses staff={st} />{' '}
      {!leaving && (
        <Button
          class="danger"
          onPress={() => {
            sim.fire(st.id);
            tools.select(null);
          }}
        >
          Let go
        </Button>
      )}
    </>
  );
}
