// What the Treatments menu says about a psychedelic ceremony.

/** A note for a ceremony that depends on its room's set and setting, or null for any other treatment. */
export function tripNote(trip: boolean | undefined): string | null {
  return trip ? '🌀 Set and setting: needs a calm, clean, beautiful lodge' : null;
}

/** What a room's inspector says of a Shaman's blessing on it, while it lasts, or '' when it has none. */
export function blessingNote(until: number | undefined, day: number): string {
  if (!until || day >= until) return '';
  const left = Math.ceil(until - day);
  return `✨ Blessed by a Shaman: treatments here work a little more often, for ${left} more ${left === 1 ? 'day' : 'days'}`;
}

/** What the Shop Counter's switch for magic mushrooms says, on or off. */
export const mushroomSwitch = (on: boolean) => `🍄 Mushrooms under the counter: ${on ? 'on sale' : 'put away'}`;

/** What the Shop Counter says about the mushrooms: put away until the inspector has been, or the risk of selling them. */
export function mushroomNote(on: boolean, stashed: boolean): string {
  if (stashed) return 'Put away until the health inspector has been, then back out again.';
  return on
    ? 'Some sales come with a bag from under the counter. If the health inspector finds them, it is a big fine.'
    : 'A Shaman can supply magic mushrooms to sell on the quiet, for much bigger sales.';
}
