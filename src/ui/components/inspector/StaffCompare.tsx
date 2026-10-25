// Comparing a member of staff with another, side by side in their inspector.

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
import { css } from '../../../styled-system/css';
import { useGame, useHud } from '../../hooks/use-hud';
import { cx } from '../../lib/cx';
import { Button } from '../common/Button';
import { Icon, IconText } from '../common/Icon';
import { Stars } from '../common/Stars';
import { duty, dutyRow } from './looks';

/** The switch to start comparing, under their role, as small as the duty switches. */
const toggleStyle = css({ display: 'block', m: '[3px 0 2px]' });

/**
 * The white card the others to choose from, or the comparison, are drawn on, its heading close to the top (under
 * `.insp`, to outdo the inspector's spacing of headings).
 */
const pickCard = css({
  bg: 'white',
  border: '[2px solid rgba(36, 56, 74, 0.35)]',
  borderRadius: '[11px]',
  p: '[4px 8px 8px]',
  m: '[6px 0 4px]',
  '.insp &': { '& h4': { mt: 'xs' } },
});

/** Someone to compare them with: their role's icon, their name and their rank, framed in teal under the pointer. */
const pick = css({
  w: '[100%]',
  display: 'grid',
  gridTemplateColumns: '[22px 1fr auto]',
  alignItems: 'center',
  gap: 's',
  textAlign: 'left',
  fontSize: 'small',
  bg: '[none]',
  border: '[1.5px solid transparent]',
  borderRadius: '[8px]',
  p: '[2px 4px]',
  _hover: { borderColor: 'teal-dark', bg: '[#f0fbf9]' },
});

/**
 * The comparison, in set columns, so a long word or a full row of stars can never push the table out of its card. The
 * heading of the treatments and courses (its row marked `section`) stands out from the plainer names of the rows.
 */
const table = css({
  w: '[100%]',
  tableLayout: 'fixed',
  borderCollapse: 'collapse',
  fontSize: '[12px]',
  mb: 's',
  '& th, & td': { p: '[2px 3px]', textAlign: 'left', verticalAlign: 'middle' },
  '& thead th': {
    fontWeight: 'bold',
    fontSize: 'small',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  // a treatment's name too long for the column is broken at a soft hyphen if it has one, or hyphenated, or broken
  // anywhere
  '& tbody th': { fontWeight: '[500]', opacity: '[0.75]', hyphens: 'auto', overflowWrap: 'anywhere' },
  // five stars, small enough to fit their column
  '& .skill': { fontSize: '[10.5px]', letterSpacing: '[0]', whiteSpace: 'nowrap' },
  '& tbody tr + tr': { borderTop: '[1px solid rgba(36, 56, 74, 0.12)]' },
  '& tr.section th': { opacity: '[1]', fontWeight: 'bold', pt: '[7px]' },
});

/** The column of what is compared, a little under half the table. */
const labelColumn = css({ w: '[46%]' });

/** The side that comes out ahead, or someone who has passed a course, in green. */
const aheadStyle = css({ color: '[#23824a]', fontWeight: '[700]' });

/** Someone who has not passed a course, faded. */
const lacks = css({ opacity: '[0.4]' });

/** Someone who is on the course now, in small slanted words. */
const studying = css({ fontSize: '[11px]', fontStyle: 'italic', opacity: '[0.8]' });

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
  // `ahead` is for the end-to-end tests to find the side ahead by
  const won = cx('ahead', aheadStyle);
  return (
    <tr>
      <th scope="row">{label}</th>
      <td class={cx(ahead === 'a' && won)}>{a}</td>
      <td class={cx(ahead === 'b' && won)}>{b}</td>
    </tr>
  );
}

/** Whether someone has passed a course, is on it, or neither. */
function Has({ st, course }: { st: Staff; course: CourseId }) {
  const has =
    (st.quals as readonly CourseId[]).includes(course) || (st.general as readonly CourseId[]).includes(course);
  if (has) return <span class={aheadStyle}>✔</span>;
  if (st.training?.course === course) return <span class={studying}>Learning</span>;
  return <span class={lacks}>—</span>;
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
    // `compare-table` is for the end-to-end tests to find it by
    <table class={cx('compare-table', table)}>
      <colgroup>
        <col class={labelColumn} />
        <col />
        <col />
      </colgroup>
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
 * A button to compare a member of staff with another. Pressed, it lists the others in the same role to choose from, or
 * everyone when asked or when no one else has that role; once one is chosen, the two show side by side.
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
      class={cx(duty, toggleStyle, open && 'on')}
      title={open ? 'Stop comparing' : 'Compare them with another member of staff'}
      onPress={() => {
        hud.compare = open ? null : { staffId: st.id, withId: null, everyone: false };
      }}
    >
      {open ? '✔ Done comparing' : <IconText id="ui-staff">Compare</IconText>}
    </Button>
  );
  if (!open) return toggle;
  if (!other) {
    const sameRole = others.filter((o) => o.role === st.role);
    const rest = others.filter((o) => o.role !== st.role);
    // with no one else in their role, there is no one but everyone to choose from
    const everyone = open.everyone || !sameRole.length;
    return (
      <>
        {toggle}
        {/* `compare-pick` and `pick` are for the tests to find them by */}
        <div class={cx('compare-pick', pickCard)}>
          <h4>Compare with</h4>
          {(everyone ? [...sameRole, ...rest] : sameRole).map((o) => (
            <Button
              key={o.id}
              class={cx('pick', pick)}
              onPress={() => {
                hud.compare = { ...open, withId: o.id };
              }}
            >
              <Icon id={ROLES[o.role].icon} size={20} />
              <span>{o.name}</span>
              <Stars count={o.skill} />
            </Button>
          ))}
          {sameRole.length > 0 && rest.length > 0 && (
            <div class={dutyRow}>
              <Button
                class={duty}
                title={everyone ? `Only other ${ROLES[st.role].name.toLowerCase()}s` : 'Staff in every role'}
                onPress={() => {
                  hud.compare = { ...open, everyone: !everyone };
                }}
              >
                {everyone ? `Only ${ROLES[st.role].name.toLowerCase()}s` : 'Everyone'}
              </Button>
            </div>
          )}
        </div>
      </>
    );
  }
  return (
    <>
      {toggle}
      <div class={cx('compare-pick', pickCard)}>
        <Table a={st} b={other} />
        <div class={dutyRow}>
          <Button
            class={duty}
            title="Compare them with someone else"
            onPress={() => {
              hud.compare = { ...open, withId: null };
            }}
          >
            Someone else
          </Button>
          <Button
            class={duty}
            title={`Show ${other.name}, still compared with ${st.name}`}
            onPress={() => {
              hud.compare = { staffId: other.id, withId: st.id, everyone: open.everyone };
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
