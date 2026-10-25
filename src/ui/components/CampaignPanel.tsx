// The campaign on the title screen: the trail of centers, the karma shop, and the achievements that earn karma.

import { useState } from 'preact/hooks';

import { track } from '../../app/analytics';
import type { Audio } from '../../audio/audio';
import { karmaLeft } from '../../core/campaign';
import { CAMPAIGN } from '../../core/data';
import { buyDecorWithKarma, buyWithKarma, loadCampaign } from '../../storage/campaign';
import { loadTutorialPref, saveTutorialPref } from '../../storage/settings';
import { css } from '../../styled-system/css';
import { goButton, tabButton, tabStrip, toggleSwitch } from '../../styled-system/recipes';
import { useRedraw } from '../hooks/use-redraw';
import { campaignCards } from '../lib/campaign';
import { cx } from '../lib/cx';
import { achievementCards, decorCards, karmaText, shopCards } from '../lib/karma';
import { Icon, IconText } from './common/Icon';
import { StarRow } from './common/Stars';

export interface CampaignPanelProps {
  /** Start a new game in a center. */
  onStart: (center: string) => void;
  /** For the click of a switch. */
  audio: Audio;
}

type Tab = 'centers' | 'shop' | 'achievements';

const TABS: readonly { id: Tab; label: string }[] = [
  { id: 'centers', label: 'Centers' },
  { id: 'shop', label: 'Karma shop' },
  { id: 'achievements', label: 'Achievements' },
];

/** The karma there is to spend, over the tabs. */
const karma = css({ fontWeight: '[700]', fontSize: '15', m: '0', mb: '8' });

/** The tabs, in the middle. */
const tabs = css({ justifyContent: 'center', mb: '10' });

/** The trail of centers, one under another. */
const trail = css({ listStyle: 'none', p: '0', m: '0', textAlign: 'left' });

/** A center on the trail: its pin, and its card beside it. A locked one has a grey pin and a faded card. */
const stop = css({
  position: 'relative',
  display: 'grid',
  gridTemplateColumns: '[36px 1fr]',
  gap: '10',
  pb: '12',
  // the dotted trail from one center to the next
  '&:not(:last-child)::before': {
    content: "''",
    position: 'absolute',
    left: '[17px]',
    top: '[34px]',
    bottom: '[0]',
    borderLeft: '[3px dashed {colors.ink.35}]',
  },
  // the pin and the card keep their class names for this
  _locked: { '& .about': { opacity: '[0.6]' }, '& .pin': { bg: '[#8a929c]' } },
});

/** A center's pin on the trail, with its number on it, or a lock. */
const pin = css({
  w: '[36px]',
  h: '[36px]',
  borderRadius: 'disc',
  display: 'grid',
  placeItems: 'center',
  bg: 'teal',
  border: '[3px solid {colors.navy}]',
  color: 'white',
  fontWeight: '[700]',
});

/** A center's card. */
const about = css({ bg: 'white', border: 'card', borderRadius: '12', py: '8', px: '10' });

/** A center's name. */
const centerName = css({ fontSize: '15' });

/** The stars earned in a center and to come, beside its name: gold, outlined in navy. */
const stars = css({
  ml: '8',
  color: 'gold',
  fontSize: '24',
  letterSpacing: '[2px]',
  WebkitTextStroke: '[1.5px {colors.navy}]',
  paintOrder: 'stroke fill',
});

/** Small print under a name: where a center is, or what an item or achievement is. */
const small = css({ display: 'block', fontSize: '12', opacity: '[0.7]' });

/** A line about a center: what it is like, how it opens, or what opens it. */
const line = css.raw({ fontSize: '13', m: '0', mt: '2', mb: '6' });
const blurb = css(line);
const opening = css(line, { fontSize: '12', opacity: '[0.8]' });
const why = css(line, { fontWeight: 'bold', mb: '0' });

/** Play, and Willow Lane's switch for the tutorial beside it. */
const play = css({ display: 'flex', flexWrap: 'wrap', alignItems: 'center', rowGap: '8', columnGap: '14' });

/** Play, without the room the go buttons usually leave above them. */
const playButton = css({ mt: '0' });

/** The switch for the tutorial, with its words. */
const tutorialSwitch = css({ display: 'flex', alignItems: 'center', gap: '8', fontSize: '13', cursor: 'pointer' });

/** The karma shop's list, and the achievements'. */
const list = css({ listStyle: 'none', p: '0', m: '0', mt: '8', display: 'grid', gap: '6', textAlign: 'left' });

/** A card in the shop or the achievements: its icon, its name over a word on it, and its price or a button to buy it. */
const card = css.raw({
  display: 'grid',
  gridTemplateColumns: '[30px 1fr auto]',
  alignItems: 'center',
  gap: '10',
  bg: 'white',
  border: 'card',
  borderRadius: '12',
  py: '6',
  px: '10',
  '& > .icon': { justifySelf: 'center' },
});

/** Something in the shop, Unlocked in green once it is. */
const shopCard = css(card, { '&.owned em': { color: 'green' } });

/** An achievement, faded until it is earned, and then ticked in green. */
const featCard = css(card, { '&:not(.done)': { opacity: '[0.7]' }, '&.done em': { color: 'green' } });

/** A name on a card. */
const cardName = css({ display: 'block', fontSize: '15' });

/** What something costs, or Unlocked, or a tick. */
const price = css({ fontStyle: 'normal', fontWeight: '[700]', fontSize: '13', whiteSpace: 'nowrap' });

/** The button to unlock something with karma, smaller than the go buttons are, and grey while there is not enough. */
const buy = css({
  m: '0',
  py: '4',
  px: '10',
  fontSize: '13',
  whiteSpace: 'nowrap',
  _disabled: { filter: '[grayscale(1)]', opacity: '[0.55]', cursor: 'default', transform: 'none' },
});

/** The heading over the floors and walls. */
const shopHead = css({ m: '0', mt: '14', textAlign: 'left', fontSize: '15' });

/** A floor or a wall, as a swatch of it. */
const swatch = css({ w: '[26px]', h: '[26px]', borderRadius: '6', border: 'card' });

/** The campaign's tabs, under the karma there is to spend. */
export function CampaignPanel({ onStart, audio }: CampaignPanelProps) {
  const [tab, setTab] = useState<Tab>('centers');
  const redraw = useRedraw();
  const progress = loadCampaign();
  return (
    <div>
      {/* `karma`, `stop`, `shop` and `shop-head` are for the tests, and `tabs` and `tab` for the shared tab look */}
      <p class={cx('karma', karma)}>
        <IconText id="ui-karma">{karmaText(karmaLeft(progress))}</IconText>
      </p>
      <div class={cx(tabStrip(), tabs)} role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            class={cx(tabButton(), tab === t.id && 'on')}
            aria-selected={tab === t.id ? 'true' : 'false'}
            onClick={() => {
              setTab(t.id);
            }}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'centers' && <Centers onStart={onStart} audio={audio} />}
      {tab === 'shop' && <Shop onBuy={redraw} />}
      {tab === 'achievements' && <Achievements />}
    </div>
  );
}

/** The switch on Willow Lane's card for whether its next game walks through the opening with the tutorial. */
function TutorialSwitch({ audio }: { audio: Audio }) {
  const redraw = useRedraw();
  const on = loadTutorialPref();
  return (
    <label class={tutorialSwitch}>
      <button
        class={cx(toggleSwitch(), on && 'on')}
        role="switch"
        aria-checked={on ? 'true' : 'false'}
        aria-label="Tutorial"
        onClick={() => {
          audio.unlock();
          saveTutorialPref(!on);
          track('setting_changed', { setting: 'tutorial', value: !on });
          audio.play('blip');
          redraw();
        }}
      >
        <span />
      </button>
      <span>Walk me through the opening</span>
    </label>
  );
}

/** A card per campaign center, joined by a trail, with Play on the ones that are open. */
function Centers({ onStart, audio }: CampaignPanelProps) {
  const cards = campaignCards(loadCampaign().stars);
  return (
    <>
      <ol class={trail}>
        {cards.map((c, i) => (
          <li key={c.id} class={cx('stop', stop, !c.open && 'locked')}>
            <span class={cx('pin', pin)}>{c.open ? i + 1 : <Icon id="ui-lock" size={22} />}</span>
            <div class={cx('about', about)}>
              <b class={centerName}>{c.name}</b>
              <span class={stars}>
                <StarRow earned={c.earned} of={c.of} />
              </span>
              <small class={small}>{c.place}</small>
              <p class={blurb}>{c.blurb}</p>
              <p class={opening}>{c.opening}</p>
              {c.open ? (
                <div class={play}>
                  <button
                    class={cx(goButton(), playButton)}
                    onClick={() => {
                      onStart(`new:${c.id}`);
                    }}
                  >
                    {c.earned ? `Play ${c.name} again` : `Play ${c.name}`}
                  </button>
                  {c.id === CAMPAIGN[0] && <TutorialSwitch audio={audio} />}
                </div>
              ) : (
                <p class={why}>{c.locked}</p>
              )}
            </div>
          </li>
        ))}
      </ol>
      <p class="sub">Earn a center's first star to open the next. More centers are on the way.</p>
    </>
  );
}

/** Every item, floor and wall karma can unlock, with a button to unlock the ones there is enough karma for. */
function Shop({ onBuy }: { onBuy: () => void }) {
  return (
    <>
      <p class="sub">
        Every star in the campaign earns 2 karma, and each achievement some more. What it unlocks stays unlocked in
        every center and in the sandbox.
      </p>
      <ul class={cx('shop', list)}>
        {shopCards(loadCampaign()).map((c) => (
          <li key={c.type} class={cx(shopCard, c.state === 'owned' && 'owned')}>
            <Icon id={c.icon} size={28} />
            <div>
              <b class={cardName}>{c.name}</b>
              <small class={small}>
                {c.star === undefined ? 'Only with karma' : `Or reach star ${c.star} in each center`}
              </small>
            </div>
            {c.state === 'owned' ? (
              <em class={price}>Unlocked</em>
            ) : (
              <button
                class={cx(goButton(), buy)}
                disabled={c.state === 'short'}
                onClick={() => {
                  buyWithKarma(c.type);
                  onBuy();
                }}
              >
                <IconText id="ui-karma">{karmaText(c.karma)}</IconText>
              </button>
            )}
          </li>
        ))}
      </ul>
      <h4 class={cx('shop-head', shopHead)}>Floors and walls</h4>
      <ul class={cx('shop', list)}>
        {decorCards(loadCampaign()).map((c) => (
          <li key={c.key} class={cx(shopCard, c.state === 'owned' && 'owned')}>
            <i class={swatch} style={{ background: c.swatch }} />
            <div>
              <b class={cardName}>{c.name}</b>
              <small class={small}>{`${c.part}, to decorate any room`}</small>
            </div>
            {c.state === 'owned' ? (
              <em class={price}>Unlocked</em>
            ) : (
              <button
                class={cx(goButton(), buy)}
                disabled={c.state === 'short'}
                onClick={() => {
                  buyDecorWithKarma(c.key);
                  onBuy();
                }}
              >
                <IconText id="ui-karma">{karmaText(c.karma)}</IconText>
              </button>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}

/** Every achievement, earned or not, with the karma it is worth. */
function Achievements() {
  return (
    <>
      <p class="sub">Each is earned once, in whichever campaign center you do it first.</p>
      <ul class={list}>
        {achievementCards(loadCampaign()).map((a) => (
          <li key={a.id} class={cx(featCard, a.done && 'done')}>
            <Icon id={a.done ? a.icon : 'ui-lock'} size={28} />
            <div>
              <b class={cardName}>{a.name}</b>
              <small class={small}>{a.desc}</small>
            </div>
            <em class={price}>{a.done ? '✓' : <IconText id="ui-karma">{karmaText(a.karma)}</IconText>}</em>
          </li>
        ))}
      </ul>
    </>
  );
}
