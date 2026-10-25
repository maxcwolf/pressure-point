// The Staff menu: everyone on the payroll.

import './StaffMenu.css';

import { MODALITIES, type Modality, MODALITY_ORDER, ROLES } from '../../../core/data';
import { money } from '../../../core/format';
import { rankName } from '../../../core/sim/careers';
import { wagesDue } from '../../../core/sim/economy';
import type { Sim } from '../../../core/sim/sim';
import type { Staff } from '../../../core/state/types';
import { useGame, useHud } from '../../hooks/use-hud';
import { cx } from '../../lib/cx';
import { sorted, STAFF_SORTS } from '../../lib/sorts';
import { moraleLook, promotionRequests, raiseRequests, staffStatus } from '../../lib/status';
import { Bar } from '../common/Bar';
import { Button } from '../common/Button';
import { Icon, IconText } from '../common/Icon';
import { QualChips } from '../common/QualChips';
import { SortBy } from '../common/SortBy';

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

/** What a member of staff would be paid once promoted: the going rate for the rank above, if that is more. */
const promotedPay = (sim: Sim, st: Staff) => Math.max(st.salary, sim.fairPay({ ...st, skill: st.skill + 1 }));

/** The one thing to do for a member of staff from their row: promote them, pay the raise they asked for, or give one. */
function RowAction({ staff: st }: { staff: Staff }) {
  const { sim } = useGame();
  if (st.state === 'leaving') return <i />;
  if (st.promotion) {
    return (
      <Button
        class="act go"
        title={`To ${rankName(st.skill + 1)}, on ${money(promotedPay(sim, st))} a month`}
        quiet
        onPress={() => {
          sim.promote(st.id);
        }}
      >
        <IconText id="ui-upgrade">Promote</IconText>
      </Button>
    );
  }
  return (
    <Button
      class={cx('act', st.raiseAsked && 'go')}
      title={
        st.raiseAsked
          ? 'They asked for a raise. Paying it lifts their morale.'
          : `Going rate ${money(sim.fairPay(st))} a month. A raise lifts their morale.`
      }
      quiet
      onPress={() => {
        sim.giveRaise(st.id);
      }}
    >
      <IconText id={st.raiseAsked ? 'bubble-raise' : undefined}>
        {`${st.raiseAsked ? 'Pay' : 'Raise to'} ${money(sim.raiseTo(st))}`}
      </IconText>
    </Button>
  );
}

/**
 * Buttons to promote everyone ready at once, or pay every raise asked for, each with what it adds to the monthly
 * payroll. Each shows only with two or more waiting, as one is seen to from their row.
 */
function Requests({ staff }: { staff: readonly Staff[] }) {
  const { sim } = useGame();
  const ready = promotionRequests(staff);
  // a promotion comes with a raise of its own, so those waiting on one are left to it
  const asking = raiseRequests(staff).filter((st) => !st.promotion);
  if (ready.length < 2 && asking.length < 2) return null;
  const promoting = ready.reduce((total, st) => total + promotedPay(sim, st) - st.salary, 0);
  const raising = asking.reduce((total, st) => total + sim.raiseTo(st) - st.salary, 0);
  return (
    <div class="requests">
      {ready.length > 1 && (
        <Button
          class="act go"
          quiet
          onPress={() => {
            sim.promoteAll();
          }}
        >
          <IconText id="ui-upgrade">{`Promote all ${ready.length} (+${money(promoting)}/month)`}</IconText>
        </Button>
      )}
      {asking.length > 1 && (
        <Button
          class="act go"
          quiet
          onPress={() => {
            sim.giveRaisesAsked();
          }}
        >
          <IconText id="bubble-raise">{`Give the ${asking.length} raises asked for (+${money(raising)}/month)`}</IconText>
        </Button>
      )}
    </div>
  );
}

/**
 * A row per member of staff, with their energy, morale and the treatments they know, which the list can be narrowed
 * to, in the order picked, each with a button to promote them or raise their pay. Pressing a row selects them and
 * moves the camera there.
 */
export function StaffMenu() {
  const hud = useHud();
  const { sim } = useGame();
  const staff = sim.s.staff;
  // a treatment nobody knows any more narrows the list to nobody, so it falls back to everyone
  const asked = hud.staffKnows;
  const knows = asked && staff.some((st) => knowsOrLearning(st, asked)) ? asked : null;
  const shown = sorted(knows ? staff.filter((st) => knowsOrLearning(st, knows)) : staff, STAFF_SORTS, hud.sorts.staff);
  // a month of everyone staying on, and what the coming payday owes, by the days each has worked since they were paid
  const payroll = staff.reduce((total, st) => total + (st.state === 'leaving' ? 0 : st.salary), 0);
  const due = wagesDue(sim.s);
  return (
    <div class="panel menu">
      <div class="menu-head">
        <h3>Your staff</h3>
        {staff.length > 1 && <SortBy list="staff" orders={STAFF_SORTS} />}
      </div>
      <KnowsFilter staff={staff} knows={knows} />
      <Requests staff={staff} />
      {staff.length > 0 && (
        <div class="row head" aria-hidden="true">
          <i />
          <b>Name</b>
          <span>Doing</span>
          <span>
            <em class="energy-key">Energy</em> / <em class="morale-key">morale</em>
          </span>
          <small>Salary</small>
          <i />
        </div>
      )}
      {shown.length ? (
        shown.map((st) => (
          <div key={st.id} class="row">
            {/* the whole row selects them, from a button stretched under its cells, as a button cannot hold another */}
            <Button
              class="pick"
              label={`Show ${st.name}`}
              onPress={() => {
                hud.show({ kind: 'staff', id: st.id });
              }}
            />
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
            <RowAction staff={st} />
            <span class="knows">
              {st.quals.length || st.general.length || (st.training && st.training.course !== 'skill') ? (
                <QualChips quals={st.quals} general={st.general} learning={st.training?.course} />
              ) : (
                ROLES[st.role].name
              )}
            </span>
          </div>
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
