// A Qi Gong Studio's timetable in its inspector: a button for each day of the week, and how the next class is filling.

import { ROLES, WEEKDAYS } from '../../../core/data';
import { classDays } from '../../../core/sim/classes';
import type { Room } from '../../../core/state/types';
import { useGame } from '../../hooks/use-hud';
import { bookingNote, classNote, demandNote, placesNote, weekNote } from '../../lib/classes';
import { cx } from '../../lib/cx';
import { meterPercent } from '../../lib/meters';
import { statusClass } from '../../lib/status';
import { Bar } from '../common/Bar';
import { Button } from '../common/Button';
import { IconText, Line } from '../common/Icon';

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
    <div class="timetable">
      <p class={statusClass(staff ? 'staffed' : 'unstaffed')}>
        {staff ? `Led by ${staff.name}` : <IconText id="ui-warning">{`Needs a ${ROLES.instructor.name}`}</IconText>}
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
      <div class="days">
        {WEEKDAYS.map((name, d) => (
          <Button
            key={name}
            class={cx('day', days.includes(d) && 'on')}
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
