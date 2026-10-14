// What the title screen shows: the latest save's figures and the badges along the bottom.

import { type Discipline, DISCIPLINE_ORDER, DISCIPLINES } from '../../core/data';
import { money } from '../../core/format';
import { gameDate, type SaveInfo } from '../../storage/saves';

/** One line beside a save's picture: an icon and some text. */
export interface Fact {
  icon: string;
  text: string;
}

/** The headline figures of a save, for the card on the title screen. */
export function saveFacts(info: SaveInfo): Fact[] {
  return [
    { icon: '⭐', text: `${info.stars} ${info.stars === 1 ? 'star' : 'stars'}` },
    { icon: '💰', text: money(info.money) },
    { icon: '🙂', text: `${info.healed} healed` },
    { icon: '📅', text: gameDate(info.day) },
  ];
}

/** A round badge along the bottom of the title screen. */
export interface Badge {
  icon: string;
  label: string;
  on: boolean;
}

/** A badge for each discipline, lit when new games include it. */
export function titleBadges(on: (d: Discipline) => boolean): Badge[] {
  return DISCIPLINE_ORDER.map((d) => {
    const def = DISCIPLINES[d];
    const lit = !def.optional || on(d);
    return { icon: def.icon, label: `${def.name}: ${lit ? 'open for business' : 'switched off in Settings'}`, on: lit };
  });
}
