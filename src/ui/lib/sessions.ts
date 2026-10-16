// What the inspector says about a group session at the Singing Bowls.

/** A line on how a session stands: how many mats are taken, and whether it is playing or waiting. */
export function sessionNote(lying: number, mats: number, playing: boolean): string {
  if (mats === 0) return 'No mats in the room: place some to play for';
  if (playing) return `Playing for ${lying} of ${mats} ${mats === 1 ? 'mat' : 'mats'}`;
  if (lying === 0) return `Mats free: ${mats} · waiting for guests`;
  return `${lying} of ${mats} mats taken · waiting a moment for more`;
}

/** A line on how strongly a Sound Bath Studio draws guests who need sound healing. */
export function drawNote(draw: number): string {
  if (draw < 1.05)
    return '🔔 A prestigious, peaceful studio with mats to spare draws more guests who need sound healing.';
  return `🔔 Draws ${draw.toFixed(1)}× the usual guests for sound healing, for its prestige, its peace and its mats.`;
}
