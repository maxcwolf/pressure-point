// Marketing: campaigns bought for a month or more, for word of mouth, for more guests with one condition, or for
// applicants.

import {
  CAMPAIGN_MONTHS_MAX,
  type CampaignKind,
  CAMPAIGNS,
  type ConditionId,
  conditionOf,
  DAY_SECONDS,
  DAYS_PER_MONTH,
  WORD_REP_PER_DAY,
} from '../data';
import { money } from '../format';
import type { GameState } from '../state/types';
import type { SimContext } from './context';
import { changeRep, spend } from './economy';
import { emit, toast } from './events';

/** The campaign of a kind that is running, if one is. */
export const running = (s: GameState, kind: CampaignKind) => s.campaigns.find((c) => c.kind === kind);

/** What a campaign costs for so many months. */
export const campaignCost = (kind: CampaignKind, months: number) => CAMPAIGNS[kind].perMonth * months;

/** Why a campaign cannot start ('' when it can). */
export function campaignBlocker(s: GameState, kind: CampaignKind, months: number, condition?: ConditionId): string {
  if (running(s, kind)) return 'One is running already.';
  if (!Number.isInteger(months) || months < 1 || months > CAMPAIGN_MONTHS_MAX)
    return `A campaign runs for one to ${CAMPAIGN_MONTHS_MAX} months.`;
  if (kind === 'condition' && !condition) return 'Choose a condition first.';
  if (s.money < campaignCost(kind, months)) return 'Not enough money.';
  return '';
}

/** Pay for a campaign and start it. False if it cannot start. */
export function startCampaign(ctx: SimContext, kind: CampaignKind, months: number, condition?: ConditionId): boolean {
  const s = ctx.s;
  if (campaignBlocker(s, kind, months, condition)) {
    emit(ctx, { type: 'sfx', name: 'error' });
    return false;
  }
  spend(ctx, campaignCost(kind, months), 'marketing');
  s.campaigns.push({
    kind,
    ...(kind === 'condition' && condition && { condition }),
    until: s.day + months * DAYS_PER_MONTH,
  });
  const what =
    kind === 'condition' && condition
      ? `${CAMPAIGNS[kind].name}: ${conditionOf(condition).name}`
      : CAMPAIGNS[kind].name;
  toast(
    ctx,
    `${CAMPAIGNS[kind].icon} ${what} is running for ${months} month${months === 1 ? '' : 's'} (${money(campaignCost(kind, months))}).`,
    'good',
  );
  emit(ctx, { type: 'sfx', name: 'cash' });
  return true;
}

/** How much more often a condition turns up, with a campaign for it running. */
export function campaignBoost(s: GameState, condition: ConditionId, boost: number): number {
  return s.campaigns.some((c) => c.kind === 'condition' && c.condition === condition) ? boost : 1;
}

/** Once a second of play: word of mouth does its work, and campaigns whose time is up end. */
export function updateCampaigns(ctx: SimContext) {
  const s = ctx.s;
  if (running(s, 'word')) changeRep(ctx, WORD_REP_PER_DAY / DAY_SECONDS);
  const ended = s.campaigns.filter((c) => s.day >= c.until);
  if (!ended.length) return;
  s.campaigns = s.campaigns.filter((c) => s.day < c.until);
  for (const c of ended) toast(ctx, `${CAMPAIGNS[c.kind].icon} ${CAMPAIGNS[c.kind].name} has finished.`, 'info');
}
