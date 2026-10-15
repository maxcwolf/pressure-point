// What a member of staff's inspector says about soul retrieval.

/** A note on someone's soul: a Shaman on the way, or none to send while they are burnt out; '' when there is nothing to say. */
export function soulNote(asked: boolean, burnt: boolean, shaman: boolean): string {
  if (asked) return '🪶 A Shaman is seeing to their soul';
  if (burnt && !shaman) return 'Burnt out: a Shaman could retrieve their soul';
  return '';
}
