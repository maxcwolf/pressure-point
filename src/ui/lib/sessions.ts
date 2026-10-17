// What the inspector says about a group session at the Singing Bowls.

import { SOUND_MATS } from '../../core/data';
import { rankName } from '../../core/sim/careers';

/** A line on how a session stands: how many mats are taken, and whether it is playing or waiting. */
export function sessionNote(lying: number, mats: number, playing: boolean): string {
  if (mats === 0) return 'No mats in the room: place some to play for';
  if (playing) return `Playing for ${lying} of ${mats} ${mats === 1 ? 'mat' : 'mats'}`;
  if (lying === 0) return `Mats free: ${mats} · waiting for guests`;
  return `${lying} of ${mats} mats taken · waiting a moment for more`;
}

/**
 * How many of a studio's mats its Sound Healer can play for at once, by their rank: any past that stand empty, until a
 * more senior healer plays for more.
 */
export function matsNote(mats: number, played: number, rank: number): string {
  const plays = `${rankName(rank)} Sound Healers play for up to ${played} mats`;
  if (mats <= played) return plays;
  const more = SOUND_MATS.some((n) => n > played) ? ': a more senior one plays for more' : '';
  return `⚠️ Only ${played} of ${mats} mats are used. ${plays}${more}`;
}
