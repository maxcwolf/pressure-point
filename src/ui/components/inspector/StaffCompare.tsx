// Comparing a member of staff with another, side by side in their inspector.

import './StaffCompare.css';

import type { ComponentChildren } from 'preact';

import {
  GENERAL_COURSES,
  GENERAL_ORDER,
  isGeneral,
  MODALITIES,
  MODALITY_ORDER,
  ROLES,
  traitOf,
  traitSpeed,
} from '../../../core/data';
import { money } from '../../../core/format';
import { rankName } from '../../../core/sim/careers';
import type { CourseId, Staff } from '../../../core/state/types';
import { useGame, useHud } from '../../hooks/use-hud';
import { cx } from '../../lib/cx';
import { Button } from '../common/Button';
import { Icon, IconText } from '../common/Icon';
import { Stars } from '../common/Stars';

/** Someone's first name, short enough for a column. */
const firstName = (st: Staff) => st.name.split(' ')[0] ?? st.name;

/** Which side has the better of two numbers, if either, with higher better unless said otherwise. */
function better(a: number, b: number, higher = true): 'a' | 'b' | null {
  if (Math.round(a) === Math.round(b)) return null;
  return a > b === higher ? 'a' : 'b';
}

/** A line of the comparison: what is compared, each side's value, and the side that comes out ahead, if one does. */
function Line({
  label,
  a,
  b,
  ahead = null,
}: {
  label: ComponentChildren;
  a: ComponentChildren;
  b: ComponentChildren;
  ahead?: 'a' | 'b' | null;
}) {
  return (
    <tr>
      <th scope="row">{label}</th>
      <td class={cx(ahead === 'a' && 'ahead')}>{a}</td>
      <td class={cx(ahead === 'b' && 'ahead')}>{b}</td>
    </tr>
  );
}

/** Whether someone has passed a course, is on it, or neither. */
function Has({ st, course }: { st: Staff; course: CourseId }) {
  const has =
    (st.quals as readonly CourseId[]).includes(course) || (st.general as readonly CourseId[]).includes(course);
  if (has) return <span class="has">✔</span>;
  if (st.training?.course === course) return <span class="studying">Learning</span>;
  return <span class="lacks">—</span>;
}

/** The two side by side: rank, quirks, mood, pay, work done, and every treatment and course either one has. */
function Table({ a, b }: { a: Staff; b: Staff }) {
  const { sim } = useGame();
  /** Whether either of them has passed a course, or is on it. */
  const either = (c: CourseId) =>
    [a, b].some(
      (st) =>
        (st.quals as readonly CourseId[]).includes(c) ||
        (st.general as readonly CourseId[]).includes(c) ||
        st.training?.course === c,
    );
  const courses = [...MODALITY_ORDER.filter(either), ...GENERAL_ORDER.filter(either)];
  /** Someone's quirks, by name. */
  const quirks = (st: Staff) => (st.traits.length ? st.traits.map((t) => traitOf(t).name).join(', ') : '—');
  return (
    <table class="compare-table">
      <thead>
        <tr>
          <td />
          <th scope="col" title={a.name}>
            {firstName(a)}
          </th>
          <th scope="col" title={b.name}>
            {firstName(b)}
          </th>
        </tr>
      </thead>
      <tbody>
        {a.role !== b.role && (
          <Line
            label="Role"
            a={
              <span title={ROLES[a.role].name}>
                <Icon id={ROLES[a.role].icon} size={18} label={ROLES[a.role].name} />
              </span>
            }
            b={
              <span title={ROLES[b.role].name}>
                <Icon id={ROLES[b.role].icon} size={18} label={ROLES[b.role].name} />
              </span>
            }
          />
        )}
        <Line
          label="Rank"
          a={
            <span title={rankName(a.skill)}>
              <Stars count={a.skill} />
            </span>
          }
          b={
            <span title={rankName(b.skill)}>
              <Stars count={b.skill} />
            </span>
          }
          ahead={better(a.skill, b.skill)}
        />
        <Line
          label="Work speed"
          a={`${Math.round(traitSpeed(a.traits) * 100)}%`}
          b={`${Math.round(traitSpeed(b.traits) * 100)}%`}
          ahead={better(traitSpeed(a.traits) * 100, traitSpeed(b.traits) * 100)}
        />
        <Line label="Quirks" a={quirks(a)} b={quirks(b)} />
        <Line
          label="Energy"
          a={`${Math.round(a.energy)}%`}
          b={`${Math.round(b.energy)}%`}
          ahead={better(a.energy, b.energy)}
        />
        <Line
          label="Morale"
          a={`${Math.round(a.morale)}%`}
          b={`${Math.round(b.morale)}%`}
          ahead={better(a.morale, b.morale)}
        />
        <Line label="Salary" a={money(a.salary)} b={money(b.salary)} />
        <Line label="Going rate" a={money(sim.fairPay(a))} b={money(sim.fairPay(b))} />
        <Line label="Guests served" a={a.served} b={b.served} ahead={better(a.served, b.served)} />
        <Line label="This year" a={a.yearServed} b={b.yearServed} ahead={better(a.yearServed, b.yearServed)} />
        {courses.length > 0 && (
          <tr class="section">
            <th scope="rowgroup" colSpan={3}>
              Treatments and courses
            </th>
          </tr>
        )}
        {courses.map((c) => {
          const def = isGeneral(c) ? GENERAL_COURSES[c] : MODALITIES[c];
          return (
            <Line
              key={c}
              label={<IconText id={def.icon}>{def.name}</IconText>}
              a={<Has st={a} course={c} />}
              b={<Has st={b} course={c} />}
            />
          );
        })}
      </tbody>
    </table>
  );
}

/**
 * A button to compare a member of staff with another. Pressed, it lists the others to choose from, those in the same
 * role first; once one is chosen, the two show side by side.
 */
export function StaffCompare({ staff: st }: { staff: Staff }) {
  const hud = useHud();
  const { sim, tools } = useGame();
  const others = sim.s.staff.filter((o) => o.id !== st.id && o.state !== 'leaving');
  if (!others.length) return null;
  const open = hud.compare?.staffId === st.id ? hud.compare : null;
  const other = open && open.withId !== null ? sim.staff(open.withId) : undefined;
  const toggle = (
    <Button
      class={cx('duty', 'compare', open && 'on')}
      title={open ? 'Stop comparing' : 'Compare them with another member of staff'}
      onPress={() => {
        hud.compare = open ? null : { staffId: st.id, withId: null };
      }}
    >
      {open ? '✔ Done comparing' : <IconText id="ui-staff">Compare</IconText>}
    </Button>
  );
  if (!open) return toggle;
  if (!other) {
    const sameRole = others.filter((o) => o.role === st.role);
    const rest = others.filter((o) => o.role !== st.role);
    return (
      <>
        {toggle}
        <div class="compare-pick">
          <h4>Compare with</h4>
          {[...sameRole, ...rest].map((o) => (
            <Button
              key={o.id}
              class="pick"
              onPress={() => {
                hud.compare = { staffId: st.id, withId: o.id };
              }}
            >
              <Icon id={ROLES[o.role].icon} size={20} />
              <span>{o.name}</span>
              <Stars count={o.skill} />
            </Button>
          ))}
        </div>
      </>
    );
  }
  return (
    <>
      {toggle}
      <div class="compare-pick">
        <Table a={st} b={other} />
        <div class="duties">
          <Button
            class="duty"
            title="Compare them with someone else"
            onPress={() => {
              hud.compare = { staffId: st.id, withId: null };
            }}
          >
            Someone else
          </Button>
          <Button
            class="duty"
            title={`Show ${other.name}, still compared with ${st.name}`}
            onPress={() => {
              hud.compare = { staffId: other.id, withId: st.id };
              // selected even when they are away on a house call, with nowhere for the camera to go
              tools.select({ kind: 'staff', id: other.id });
              hud.show({ kind: 'staff', id: other.id });
            }}
          >
            {`Go to ${firstName(other)}`}
          </Button>
        </div>
      </div>
    </>
  );
}
