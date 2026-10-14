// The Staff menu: everyone on the payroll.

import './StaffMenu.css';

import { ROLES } from '../../../core/data';
import { money } from '../../../core/format';
import { useGame, useHud } from '../../hooks/use-hud';
import { moraleLook, staffStatus } from '../../lib/status';
import { Bar } from '../common/Bar';
import { Button } from '../common/Button';

/** A row per member of staff, with their energy and morale. Pressing one selects them and moves the camera there. */
export function StaffMenu() {
  const hud = useHud();
  const { sim } = useGame();
  const staff = sim.s.staff;
  const payroll = staff.reduce((total, st) => total + st.salary, 0);
  return (
    <div class="panel menu">
      <h3>Your staff</h3>
      {staff.length > 0 && (
        <div class="row head" aria-hidden="true">
          <i />
          <b>Name</b>
          <span>Doing</span>
          <span>
            <em class="energy-key">Energy</em> / <em class="morale-key">morale</em>
          </span>
          <small>Salary</small>
        </div>
      )}
      {staff.length ? (
        staff.map((st) => (
          <Button
            key={st.id}
            class="row"
            onPress={() => {
              hud.show({ kind: 'staff', id: st.id });
            }}
          >
            <i>{ROLES[st.role].icon}</i>
            <b>{`${sim.aboutToQuit(st) ? '⚠️ ' : st.raiseAsked ? '💰 ' : ''}${st.name}`}</b>
            <span>{staffStatus(st, sim)}</span>
            <span class="meters" title={`Energy ${Math.round(st.energy)}%, morale ${Math.round(st.morale)}%`}>
              <Bar value={st.energy} class="thin energy" />
              <Bar value={st.morale} class={`thin ${moraleLook(st.morale)}`} />
            </span>
            <small>{money(st.salary)}</small>
          </Button>
        ))
      ) : (
        <p class="sub">Nobody works here yet. Try the Hire menu.</p>
      )}
      <p class="sub">
        Monthly payroll: <b>{money(payroll)}</b>
      </p>
    </div>
  );
}
