// The inspector for a member of staff.

import { DUTIES, DUTY_NAMES, ROLES, traitOf } from '../../../core/data';
import { money } from '../../../core/format';
import { assignableRole, roomLabels } from '../../../core/sim/assignments';
import { rankName, rankProgress, slots, trained, xpToNext } from '../../../core/sim/careers';
import { burntOut } from '../../../core/sim/souls';
import type { Staff } from '../../../core/state/types';
import { useGame, useHud } from '../../hooks/use-hud';
import { cx } from '../../lib/cx';
import { soulNote } from '../../lib/souls';
import { offerWarning } from '../../lib/standing';
import { moraleLook, promotionNote, quitWarning, staffStatus } from '../../lib/status';
import { Bar } from '../common/Bar';
import { Button } from '../common/Button';
import { QualChips } from '../common/QualChips';
import { Stars } from '../common/Stars';
import { Courses } from './Courses';

/** Their rank, how far they are toward the next, and the qualification slots they have filled. */
function Career({ staff: st }: { staff: Staff }) {
  const { sim } = useGame();
  const left = xpToNext(st);
  const note = promotionNote(st, sim.fullyTrained(st));
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
      {note ? (
        <p class="status needs">{note}</p>
      ) : (
        <p class="sub">{`Qualification slots: ${trained(st)} of ${slots(st)} filled. Each promotion brings another.`}</p>
      )}
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

/** The rooms a member of staff works in, with buttons to assign them to rooms or let them work anywhere. */
function WorksIn({ staff: st }: { staff: Staff }) {
  const { sim, tools } = useGame();
  if (!assignableRole(st.role) || st.state === 'leaving') return null;
  const labels = roomLabels(sim.s.rooms);
  const assigning = tools.tool.kind === 'assign' && tools.tool.staffId === st.id;
  return (
    <>
      <h4>Works in</h4>
      <p class="sub works-in">
        {st.rooms.length ? st.rooms.map((id) => labels.get(id) ?? 'a room').join(', ') : 'Anywhere'}
      </p>
      <div class="duties">
        <Button
          class={cx('duty', 'assign', assigning && 'on')}
          title="Click rooms to have them work only there, and click a room again to take it away"
          onPress={() => {
            if (assigning) tools.cancel();
            else tools.startAssign(st.id);
          }}
        >
          {assigning ? '✔ Done' : '📌 Assign to rooms'}
        </Button>
        {st.rooms.length > 0 && (
          <Button
            class="duty"
            title="Let them work anywhere again"
            onPress={() => {
              sim.clearRooms(st.id);
            }}
          >
            Anywhere
          </Button>
        )}
      </div>
    </>
  );
}

/** A button to send a Shaman to someone burnt out to retrieve their soul, or how that is going. */
function Soul({ staff: st }: { staff: Staff }) {
  const { sim } = useGame();
  if (st.state === 'leaving') return null;
  const shaman = sim.s.staff.some((sh) => sh.role === 'shaman' && sh.id !== st.id && sh.state !== 'leaving');
  // the hint is only for a center where a Shaman can be hired
  const note = soulNote(!!st.soulAsked, burntOut(st.morale) && sim.enabled('shaman'), shaman);
  if (sim.canRetrieve(st))
    return (
      <Button
        class="raise"
        quiet
        title="A Shaman comes over and brings their soul back, lifting their morale a long way. It tires the Shaman."
        onPress={() => {
          sim.askSoul(st.id);
        }}
      >
        🪶 Soul retrieval
      </Button>
    );
  return note ? <p class="sub">{note}</p> : null;
}

/** A member of staff's skills, mood and pay, with raises, training and letting them go. */
export function StaffInfo({ staff: st }: { staff: Staff }) {
  const hud = useHud();
  const { sim } = useGame();
  const leaving = st.state === 'leaving';
  return (
    <>
      <h3>{st.name}</h3>
      <p class="tag">{`${ROLES[st.role].icon} ${ROLES[st.role].name}`}</p> <Career staff={st} />
      {st.traits.map((t) => (
        <em key={t}>{`${traitOf(t).name}: ${traitOf(t).desc}`}</em>
      ))}{' '}
      <p class="status">{staffStatus(st, sim)}</p>{' '}
      {st.offer > 0 && st.state !== 'leaving' && (
        <p class="status quitting rival-offer">{offerWarning(st.offer - sim.s.day)}</p>
      )}{' '}
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
      <Soul staff={st} />
      <label title="Seen to between jobs at a Water Cooler or Tea Station, or by an Espresso Machine on a break.">
        Thirst
        <Bar value={st.thirst} class={st.thirst >= 100 ? 'bad' : 'need'} />
      </label>{' '}
      <label title="Seen to between jobs at a Snack Machine.">
        Hunger
        <Bar value={st.hunger} class={st.hunger >= 100 ? 'bad' : 'need'} />
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
      <WorksIn staff={st} />
      <Courses staff={st} />{' '}
      {!leaving && (
        <Button
          class="danger"
          onPress={() => {
            hud.askToFire(st.id);
          }}
        >
          Let go
        </Button>
      )}
    </>
  );
}
