// A Qi Gong Studio's timetable in its inspector: a button for each day of the week, and how the next class is filling.

import { ROLES, WEEKDAYS } from '../../../core/data';
import { an } from '../../../core/format';
import { classDays } from '../../../core/sim/classes';
import type { Room } from '../../../core/state/types';
import { css } from '../../../styled-system/css';
import { useGame } from '../../hooks/use-hud';
import { bookingNote, classNote, demandNote, placesNote, weekNote } from '../../lib/classes';
import { cx } from '../../lib/cx';
import { meterPercent } from '../../lib/meters';
import { statusClass } from '../../lib/status';
import { Bar } from '../common/Bar';
import { Button } from '../common/Button';
import { IconText, Line } from '../common/Icon';

/** The timetable, a little apart from the rest. */
const timetable = css({ m: '0', mt: '8', mb: '4' });

/** The days of the week, side by side. */
const dayRow = css({ display: 'flex', gap: '4', my: '4', mx: '0' });

/** A day's button, sharing the row with the rest, gold on the days a class is held. */
const day = css({
  flex: '1',
  border: 'outline.thin',
  borderRadius: '8',
  py: '4',
  px: '0',
  fontWeight: 'bold',
  fontSize: '12',
  bg: 'control',
  boxShadow: 'pressed',
  _on: { bg: 'toggle.on' },
});

/**
 * Who leads a studio's classes, how its spots stand, the days it holds classes, how many class-goers a week come for
 * them and how its next class is filling.
 */
export function Timetable({ room }: { room: Room }) {
  const { sim } = useGame();
  const days = classDays(room);
  const inRoom = sim.s.items.filter((i) => sim.world.roomOfItem(i) === room);
  const lead = inRoom.find((i) => i.type === 'instructor_mat');
  const spots = inRoom.filter((i) => i.type === 'practice_spot');
  const standing = spots.filter((i) => sim.guest(i.serving)?.state === 'served').length;
  const staff = lead && sim.stationStaff(lead);
  const leader = sim.classLeader();
  return (
    // `timetable` is for the end-to-end tests to find it by
    <div class={cx('timetable', timetable)}>
      <p class={statusClass(staff ? 'staffed' : 'unstaffed')}>
        {staff ? `Led by ${staff.name}` : <IconText id="ui-warning">{`Needs ${an(ROLES.instructor.name)}`}</IconText>}
      </p>{' '}
      <p class="sub">{classNote(standing, spots.length, lead?.progress ?? 0)}</p>
      {leader && (
        <p class="sub">
          <Line line={placesNote(spots.length, leader.places, leader.staff.skill)} />
        </p>
      )}
      {!!lead?.progress && <Bar value={lead.progress * 100} tone="blue" show={meterPercent(lead.progress * 100)} />}
      <p>
        <b>Timetable</b>
      </p>
      <div class={dayRow}>
        {WEEKDAYS.map((name, d) => (
          <Button
            key={name}
            class={cx(day, days.includes(d) && 'on')}
            title={days.includes(d) ? `No class on ${name}` : `Hold a class on ${name}`}
            onPress={() => {
              sim.toggleClassDay(room.id, d);
            }}
          >
            {name}
          </Button>
        ))}
      </div>
      <p class="sub">{leader && days.length ? demandNote(leader.interest, days.length) : weekNote(days)}</p>
      <p class="status">{bookingNote(room.booked, sim.s.day)}</p>
    </div>
  );
}
