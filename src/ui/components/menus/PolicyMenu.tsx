// The Policy menu: how sure a diagnosis must be, who goes first, and when staff take breaks.

import './PolicyMenu.css';

import { BREAK_AT_MAX, BREAK_AT_MIN, DIAGNOSIS_MAX, DIAGNOSIS_MIN, ROLE_ORDER, ROLES } from '../../../core/data';
import { useGame } from '../../hooks/use-hud';
import { percent } from '../../lib/chance';
import { cx } from '../../lib/cx';
import { Button } from '../common/Button';

/** The most of one role a break limit can be set to; above it, the limit is off. */
const MAX_BREAK_LIMIT = 5;

/** A setting with a value and a pair of buttons to step it down and up, its name above them or, inline, beside them. */
function Stepper(props: {
  name: string;
  value: string;
  atMin: boolean;
  atMax: boolean;
  inline?: boolean;
  onStep: (by: number) => void;
}) {
  return (
    <div class={cx('stepper', props.inline && 'inline')}>
      <span>{props.name}</span>
      <Button
        locked={props.atMin}
        onPress={() => {
          props.onStep(-1);
        }}
      >
        −
      </Button>
      <b>{props.value}</b>
      <Button
        locked={props.atMax}
        onPress={() => {
          props.onStep(1);
        }}
      >
        +
      </Button>
    </div>
  );
}

/** The center's policy, each setting with a word on what it trades off. */
export function PolicyMenu() {
  const { sim } = useGame();
  const p = sim.s.policy;
  const roles = ROLE_ORDER.filter((r) => sim.s.staff.some((st) => st.role === r));
  return (
    <div class="panel menu policy-menu">
      <h3>Policy</h3>
      <div class="policy-cards">
        <div class="policy-card">
          <h4>Diagnosis</h4>
          <Stepper
            name="Treat once a diagnosis is"
            value={`${percent(p.diagnosis)} sure`}
            atMin={p.diagnosis <= DIAGNOSIS_MIN}
            atMax={p.diagnosis >= DIAGNOSIS_MAX}
            onStep={(by) => {
              sim.setPolicy({ diagnosis: p.diagnosis + by * 0.05 });
            }}
          />
          <p class="sub">
            Surer diagnoses make treatments likelier to work, but take more consultations and longer waits. Nobody is
            consulted more than four times.
          </p>
        </div>
        <div class="policy-card">
          <h4>Emergencies</h4>
          <Button
            class={cx('toggle', 'emergencies-first', p.emergenciesFirst && 'on')}
            onPress={() => {
              sim.setPolicy({ emergenciesFirst: !p.emergenciesFirst });
            }}
          >
            {p.emergenciesFirst ? '🚨 Emergencies first: on' : '🚨 Emergencies first: off'}
          </Button>
          <p class="sub">Emergency guests are called ahead of everyone else in line, whatever their place in it.</p>
        </div>
        <div class="policy-card">
          <h4>Breaks</h4>
          <Stepper
            name="Take a break below"
            value={`${p.breakAt} energy`}
            atMin={p.breakAt <= BREAK_AT_MIN}
            atMax={p.breakAt >= BREAK_AT_MAX}
            onStep={(by) => {
              sim.setPolicy({ breakAt: p.breakAt + by * 5 });
            }}
          />
          <p class="sub">Earlier breaks keep staff fresher, but leave their stations empty more often.</p>
          {roles.length > 0 && <h4>On a break at once</h4>}
          {roles.map((role) => {
            const limit = p.breakLimit[role] ?? 0;
            return (
              <Stepper
                key={role}
                inline
                name={`${ROLES[role].icon} ${ROLES[role].name}s`}
                value={limit ? `${limit}` : 'Any'}
                atMin={limit === 1}
                atMax={!limit}
                onStep={(by) => {
                  // no limit sits above the highest one: down from it starts there, and up past it comes back to it
                  const next = limit ? limit + by : by < 0 ? MAX_BREAK_LIMIT : 0;
                  sim.setPolicy({ breakLimit: { role, limit: next > MAX_BREAK_LIMIT ? 0 : next } });
                }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
