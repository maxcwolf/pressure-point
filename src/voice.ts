// The announcer's recorded lines, each matched to the text it says on the announcement banner.

import chakrasAligned from './sounds/announcer/chakras-aligned.m4a';
import faceShapedMarks from './sounds/announcer/face-shaped-marks.m4a';
import humAlong from './sounds/announcer/hum-along.m4a';
import knotsNotContagious from './sounds/announcer/knots-not-contagious.m4a';
import lostAndFound from './sounds/announcer/lost-and-found.m4a';
import relaxationIsMandatory from './sounds/announcer/relaxation-is-mandatory.m4a';
import whaleSong from './sounds/announcer/whale-song.m4a';

/** Each recorded announcement, by the exact text shown with it. */
export const VOICE_LINES: Readonly<Record<string, string>> = {
  'Guests are reminded that the knots are not contagious.': knotsNotContagious,
  'Staff members are reminded that whale song is not a valid doctor’s note.': whaleSong,
  'Guests are asked not to hum along with the fountain.': humAlong,
  'Please keep your chakras aligned and your belongings with you.': chakrasAligned,
  'Guests leaving face-shaped marks on the towels will be charged.': faceShapedMarks,
  'A reminder that relaxation is mandatory.': relaxationIsMandatory,
  'The lost and found now holds one flip-flop and a sense of urgency.': lostAndFound,
};

/** The recording of an announcement, if the announcer has recorded it. */
export function voiceFor(text: string): string | undefined {
  return VOICE_LINES[text];
}
