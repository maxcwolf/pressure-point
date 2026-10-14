// The inspector for a member of staff.

import { DUTIES, DUTY_NAMES, ROLES, traitOf } from '../../../core/data';
import { money } from '../../../core/format';
import { rankName, rankProgress, slots, trained, xpToNext } from '../../../core/sim/careers';
import type { Staff } from '../../../core/state/types';
import { useGame } from '../../hooks/use-hud';
import { cx } from '../../lib/cx';
import { moraleLook, quitWarning, staffStatus } from '../../lib/status';
import { Bar } from '../common/Bar';
import { Button } from '../common/Button';
import { QualChips } from '../common/QualChips';
import { Stars } from '../common/Stars';
import { Courses } from './Courses';

/** Their rank, how far they are toward the next, and the qualification slots they have filled. */
function Career({ staff: st }: { staff: Staff }) {
  const { sim } = useGame();
  const left = xpToNext(st);
  return (
    <>
      <p class="rank">
        <b>{rankName(st.skill)}</b> <Stars count={st.skill} />
      </p>
      <label>
        {left === null
          ? 'Experience: the top rank'
          : left > 0
            ? `Experience: ${Math.ceil(left)} more to ${rankName(st.skill + 1)}`
            : `Experience: enough for ${rankName(st.skill + 1)}`}
        <Bar value={rankProgress(st) * 100} class="blue" />
      </label>
      <p class="sub">{`Qualification slots: ${trained(st)} of ${slots(st)} filled. Each promotion brings another.`}</p>
      <QualChips quals={st.quals} general={st.general} />
      {st.promotion && st.state !== 'leaving' && (
        <Button
          class="raise go"
          onPress={() => {
            sim.promote(st.id);
          }}
        >
          {`⬆️ Promote to ${rankName(st.skill + 1)}`}
        </Button>
      )}
    </>
  );
}

/** Switches for the duties a member of staff can be kept to, for the roles that have a choice. */
function Duties({ staff: st }: { staff: Staff }) {
  const { sim } = useGame();
  const duties = DUTIES[st.role];
  if (!duties || st.state === 'leaving') return null;
  return (
    <>
      <h4>Duties</h4>
      <div class="duties">
        {duties.map((d) => {
          const on = !st.off.includes(d);
          // there has to be something left for them to do
          const last = on && st.off.length === duties.length - 1;
          return (
            <Button
              key={d}
              class={cx('duty', on && 'on')}
              locked={last}
              title={
                last ? 'Their only duty left' : on ? 'Click to keep them from this' : 'Click to put them back on this'
              }
              onPress={() => {
                sim.setDuty(st.id, d, !on);
              }}
            >
              {`${on ? '✔' : '✗'} ${DUTY_NAMES[d]}`}
            </Button>
          );
        })}
      </div>
    </>
  );
}

/** A member of staff's skills, mood and pay, with raises, training and letting them go. */
export function StaffInfo({ staff: st }: { staff: Staff }) {
  const { sim, tools } = useGame();
  const leaving = st.state === 'leaving';
  return (
    <>
      <h3>{st.name}</h3>
      <p class="tag">{`${ROLES[st.role].icon} ${ROLES[st.role].name}`}</p> <Career staff={st} />
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
      <Duties staff={st} />
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
