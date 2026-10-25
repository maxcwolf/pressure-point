// The Staff menu: everyone on the payroll.

import { MODALITIES, type Modality, MODALITY_ORDER, ROLES } from '../../../core/data';
import { money } from '../../../core/format';
import { rankName } from '../../../core/sim/careers';
import { wagesDue } from '../../../core/sim/economy';
import type { Sim } from '../../../core/sim/sim';
import type { Staff } from '../../../core/state/types';
import { css } from '../../../styled-system/css';
import { goButton, panelCard, tabButton, tabStrip } from '../../../styled-system/recipes';
import { useGame, useHud } from '../../hooks/use-hud';
import { cx } from '../../lib/cx';
import { sorted, STAFF_SORTS } from '../../lib/sorts';
import { moraleLook, promotionRequests, raiseRequests, staffStatus } from '../../lib/status';
import { Bar } from '../common/Bar';
import { Button } from '../common/Button';
import { Icon, IconText } from '../common/Icon';
import { QualChips } from '../common/QualChips';
import { SortBy } from '../common/SortBy';
import { menuHead, menuPanel, tabRow } from './looks';

/**
 * A row for one of the staff, which selects them, and the row of headings over the rows. Their role's icon stands
 * beside both of a row's lines, so the line under the name sits close; that line holds the treatments they know, or
 * their role if it has none. What has a tooltip of its own sits above the button stretched over the row, as does the
 * button to promote them or raise their pay.
 */
const row = css({
  position: 'relative',
  w: '[100%]',
  display: 'grid',
  gridTemplateColumns: '[30px 1.1fr 1.3fr 96px 64px 112px]',
  alignItems: 'center',
  rowGap: 'xxs',
  columnGap: 'm',
  textAlign: 'left',
  bg: 'white',
  border: '[2px solid {colors.ink.35}]',
  borderRadius: '[11px]',
  p: '[6px 9px]',
  mb: '[5px]',
  fontSize: '13',
  '&:not(.head)': { cursor: 'pointer' },
  _hover: { borderColor: 'teal-dark', bg: 'teal-tint' },
  '& b': { fontWeight: 'bold' },
  '& .meters': { position: 'relative', zIndex: '[1]', display: 'grid', rowGap: '[3px]' },
  '& .quals > span': { position: 'relative', zIndex: '[1]' },
  '& > button.act': { position: 'relative', zIndex: '[1]' },
  '& .meters .bar': { mt: 'none' },
  '&.head': {
    bg: '[none]',
    borderColor: 'transparent',
    pt: 'none',
    pb: 'none',
    mb: 'xxs',
    fontSize: '12',
    opacity: '[0.7]',
  },
  '&.head:hover': { bg: '[none]', borderColor: 'transparent' },
  '&.head em': { fontStyle: 'normal', fontWeight: 'bold' },
  '& small': { textAlign: 'right' },
  '& > .icon': { gridRow: '[span 2]' },
  '& .knows': { gridColumn: '[2 / -1]', fontSize: '12', opacity: '[0.85]' },
  '& .knows:has(.quals)': { opacity: '[1]' },
  '& .knows .quals': { m: 'none' },
});

/** The empty button stretched over a whole row to select them, which the cells' words show through. */
const pick = css({
  position: 'absolute',
  inset: '[0]',
  border: '[0]',
  borderRadius: '[inherit]',
  p: 'none',
  bg: '[none]',
});

/** The energy in the headings, in the purple of its bar. */
const energyKey = css({ color: '[#6f55b8]' });

/** Morale in the headings: green while it is fine, amber as it sags and red when low, like the bar in the inspector. */
const moraleKey = css({ color: 'good' });

/**
 * The button to promote someone or raise their pay, small enough that a row keeps to one line however narrow the
 * menu. One they asked for, or a promotion, is gold.
 */
const act = css({
  border: 'control',
  borderRadius: '[10px]',
  bg: 'cream',
  fontSize: '12',
  fontWeight: 'bold',
  p: '[1px 8px]',
  whiteSpace: 'nowrap',
  justifySelf: 'end',
  '&.go': { bg: 'gold', color: 'navy', boxShadow: '[none]', mt: 'none' },
  _hover: { filter: '[brightness(1.06)]', transform: 'none' },
});

/** The buttons to promote everyone waiting, or pay every raise asked for. */
const requests = css({
  display: 'flex',
  flexWrap: 'wrap',
  gap: 's',
  mb: 's',
  '& button.act': { p: '[3px 10px]' },
});

/** The treatments to narrow the list to, each with how many know it. */
const knowsFilter = css({ '& .tab small': { fontSize: '11', fontWeight: 'bold', opacity: '[0.7]' } });

/** Whether someone knows a treatment, or is on its course. */
const knowsOrLearning = (st: Staff, m: Modality) => st.quals.includes(m) || st.training?.course === m;

/** Buttons to narrow the list to those who know a treatment, one per treatment someone knows or is learning. */
function KnowsFilter({ staff, knows }: { staff: readonly Staff[]; knows: Modality | null }) {
  const hud = useHud();
  const treatments = MODALITY_ORDER.filter((m) => staff.some((st) => knowsOrLearning(st, m)));
  if (!treatments.length) return null;
  return (
    <div class={cx(tabStrip(), 'knows', tabRow, knowsFilter)} role="group" aria-label="Who knows a treatment">
      <Button
        class={cx(tabButton({ size: 'small' }), knows === null && 'on')}
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
            class={cx(tabButton({ size: 'small' }), knows === m && 'on')}
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
        class={cx('act', goButton(), act)}
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
      class={cx('act', act, st.raiseAsked && goButton())}
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
    <div class={cx('requests', requests)}>
      {ready.length > 1 && (
        <Button
          class={cx('act', goButton(), act)}
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
          class={cx('act', goButton(), act)}
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
  /**
   * Select someone from a press on their row outside its buttons: on the bars or a chip, which sit above the stretched
   * button to show their tooltips. It clicks and redraws as a button would. A press a button took is already handled,
   * and its target may be gone from the button by now, redrawn with new words.
   */
  const pressRow = (e: PointerEvent, id: number) => {
    if (e.button !== 0 || e.defaultPrevented) return;
    e.preventDefault();
    const { audio } = hud.host;
    audio.unlock();
    hud.show({ kind: 'staff', id });
    audio.play('blip');
    hud.update();
  };
  return (
    <div class={cx(panelCard(), menuPanel)}>
      <div class={menuHead}>
        <h3>Your staff</h3>
        {staff.length > 1 && <SortBy list="staff" orders={STAFF_SORTS} />}
      </div>
      <KnowsFilter staff={staff} knows={knows} />
      <Requests staff={staff} />
      {staff.length > 0 && (
        <div class={cx('row', 'head', row)} aria-hidden="true">
          <i />
          <b>Name</b>
          <span>Doing</span>
          <span>
            <em class={energyKey}>Energy</em> / <em class={moraleKey}>morale</em>
          </span>
          <small>Salary</small>
          <i />
        </div>
      )}
      {shown.length ? (
        shown.map((st) => (
          <div
            key={st.id}
            class={cx('row', row)}
            onPointerDown={(e) => {
              pressRow(e, st.id);
            }}
          >
            {/* the whole row selects them, from a button stretched over its cells, as a button cannot hold another */}
            <Button
              class={pick}
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
