// The campaign on the title screen: the trail of centers, the karma shop, and the achievements that earn karma.

import './CampaignPanel.css';

import { useState } from 'preact/hooks';

import { karmaLeft } from '../../core/campaign';
import { buyDecorWithKarma, buyWithKarma, loadCampaign } from '../../storage/campaign';
import { useRedraw } from '../hooks/use-redraw';
import { campaignCards } from '../lib/campaign';
import { cx } from '../lib/cx';
import { achievementCards, decorCards, karmaText, shopCards } from '../lib/karma';
import { Icon, IconText } from './common/Icon';
import { StarRow } from './common/Stars';

export interface CampaignPanelProps {
  /** Start a new game in a center. */
  onStart: (center: string) => void;
}

type Tab = 'centers' | 'shop' | 'achievements';

const TABS: readonly { id: Tab; label: string }[] = [
  { id: 'centers', label: 'Centers' },
  { id: 'shop', label: 'Karma shop' },
  { id: 'achievements', label: 'Achievements' },
];

/** The campaign's tabs, under the karma there is to spend. */
export function CampaignPanel({ onStart }: CampaignPanelProps) {
  const [tab, setTab] = useState<Tab>('centers');
  const redraw = useRedraw();
  const progress = loadCampaign();
  return (
    <div class="campaign">
      <p class="karma">
        <IconText id="ui-karma">{karmaText(karmaLeft(progress))}</IconText>
      </p>
      <div class="tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            class={cx('tab', tab === t.id && 'on')}
            aria-selected={tab === t.id ? 'true' : 'false'}
            onClick={() => {
              setTab(t.id);
            }}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'centers' && <Centers onStart={onStart} />}
      {tab === 'shop' && <Shop onBuy={redraw} />}
      {tab === 'achievements' && <Achievements />}
    </div>
  );
}

/** A card per campaign center, joined by a trail, with Play on the ones that are open. */
function Centers({ onStart }: CampaignPanelProps) {
  const cards = campaignCards(loadCampaign().stars);
  return (
    <>
      <ol class="trail">
        {cards.map((c, i) => (
          <li key={c.id} class={cx('stop', !c.open && 'locked')}>
            <span class="pin">{c.open ? i + 1 : <Icon id="ui-lock" size={22} />}</span>
            <div class="about">
              <b>{c.name}</b>
              <span class="stars">
                <StarRow earned={c.earned} of={c.of} />
              </span>
              <small>{c.place}</small>
              <p>{c.blurb}</p>
              <p class="opening">{c.opening}</p>
              {c.open ? (
                <button
                  class="go"
                  onClick={() => {
                    onStart(`new:${c.id}`);
                  }}
                >
                  {c.earned ? `Play ${c.name} again` : `Play ${c.name}`}
                </button>
              ) : (
                <p class="why">{c.locked}</p>
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
      <ul class="shop">
        {shopCards(loadCampaign()).map((c) => (
          <li key={c.type} class={cx(c.state === 'owned' && 'owned')}>
            <Icon id={c.icon} size={28} />
            <div>
              <b>{c.name}</b>
              <small>{c.star === undefined ? 'Only with karma' : `Or reach star ${c.star} in each center`}</small>
            </div>
            {c.state === 'owned' ? (
              <em>Unlocked</em>
            ) : (
              <button
                class="go"
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
      <h4 class="shop-head">Floors and walls</h4>
      <ul class="shop">
        {decorCards(loadCampaign()).map((c) => (
          <li key={c.key} class={cx(c.state === 'owned' && 'owned')}>
            <i class="swatch" style={{ background: c.swatch }} />
            <div>
              <b>{c.name}</b>
              <small>{`${c.part}, to decorate any room`}</small>
            </div>
            {c.state === 'owned' ? (
              <em>Unlocked</em>
            ) : (
              <button
                class="go"
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
      <ul class="feats">
        {achievementCards(loadCampaign()).map((a) => (
          <li key={a.id} class={cx(a.done && 'done')}>
            <Icon id={a.done ? a.icon : 'ui-lock'} size={28} />
            <div>
              <b>{a.name}</b>
              <small>{a.desc}</small>
            </div>
            <em>{a.done ? '✓' : <IconText id="ui-karma">{karmaText(a.karma)}</IconText>}</em>
          </li>
        ))}
      </ul>
    </>
  );
}
