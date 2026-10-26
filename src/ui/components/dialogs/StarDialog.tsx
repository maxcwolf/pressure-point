// The celebration when a star is earned.

import { useState } from 'preact/hooks';

import { nextCenter } from '../../../core/campaign';
import { CAMPAIGN, centerOf, CENTERS, STAR_KARMA } from '../../../core/data';
import { money } from '../../../core/format';
import { loadCampaign } from '../../../storage/campaign';
import { css } from '../../../styled-system/css';
import { goButton } from '../../../styled-system/recipes';
import { useGame, useHud } from '../../hooks/use-hud';
import { karmaText } from '../../lib/karma';
import { newRoomsText, treatmentsUnlockedAt } from '../../lib/unlocks';
import { Button } from '../common/Button';
import { IconText } from '../common/Icon';
import { StarRow } from '../common/Stars';
import { Dialog } from './Dialog';

/** The stars earned, big and gold, outlined in navy, with the ones still to earn faint. */
const bigStars = css({
  color: 'star',
  fontSize: '[52px]',
  letterSpacing: '[6px]',
  WebkitTextStroke: '[{borderWidths.medium} {colors.outline}]',
  paintOrder: 'stroke fill',
});

/** What the star unlocks, on a lilac card. */
const unlock = css({
  bg: 'special.bg',
  border: '[{borderWidths.thin} solid {colors.special.solid}]',
  borderRadius: '12',
  py: '8',
  px: '12',
  mt: '10',
  fontSize: '14 !important',
});

/** The new star, the grant that comes with it, and what it unlocks. */
export function StarDialog() {
  const hud = useHud();
  const { sim } = useGame();
  const n = hud.star;
  const goals = centerOf(sim.s).goals;
  // a game the cheat console has been used in earns the campaign nothing: no karma, and no center opened
  const counts = !sim.s.cheated;
  // the first star in a campaign center opens the next one
  const opens = n === 1 && counts ? nextCenter(sim.s.center) : undefined;
  /** Whether a discipline is switched on. */
  const enabled = sim.enabled.bind(sim);
  // with everything unlocked from the start, a star opens nothing new
  const rooms = sim.s.unlockAll ? '' : newRoomsText(n, enabled, sim.s.center);
  const treatments = sim.s.unlockAll ? [] : treatmentsUnlockedAt(n, enabled);
  // karma comes with a campaign star the first time it is earned; a replay that only matches the best earns none
  // (worked out once, as the dialog opens, since an autosave while it is open records the star)
  const [karma] = useState(
    () => counts && CAMPAIGN.includes(sim.s.center) && n > (loadCampaign().stars[sim.s.center] ?? 0),
  );
  return (
    <Dialog>
      <div class={bigStars}>
        <StarRow earned={n} of={goals.length} />
      </div>{' '}
      <h2>{n >= goals.length ? 'Three stars!' : `Star ${n} earned!`}</h2>{' '}
      <p>{`The wellness inspectors were deeply relaxed by what they saw. Here is a ${money(5000 * n)} grant.`}</p>
      {rooms && (
        <p class={unlock}>
          <b>New room:</b>
          {` ${rooms}`}
        </p>
      )}
      {treatments.length > 0 && (
        <p class={unlock}>
          <b>New treatments:</b>
          {treatments.map((t, i) => (
            <span key={t.text}>
              {i ? ', ' : ' '}
              <IconText id={t.icon}>{t.text}</IconText>
            </span>
          ))}
          .
          <br />
          Guests who need them will start arriving. Train your staff in a Training Room and check the Treatments menu
          for equipment.
        </p>
      )}{' '}
      {karma && (
        <p class={unlock}>
          <b>
            <IconText id="ui-karma">{`+${karmaText(STAR_KARMA)}`}</IconText>
          </b>
          {' to unlock items that stay unlocked in every center. Find them in the Items menu, or the karma shop.'}
        </p>
      )}{' '}
      {/* the first star of the first center, while the cards that explain things are on */}
      {n === 1 && sim.s.lessons && sim.s.center === CAMPAIGN[0] && (
        <p>
          Each star opens more for the center to grow into: the rooms, treatments and items this one brings are listed
          here, ready in the Rooms and Items menus.
        </p>
      )}{' '}
      {opens && (
        <p class={unlock}>
          <b>{`${CENTERS[opens].name} is open:`}</b>
          {' choose it from Campaign on the title screen whenever you are ready.'}
        </p>
      )}{' '}
      <p class="sub">
        {goals[n]
          ? 'New objectives are waiting in the top-left corner.'
          : sim.s.center === 'sandbox'
            ? 'You have mastered the lot. Every treatment is open to you.'
            : counts
              ? `${centerOf(sim.s).name} is complete. Every star there is yours.`
              : 'Cheats were used in this game, so the campaign keeps none of its stars.'}
      </p>{' '}
      <Button
        class={goButton()}
        onPress={() => {
          hud.close();
        }}
      >
        Keep healing
      </Button>
    </Dialog>
  );
}
