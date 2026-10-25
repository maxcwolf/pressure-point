// The Money menu's Marketing tab: a card for each kind of campaign, running or ready to buy.

import { useState } from 'preact/hooks';

import {
  CAMPAIGN_MONTHS_MAX,
  CAMPAIGN_ORDER,
  type CampaignKind,
  CAMPAIGNS,
  conditionHere,
  type ConditionId,
  conditionOf,
  CONDITIONS,
  MODALITIES,
} from '../../../core/data';
import { money } from '../../../core/format';
import { css } from '../../../styled-system/css';
import { buttonRow } from '../../../styled-system/recipes';
import { useGame } from '../../hooks/use-hud';
import { cx } from '../../lib/cx';
import { wholeDaysLeft } from '../../lib/emergency';
import { Button } from '../common/Button';
import { IconText } from '../common/Icon';
import { ledgerLook } from './looks';

/** The cards, as many to a line as fit. */
const campaigns = css({
  display: 'grid',
  gridTemplateColumns: '[repeat(auto-fit, minmax(220px, 1fr))]',
  gap: '[10px]',
});

/** A kind of campaign's card, in gold while one is running, with how long it has left. */
const campaign = css(ledgerLook, {
  '&.live': { borderColor: 'gold', bg: '[#fff6dc]' },
  '& .running': { fontWeight: 'bold', mt: 's' },
});

/**
 * The conditions to pick from for a campaign about one, as small buttons in a row, the one picked in gold. It keeps
 * to a wrapping row however the card lays out its other lines.
 */
const conditionChoices = css({
  display: '[flex !important]',
  flexWrap: 'wrap',
  justifyContent: '[flex-start !important]',
  gap: 'xs',
  m: '[6px 0]',
  '& button': {
    pointerEvents: 'auto',
    border: 'control',
    borderRadius: '[8px]',
    bg: 'cream',
    fontWeight: 'bold',
    fontSize: '[12px]',
    h: 'auto',
    p: '[1px 8px]',
    _hover: { transform: 'translateY(-1px)' },
    _on: { bg: 'gold', color: 'white' },
  },
});

/** One kind of campaign: what it does and costs, and either how long it has left or buttons to buy it. */
function CampaignCard({ kind }: { kind: CampaignKind }) {
  const { sim } = useGame();
  const s = sim.s;
  const def = CAMPAIGNS[kind];
  const [condition, setCondition] = useState<ConditionId | undefined>(undefined);
  const live = s.campaigns.find((c) => c.kind === kind);
  // the conditions guests here could turn up with, for a campaign about one
  const choices = CONDITIONS.filter(
    (c) => conditionHere(c, s.center) && sim.unlocked(c.modality) && sim.offered(MODALITIES[c.modality].discipline),
  );
  return (
    // `campaign` is for the end-to-end tests
    <div class={cx('campaign', campaign, live && 'live')}>
      <h4>
        <IconText id={def.icon}>{def.name}</IconText>
      </h4>
      <p class="sub">{`${def.desc} ${money(def.perMonth)} a month.`}</p>
      {live ? (
        <p class="running">
          {`Running${live.condition ? ` for ${conditionOf(live.condition).name}` : ''}: ${wholeDaysLeft(live.until - s.day)} days left`}
        </p>
      ) : (
        <>
          {kind === 'condition' && (
            <div class={conditionChoices}>
              {choices.map((c) => (
                <Button
                  key={c.id}
                  class={cx(condition === c.id && 'on')}
                  onPress={() => {
                    setCondition(c.id);
                  }}
                >
                  {c.name}
                </Button>
              ))}
            </div>
          )}
          <div class={buttonRow({ align: 'left' })}>
            {Array.from({ length: CAMPAIGN_MONTHS_MAX }, (_, i) => i + 1).map((months) => {
              const why = sim.campaignBlocker(kind, months, condition);
              return (
                <Button
                  key={months}
                  quiet
                  locked={!!why}
                  title={why || `Run it for ${months} month${months === 1 ? '' : 's'}`}
                  onPress={() => {
                    sim.startCampaign(kind, months, condition);
                  }}
                >
                  {`${months} mo · ${money(sim.campaignCost(kind, months))}`}
                </Button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

/** A card for each kind of campaign. */
export function MarketingTab() {
  return (
    <div class={campaigns}>
      {CAMPAIGN_ORDER.map((k) => (
        <CampaignCard key={k} kind={k} />
      ))}
    </div>
  );
}
