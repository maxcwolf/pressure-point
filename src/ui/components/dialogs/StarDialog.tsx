// The celebration when a star is earned.

import { useRef, useState } from 'preact/hooks';

import { nextCenter } from '../../../core/campaign';
import { CAMPAIGN, centerOf, CENTERS, FOUNDATION_KARMA, STAR_KARMA } from '../../../core/data';
import { money } from '../../../core/format';
import { giftsToCome } from '../../../core/sim/foundation';
import { loadCampaign } from '../../../storage/campaign';
import { listSaves, writeSave } from '../../../storage/saves';
import { storeThumb } from '../../../storage/thumbnails';
import { css } from '../../../styled-system/css';
import { buttonRow, goButton } from '../../../styled-system/recipes';
import { useGame, useHud } from '../../hooks/use-hud';
import { cannotKeepText, nextCenterChoice, threeStarName, threeStarSlot } from '../../lib/campaign';
import { cx } from '../../lib/cx';
import { giftList } from '../../lib/foundation';
import { karmaText } from '../../lib/karma';
import { newRoomsText, treatmentsUnlockedAt } from '../../lib/unlocks';
import { Button } from '../common/Button';
import { IconText } from '../common/Icon';
import { StarRow } from '../common/Stars';
import { Dialog } from './Dialog';

/** The stars earned, big and gold, outlined in navy, with the ones still to earn faint. */
const bigStars = css({
  color: 'star',
  fontSize: 'display',
  letterSpacing: 'stars.large',
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

/** Why moving on has stopped: the game could not be kept as a save of its own. */
const trouble = css({
  bg: 'bad.bg',
  color: 'bad',
  borderRadius: '12',
  py: '8',
  px: '12',
  mt: '10',
  fontSize: '14',
});

/** The new star, the grant that comes with it, and what it unlocks. */
export function StarDialog() {
  const hud = useHud();
  const { sim, view, loadGame } = useGame();
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
  const treatments = sim.s.unlockAll ? [] : treatmentsUnlockedAt(n, enabled, sim.s.opened);
  // karma comes with a campaign star the first time it is earned; a replay that only matches the best earns none
  // (worked out once, as the dialog opens, since an autosave while it is open records the star)
  const [karma] = useState(
    () => counts && CAMPAIGN.includes(sim.s.center) && n > (loadCampaign().stars[sim.s.center] ?? 0),
  );
  // the last star in a campaign center offers to move on to the next one (worked out once, since it reads every save)
  const [next] = useState(() => nextCenterChoice(sim.s.center, n, sim.s.cheated, loadCampaign().stars, listSaves()));
  /** Why moving on has stopped, when this game could not be kept as a save of its own. */
  const [stuck, setStuck] = useState('');
  // a second press while the page is reloading must not save or leave twice
  const leaving = useRef(false);
  /** Leave for the next center, once. */
  const leave = (to: string) => {
    if (leaving.current) return;
    leaving.current = true;
    loadGame(to);
  };
  /** Keep this game as a save of its own, so no later new game moves it out of "Previous game", and go on to the next. */
  const goNext = (to: string) => {
    if (leaving.current) return;
    const saves = listSaves();
    const saved = writeSave(sim.s, threeStarName(sim.s.center), threeStarSlot(sim.s.center, saves));
    if (typeof saved === 'string') {
      setStuck(cannotKeepText(saves));
      return;
    }
    storeThumb(saved.id, view.snapshot());
    leave(to);
  };
  // every star in a campaign center opens the Foundation, for the gifts not made here already
  const gifts = n >= goals.length && counts && CAMPAIGN.includes(sim.s.center) ? giftsToCome(sim.s) : [];
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
      {gifts.length > 0 && (
        <p class={unlock}>
          <b>
            <IconText id="ui-karma">The Pressure Point Foundation is open:</IconText>
          </b>
          {` gifts of ${giftList(gifts)}, each worth +${karmaText(FOUNDATION_KARMA)}. Find it in the Money menu, on the Books tab.`}
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
      {next && !stuck && (
        <p class={unlock}>
          <b>{`${next.name} awaits.`}</b>
          {next.started ? ' Your game there picks up where you left it' : ' A new game starts there'}
          {`, and this one is kept under Load game as "${threeStarName(sim.s.center)}".`}
        </p>
      )}{' '}
      {/* `trouble` is for the tests */}
      {next && stuck && (
        <p class={cx('trouble', trouble)} role="alert">
          {`${stuck} Move on anyway and it is kept only as "Previous game" under Load game, or make room there first.`}
        </p>
      )}{' '}
      {next && stuck ? (
        <div class={buttonRow()}>
          <Button
            class={goButton()}
            onPress={() => {
              leave(next.what);
            }}
          >
            Move on anyway
          </Button>
          <Button
            onPress={() => {
              hud.open('saves');
            }}
          >
            Make room under Load game
          </Button>
        </div>
      ) : next ? (
        <div class={buttonRow()}>
          <Button
            class={goButton()}
            onPress={() => {
              goNext(next.what);
            }}
          >
            On to bigger and better things
          </Button>
          <Button
            onPress={() => {
              hud.close();
            }}
          >
            Stay and keep toiling here
          </Button>
        </div>
      ) : (
        <Button
          class={goButton()}
          onPress={() => {
            hud.close();
          }}
        >
          Keep healing
        </Button>
      )}
    </Dialog>
  );
}
