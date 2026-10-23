// The Staff menu: everyone on the payroll.

import './StaffMenu.css';

import { MODALITIES, type Modality, MODALITY_ORDER, ROLES } from '../../../core/data';
import { money } from '../../../core/format';
import { wagesDue } from '../../../core/sim/economy';
import type { Staff } from '../../../core/state/types';
import { useGame, useHud } from '../../hooks/use-hud';
import { cx } from '../../lib/cx';
import { moraleLook, staffStatus } from '../../lib/status';
import { Bar } from '../common/Bar';
import { Button } from '../common/Button';
import { Icon, IconText } from '../common/Icon';
import { QualChips } from '../common/QualChips';

/** Whether someone knows a treatment, or is on its course. */
const knowsOrLearning = (st: Staff, m: Modality) => st.quals.includes(m) || st.training?.course === m;

/** Buttons to narrow the list to those who know a treatment, one per treatment someone knows or is learning. */
function KnowsFilter({ staff, knows }: { staff: readonly Staff[]; knows: Modality | null }) {
  const hud = useHud();
  const treatments = MODALITY_ORDER.filter((m) => staff.some((st) => knowsOrLearning(st, m)));
  if (!treatments.length) return null;
  return (
    <div class="tabs filters knows" role="group" aria-label="Who knows a treatment">
      <Button
        class={cx('tab', 'small', knows === null && 'on')}
        onPress={() => {
          hud.staffKnows = null;
        }}
      >
        Everyone
      </Button>
      {treatments.map((m) => {
        const qualified = staff.filter((st) => st.quals.includes(m)).length;
        const learning = staff.filter((st) => st.training?.course === m).length;
        return (
          <Button
            key={m}
            class={cx('tab', 'small', knows === m && 'on')}
            title={`${qualified} qualified${learning ? `, ${learning} learning` : ''}. Click to show only them.`}
            onPress={() => {
              hud.staffKnows = knows === m ? null : m;
            }}
          >
            <IconText id={MODALITIES[m].icon}>{MODALITIES[m].name}</IconText> <small>{qualified}</small>
          </Button>
        );
      })}
    </div>
  );
}

/**
 * A row per member of staff, with their energy, morale and the treatments they know, which the list can be narrowed
 * to. Pressing one selects them and moves the camera there.
 */
export function StaffMenu() {
  const hud = useHud();
  const { sim } = useGame();
  const staff = sim.s.staff;
  // a treatment nobody knows any more narrows the list to nobody, so it falls back to everyone
  const asked = hud.staffKnows;
  const knows = asked && staff.some((st) => knowsOrLearning(st, asked)) ? asked : null;
  const shown = knows ? staff.filter((st) => knowsOrLearning(st, knows)) : staff;
  // a month of everyone staying on, and what the coming payday owes, by the days each has worked since they were paid
  const payroll = staff.reduce((total, st) => total + (st.state === 'leaving' ? 0 : st.salary), 0);
  const due = wagesDue(sim.s);
  return (
    <div class="panel menu">
      <h3>Your staff</h3>
      <KnowsFilter staff={staff} knows={knows} />
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
      {shown.length ? (
        shown.map((st) => (
          <Button
            key={st.id}
            class="row"
            onPress={() => {
              hud.show({ kind: 'staff', id: st.id });
            }}
          >
            <Icon id={ROLES[st.role].icon} size={26} />
            <b>
              <IconText id={sim.aboutToQuit(st) ? 'ui-warning' : st.raiseAsked ? 'bubble-raise' : undefined}>
                {st.name}
              </IconText>
            </b>
            <span>{staffStatus(st, sim)}</span>
            <span class="meters" title={`Energy ${Math.round(st.energy)}%, morale ${Math.round(st.morale)}%`}>
              <Bar value={st.energy} class="thin energy" />
              <Bar value={st.morale} class={`thin ${moraleLook(st.morale)}`} />
            </span>
            <small>{money(st.salary)}</small>
            <span class="knows">
              {st.quals.length || st.general.length || (st.training && st.training.course !== 'skill') ? (
                <QualChips quals={st.quals} general={st.general} learning={st.training?.course} />
              ) : (
                ROLES[st.role].name
              )}
            </span>
          </Button>
        ))
      ) : (
        <p class="sub">Nobody works here yet. Try the Hire menu.</p>
      )}
      <p class="sub">
        Monthly payroll: <b>{money(payroll)}</b> · due on payday: <b>{money(due)}</b>
      </p>
    </div>
  );
}
