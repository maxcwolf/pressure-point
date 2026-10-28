// The inspector for a member of staff.

import { DUTIES, DUTY_NAMES, ROLES } from '../../../core/data';
import { money } from '../../../core/format';
import { assignableRole, roomLabels } from '../../../core/sim/assignments';
import { rankName, rankProgress, xpToNext } from '../../../core/sim/careers';
import { burntOut } from '../../../core/sim/souls';
import type { Staff } from '../../../core/state/types';
import { css } from '../../../styled-system/css';
import { dangerButton, goButton } from '../../../styled-system/recipes';
import { useGame, useHud } from '../../hooks/use-hud';
import { cx } from '../../lib/cx';
import { meterPercent, meterTone } from '../../lib/meters';
import { quirkNotes } from '../../lib/quirks';
import { soulNote } from '../../lib/souls';
import { offerWarning } from '../../lib/standing';
import { promotionNote, quitWarning, slotNote, staffStatus, statusClass } from '../../lib/status';
import { Bar } from '../common/Bar';
import { Button } from '../common/Button';
import { IconText, Line } from '../common/Icon';
import { QualChips } from '../common/QualChips';
import { QuirkChips } from '../common/QuirkChips';
import { Stars } from '../common/Stars';
import { Courses } from './Courses';
import { duty, dutyRow, smallButton } from './looks';
import { StaffCompare } from './StaffCompare';

/** Their rank by name, with its stars beside it. */
const rank = css({ display: 'flex', alignItems: 'center', gap: '6' });

/** Their rank, how far they are toward the next, and the qualification slots they have filled. */
function Career({ staff: st }: { staff: Staff }) {
  const { sim } = useGame();
  const left = xpToNext(st);
  const note = promotionNote(st, sim.fullyTrained(st));
  return (
    <>
      {/* `rank` is for the end-to-end tests to find it by, and `raise` below too */}
      <p class={cx('rank', rank)}>
        <b>{rankName(st.skill)}</b> <Stars count={st.skill} />
      </p>
      <label>
        {left === null
          ? 'Experience: the top rank'
          : left > 0
            ? `Experience: ${Math.ceil(left)} more to ${rankName(st.skill + 1)}`
            : `Experience: enough for ${rankName(st.skill + 1)}`}
        <Bar value={rankProgress(st) * 100} tone="blue" show={meterPercent(rankProgress(st) * 100)} />
      </label>
      {note ? <p class={statusClass('promotion', 'needs')}>{note}</p> : <p class="sub">{slotNote(st)}</p>}
      <QualChips quals={st.quals} general={st.general} />
      {st.promotion && st.state !== 'leaving' && (
        <Button
          class={cx(smallButton, 'raise', goButton())}
          onPress={() => {
            sim.promote(st.id);
          }}
        >
          <IconText id="ui-upgrade">{`Promote to ${rankName(st.skill + 1)}`}</IconText>
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
      <div class={dutyRow}>
        {duties.map((d) => {
          const on = !st.off.includes(d);
          // there has to be something left for them to do
          const last = on && st.off.length === duties.length - 1;
          return (
            <Button
              key={d}
              class={cx(duty, on && 'on')}
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
      <div class={dutyRow}>
        <Button
          class={cx(duty, 'assign', assigning && 'on')}
          title="Click rooms to have them work only there, and click a room again to take it away"
          onPress={() => {
            if (assigning) tools.cancel();
            else tools.startAssign(st.id);
          }}
        >
          {assigning ? '✔ Done' : <IconText id="ui-pin">Assign to rooms</IconText>}
        </Button>
        {st.rooms.length > 0 && (
          <Button
            class={duty}
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
        class={cx(smallButton, 'raise')}
        quiet
        title="A Shaman comes over and brings their soul back, lifting their morale a long way. It tires the Shaman."
        onPress={() => {
          sim.askSoul(st.id);
        }}
      >
        <IconText id="discipline-shaman">Soul retrieval</IconText>
      </Button>
    );
  return note ? (
    <p class="sub">
      <IconText id={st.soulAsked ? 'discipline-shaman' : undefined}>{note}</IconText>
    </p>
  ) : null;
}

/** What their rare quirk has done, under their quirks: treatments saved, heals posted, space held. */
function QuirkNotes({ staff: st }: { staff: Staff }) {
  const { sim } = useGame();
  const notes = quirkNotes(st, sim.holdingSpaceFor(st), sim.spaceHolder(st));
  return (
    <>
      {/* `quirk-note` is for the tests to find them by */}
      {notes.map((n) => (
        <p key={n} class="sub quirk-note">
          {n}
        </p>
      ))}
    </>
  );
}

/** A member of staff's skills, mood and pay, with raises, training and letting them go. */
export function StaffInfo({ staff: st }: { staff: Staff }) {
  const hud = useHud();
  const { sim } = useGame();
  const leaving = st.state === 'leaving';
  return (
    <>
      <h3>{st.name}</h3>
      <p class="tag">
        <IconText id={ROLES[st.role].icon}>{ROLES[st.role].name}</IconText>
      </p>{' '}
      {/* what they are doing, then anything wrong, before the rest */}
      <p class={statusClass('doing')}>{staffStatus(st, sim)}</p>{' '}
      {sim.daysUntilQuit(st) !== null && (
        <p class={statusClass(sim.aboutToQuit(st) ? 'quitting' : 'miserable', 'quitting')}>
          <Line line={quitWarning(sim.daysUntilQuit(st)) ?? { text: '' }} />
        </p>
      )}{' '}
      {st.offer > 0 && st.state !== 'leaving' && (
        <p class={statusClass('offer', 'rival-offer')}>
          <IconText id="ui-rival">{offerWarning(st.offer - sim.s.day)}</IconText>
        </p>
      )}{' '}
      <StaffCompare staff={st} />
      <Career staff={st} />
      <QuirkChips traits={st.traits} spell />
      <QuirkNotes staff={st} />{' '}
      {st.training && (
        <label>
          Course progress
          <Bar value={st.training.progress * 100} tone="blue" show={meterPercent(st.training.progress * 100)} />
        </label>
      )}{' '}
      <label>
        Energy
        <Bar value={st.energy} tone={meterTone('energy', st.energy)} show />
      </label>{' '}
      <label>
        Morale
        <Bar value={st.morale} tone={meterTone('morale', st.morale)} show />
      </label>{' '}
      <Soul staff={st} />
      <label title="Seen to between jobs at a Water Cooler or Tea Station, or by an Espresso Machine on a break.">
        Thirst
        <Bar value={st.thirst} tone={meterTone('need', st.thirst)} show />
      </label>{' '}
      <label title="Seen to between jobs at a Snack Machine.">
        Hunger
        <Bar value={st.hunger} tone={meterTone('need', st.hunger)} show />
      </label>{' '}
      <p class="sub">
        {`Salary ${money(st.salary)}/month (going rate ${money(sim.fairPay(st))}) · Guests served: ${st.served}`}
      </p>{' '}
      {!leaving && (
        <Button
          class={cx(smallButton, st.raiseAsked && goButton(), 'raise')}
          quiet
          onPress={() => {
            sim.giveRaise(st.id);
          }}
        >
          <IconText id={st.raiseAsked ? 'bubble-raise' : undefined}>
            {`${st.raiseAsked ? 'Wants a raise: pay' : 'Raise to'} ${money(sim.raiseTo(st))}`}
          </IconText>
        </Button>
      )}{' '}
      <Duties staff={st} />
      <WorksIn staff={st} />
      <Courses staff={st} />{' '}
      {!leaving && (
        <Button
          class={dangerButton()}
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
