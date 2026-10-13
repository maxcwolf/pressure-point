// The Staff menu: everyone on the payroll.

import './StaffMenu.css';

import { ROLES } from '../../../core/data';
import { money } from '../../../core/format';
import { useGame } from '../../hooks/use-hud';
import { staffStatus } from '../../lib/status';
import { Bar } from '../common/Bar';
import { Button } from '../common/Button';

/** A row per member of staff. Pressing one selects them and moves the camera there. */
export function StaffMenu() {
  const { sim, tools, view } = useGame();
  const staff = sim.s.staff;
  const payroll = staff.reduce((total, st) => total + st.salary, 0);
  return (
    <div class="panel menu">
      <h3>Your staff</h3>
      {staff.length ? (
        staff.map((st) => (
          <Button
            key={st.id}
            class="row"
            onPress={() => {
              tools.select({ kind: 'staff', id: st.id });
              view.target.set(st.x, 0, st.y);
            }}
          >
            <i>{ROLES[st.role].icon}</i>
            <b>{`${st.raiseAsked ? '💰 ' : ''}${st.name}`}</b>
            <span>{staffStatus(st, sim)}</span>
            <Bar value={st.energy} class="thin energy" />
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
