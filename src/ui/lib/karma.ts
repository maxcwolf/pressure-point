// What the interface says about karma: locked items' prices, the karma shop and the achievements.

import { type CampaignProgress, cannotBuy, cannotBuyDecor } from '../../core/campaign';
import {
  ACHIEVEMENT_ORDER,
  type AchievementId,
  ACHIEVEMENTS,
  decorDef,
  type DecorKey,
  type ItemDef,
  ITEMS,
  type ItemType,
  KARMA_DECOR,
  KARMA_ITEMS,
} from '../../core/data';

/** Karma as the interface writes it. */
export function karmaText(n: number): string {
  return `✨ ${n} karma`;
}

/** The note on a locked item's card: the star that unlocks it, the karma that does, or both. */
export function lockLabel(def: ItemDef): string {
  if (def.unlock !== undefined && def.karma !== undefined) return `🔒 Star ${def.unlock}, or ${karmaText(def.karma)}`;
  if (def.karma !== undefined) return `🔒 ${karmaText(def.karma)}`;
  return `🔒 Unlocks at star ${def.unlock ?? 0}`;
}

/** One item in the karma shop. */
export interface ShopCard {
  type: ItemType;
  icon: string;
  name: string;
  karma: number;
  /** The star that unlocks it in each game anyway, if one does. */
  star: number | undefined;
  /** Already unlocked, affordable, or not yet. */
  state: 'owned' | 'buy' | 'short';
}

/** A card for every item karma can unlock, in menu order. */
export function shopCards(p: CampaignProgress): ShopCard[] {
  return KARMA_ITEMS.map((t) => {
    const def = ITEMS[t];
    const why = cannotBuy(p, t);
    return {
      type: t,
      icon: def.icon,
      name: def.name,
      karma: def.karma ?? 0,
      star: def.unlock,
      state: why === 'owned' ? 'owned' : why ? 'short' : 'buy',
    };
  });
}

/** One floor or wall in the karma shop. */
export interface DecorCard {
  key: DecorKey;
  name: string;
  /** "Floor" or "Walls". */
  part: string;
  swatch: string;
  karma: number;
  state: 'owned' | 'buy' | 'short';
}

/** A card for every floor and wall karma can unlock, floors first. */
export function decorCards(p: CampaignProgress): DecorCard[] {
  return KARMA_DECOR.map((key) => {
    const def = decorDef(key);
    const why = cannotBuyDecor(p, key);
    return {
      key,
      name: def.name,
      part: key.startsWith('floor:') ? 'Floor' : 'Walls',
      swatch: def.swatch,
      karma: def.karma ?? 0,
      state: why === 'owned' ? 'owned' : why ? 'short' : 'buy',
    };
  });
}

/** One achievement, and whether it has been earned. */
export interface AchievementCard {
  id: AchievementId;
  icon: string;
  name: string;
  desc: string;
  karma: number;
  done: boolean;
}

/** A card for every achievement, in order. */
export function achievementCards(p: CampaignProgress): AchievementCard[] {
  return ACHIEVEMENT_ORDER.map((id) => {
    const a = ACHIEVEMENTS[id];
    return { id, icon: a.icon, name: a.name, desc: a.desc, karma: a.karma, done: p.achieved.includes(id) };
  });
}
