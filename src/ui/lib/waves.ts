// The words on the card for an ailment going around: a line for each part of getting ready for its treatment.

import { DISCIPLINES, ITEMS, MODALITIES, type Modality, ROOMS } from '../../core/data';
import { an } from '../../core/format';
import { atWork } from '../../core/sim/demand';
import { daysInWords } from '../../core/sim/mishaps';
import { trainedAway, type WaveChecks } from '../../core/sim/waves';
import type { GameState, Wave } from '../../core/state/types';
import { timeLeftLabel } from './emergency';

/** A part of getting ready, done or still to do, in words. */
export interface ReadyLine {
  ok: boolean;
  text: string;
}

/** How many on the staff are trained in a technique and at work, to share its line between them. */
export const trainedIn = (s: GameState, m: Modality): number =>
  s.staff.filter((st) => atWork(st) && st.quals.includes(m)).length;

/**
 * A line for each part of getting ready for a technique: its room, someone trained, its kit and a rest after, each as
 * done or as the thing still to do; then, once someone is trained, whether more than one shares its line.
 */
export function readyLines(s: GameState, m: Modality, checks: WaveChecks): ReadyLine[] {
  const def = MODALITIES[m];
  const room = ROOMS[DISCIPLINES[def.discipline].room].name;
  const lines: ReadyLine[] = [
    { ok: checks.room, text: checks.room ? `${room} open` : `Build ${an(room)}` },
    {
      ok: checks.qualified,
      text: checks.qualified
        ? `Someone trained in ${def.name}`
        : trainedAway(s, m)
          ? `Everyone trained in ${def.name} is away`
          : `Train someone in ${def.name}`,
    },
  ];
  if (def.equipment) {
    const kit = ITEMS[def.equipment].name;
    lines.push({ ok: checks.kit, text: checks.kit ? `${kit} beside a table` : `Put ${an(kit)} beside a table` });
  }
  if (def.rest)
    lines.push({
      ok: checks.rest,
      text: checks.rest ? 'Recovery Lounge for the rest after' : 'Build a Recovery Lounge for the rest after',
    });
  // once someone does it, whether the wave's guests share them with the discipline's own line
  const trained = trainedIn(s, m);
  if (checks.qualified)
    lines.push(
      trained > 1
        ? { ok: true, text: `${trained} practitioners trained in it share the line` }
        : { ok: false, text: 'Only one practitioner trained in it: the line will grow' },
    );
  return lines;
}

/**
 * The lines the card shows: every part still to do, or once each is done, the one line saying the center is ready, so
 * the card stays short in a narrow objectives panel for the month the wave goes around.
 */
export function shownLines(lines: readonly ReadyLine[]): ReadyLine[] {
  return lines.every((l) => l.ok) ? [{ ok: true, text: 'Ready to see them' }] : [...lines];
}

/**
 * How a wave stands, in a line: before its guests come, how soon and for how long; while they come, the time left, how
 * many are in now (`here`) and how they have fared.
 */
export function waveSummary(w: Wave, day: number, here: number): string {
  if (day < w.starts) return `In ${daysInWords(w.starts - day)} · for ${daysInWords(w.ends - w.starts)}`;
  const later = w.turned ? ` · ${w.turned} came back later` : '';
  return `${timeLeftLabel(w.ends - day)} · ${here} in now · ${w.healed} healed${later}`;
}
