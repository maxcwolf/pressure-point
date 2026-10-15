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
