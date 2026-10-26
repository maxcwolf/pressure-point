// The Hire menu: the applicants for each role, a tab per role.

import { ROLES, traitOf } from '../../../core/data';
import { money } from '../../../core/format';
import { applicantCap, rankName } from '../../../core/sim/careers';
import { wantsHire } from '../../../core/sim/tutorial';
import { unlockedUpTo } from '../../../core/state/game';
import { css } from '../../../styled-system/css';
import { buttonRow, goButton, guideRing, panelCard, tabButton, tabStrip } from '../../../styled-system/recipes';
import { useGame, useHud } from '../../hooks/use-hud';
import { hireableRoles } from '../../lib/catalog';
import { cx } from '../../lib/cx';
import { APPLICANT_SORTS, sorted } from '../../lib/sorts';
import { Button } from '../common/Button';
import { IconText } from '../common/Icon';
import { QualChips } from '../common/QualChips';
import { SortBy } from '../common/SortBy';
import { Stars } from '../common/Stars';
import { cardLook, cards, menuHead, menuPanel } from './looks';

/**
 * An applicant's card: their rank and stars on a line, their pay in the gold tag under their quirks rather than at the
 * top, and the buttons to hire or turn them down along the bottom.
 */
const cv = css(cardLook, {
  '& .cost': { position: 'static', alignSelf: 'flex-start', mt: '4', mb: '8' },
  '& .btnrow': { mt: 'auto', display: 'flex', gap: '6' },
  '& .btnrow .go': { flex: '1' },
  '& .reject': {
    border: 'outline.thin',
    borderRadius: '10',
    bg: 'bg.card',
    fontSize: '12',
    fontWeight: 'bold',
    py: '0',
    px: '8',
  },
  '& .rank': { display: 'flex', alignItems: 'center', gap: '4', fontSize: '13' },
  '& small': { fontWeight: 'regular', fontSize: '11' },
});

/** The applicants for the chosen role, in the order picked. */
export function HireMenu() {
  const hud = useHud();
  const { sim } = useGame();
  const s = sim.s;
  const roles = hireableRoles(unlockedUpTo(s), (d) => sim.enabled(d));
  // a role whose discipline has been switched off cannot stay selected
  const role = roles.includes(hud.hireRole) ? hud.hireRole : (roles[0] ?? hud.hireRole);
  const guide = hud.guide();
  const applicants = sorted(
    s.candidates.filter((c) => c.role === role),
    APPLICANT_SORTS,
    hud.sorts.applicants,
  );
  return (
    <div class={cx(panelCard(), menuPanel)}>
      <div class={menuHead}>
        <h3>Hire staff</h3>
        {applicants.length > 1 && <SortBy list="applicants" orders={APPLICANT_SORTS} />}
      </div>
      <div class={tabStrip()}>
        {roles.map((r) => (
          <Button
            key={r}
            class={cx(tabButton(), role === r && 'on', guide === `role:${r}` && guideRing())}
            onPress={() => {
              hud.hireRole = r;
            }}
          >
            <IconText id={ROLES[r].icon}>{ROLES[r].name}</IconText>
          </Button>
        ))}
      </div>
      <p class="sub">
        {`${ROLES[role].desc} Up to ${applicantCap(s)} apply for each role at a time, more as stars are earned; a new applicant turns up every few days.`}
      </p>
      {/* the tutorial rings the row, any of them being a hire: the choice is the player's to read off the cards */}
      <div class={cx(cards, guide === 'hire:any' && guideRing())}>
        {applicants.map((c) => (
          <div key={c.id} class={cx('card', 'cv', cv)}>
            <b>{c.name}</b>
            <span class="rank">
              {rankName(c.skill)} <Stars count={c.skill} />
            </span>
            <QualChips quals={c.quals} />
            {c.traits.length ? (
              c.traits.map((t) => (
                <em key={t} class={traitOf(t).bad ? 'bad' : 'good'} title={traitOf(t).desc}>
                  {`${traitOf(t).name}: ${traitOf(t).desc}`}
                </em>
              ))
            ) : (
              <em class="none">No notable quirks</em>
            )}{' '}
            <span class="cost">
              {money(c.salary)}
              <small>/month</small>
            </span>{' '}
            <div class={buttonRow()}>
              <Button
                class={goButton()}
                quiet
                onPress={() => {
                  // the step changes once the hire is done, so what it asked is read before
                  const asked = wantsHire(sim.tutorialStep(), c.role);
                  // the hire the tutorial asked for is done: out of the way of its next card
                  if (sim.hire(c.id) && asked) hud.closeMenu();
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
