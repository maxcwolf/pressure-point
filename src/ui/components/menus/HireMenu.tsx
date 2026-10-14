// The Hire menu: the applicants for each role, a tab per role.

import './HireMenu.css';

import { ROLES, traitOf } from '../../../core/data';
import { money } from '../../../core/format';
import { applicantCap, rankName } from '../../../core/sim/careers';
import { unlockedUpTo } from '../../../core/state/game';
import { useGame, useHud } from '../../hooks/use-hud';
import { hireableRoles } from '../../lib/catalog';
import { cx } from '../../lib/cx';
import { Button } from '../common/Button';
import { QualChips } from '../common/QualChips';
import { Stars } from '../common/Stars';

/** The applicants for the chosen role. */
export function HireMenu() {
  const hud = useHud();
  const { sim } = useGame();
  const s = sim.s;
  const roles = hireableRoles(unlockedUpTo(s), (d) => sim.enabled(d));
  // a role whose discipline has been switched off cannot stay selected
  const role = roles.includes(hud.hireRole) ? hud.hireRole : (roles[0] ?? hud.hireRole);
  return (
    <div class="panel menu">
      <h3>Hire staff</h3>
      <div class="tabs">
        {roles.map((r) => (
          <Button
            key={r}
            class={cx('tab', role === r && 'on')}
            onPress={() => {
              hud.hireRole = r;
            }}
          >
            {`${ROLES[r].icon} ${ROLES[r].name}`}
          </Button>
        ))}
      </div>
      <p class="sub">
        {`${ROLES[role].desc} Up to ${applicantCap(s)} apply for each role at a time, more as stars are earned; a new applicant turns up every few days.`}
      </p>
      <div class="cards">
        {s.candidates
          .filter((c) => c.role === role)
          .map((c) => (
            <div key={c.id} class="card cv">
              <b>{c.name}</b>
              <span class="rank">
                {rankName(c.skill)} <Stars count={c.skill} />
              </span>
              <QualChips quals={c.quals} />
              {c.traits.length ? (
                c.traits.map((t) => <em key={t} title={traitOf(t).desc}>{`${traitOf(t).name}: ${traitOf(t).desc}`}</em>)
              ) : (
                <em class="none">No notable quirks</em>
              )}{' '}
              <span class="cost">
                {money(c.salary)}
                <small>/month</small>
              </span>{' '}
              <div class="btnrow">
                <Button
                  class="go"
                  quiet
                  onPress={() => {
                    sim.hire(c.id);
                  }}
                >
                  Hire
                </Button>
                <Button
                  class="reject"
                  title="Turn them down, to make room for someone new"
                  onPress={() => {
                    sim.reject(c.id);
                  }}
                >
                  Reject
                </Button>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}
