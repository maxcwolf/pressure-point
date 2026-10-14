// The campaign trail on the title screen: each center in turn, its stars, and a way in once it is open.

import './CampaignPanel.css';

import { loadCampaign } from '../../storage/campaign';
import { campaignCards } from '../lib/campaign';
import { cx } from '../lib/cx';
import { StarRow } from './common/Stars';

export interface CampaignPanelProps {
  /** Start a new game in a center. */
  onStart: (center: string) => void;
}

/** A card per campaign center, joined by a trail, with Play on the ones that are open. */
export function CampaignPanel({ onStart }: CampaignPanelProps) {
  const cards = campaignCards(loadCampaign());
  return (
    <div class="campaign">
      <h3>Campaign</h3>
      <ol class="trail">
        {cards.map((c, i) => (
          <li key={c.id} class={cx('stop', !c.open && 'locked')}>
            <span class="pin">{c.open ? i + 1 : '🔒'}</span>
            <div class="about">
              <b>{c.name}</b>
              <span class="stars">
                <StarRow earned={c.earned} of={c.of} />
              </span>
              <small>{c.place}</small>
              <p>{c.blurb}</p>
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
    </div>
  );
}
