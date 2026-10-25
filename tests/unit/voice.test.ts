import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { VOICE_LINES, voiceFor } from '../../src/audio/voice';
import {
  ANNOUNCEMENTS,
  EMERGENCY_CAUSES,
  ITEMS,
  type ItemType,
  MISHAPS,
  VISIT_NEWS,
  VISIT_NOTICE_DAYS,
} from '../../src/core/data';
import { CARETAKER_WANTED, staffWanted } from '../../src/core/sim/advisor';
import { SWEAT_LODGE_OPEN } from '../../src/core/sim/ceremonies';
import { CLASS_LINES } from '../../src/core/sim/classes';
import { emergencyNews } from '../../src/core/sim/emergencies';
import { OPENING_LINES, openingLine } from '../../src/core/sim/progress';
import { RUNAWAY_LINES } from '../../src/core/sim/runaways';
import { SEASON_LINES } from '../../src/core/sim/twists';

/** Every line the speakers can say that does not change from game to game. */
function spokenLines(): string[] {
  const stations = (Object.keys(ITEMS) as ItemType[])
    .filter((t) => ITEMS[t].station)
    .map((type) => staffWanted({ type }));
  const mishaps = Object.values(MISHAPS).flatMap((m) => [m.warning, m.start, m.end]);
  const emergencies = EMERGENCY_CAUSES.map(emergencyNews);
  return [
    ...ANNOUNCEMENTS,
    ...Object.values(VISIT_NEWS),
    ...stations,
    CARETAKER_WANTED,
    ...mishaps,
    ...emergencies,
    SWEAT_LODGE_OPEN,
    ...CLASS_LINES,
    ...OPENING_LINES,
    ...RUNAWAY_LINES,
    ...Object.values(SEASON_LINES),
  ];
}

describe('the announcer', () => {
  it('opens the doors with each of the opening lines in turn, by the next id', () => {
    expect(OPENING_LINES.map((_, i) => openingLine(i))).toEqual(OPENING_LINES);
    expect(openingLine(OPENING_LINES.length)).toBe(OPENING_LINES[0]);
  });

  it('has a recording for lines that are really announced, word for word', () => {
    const lines = Object.keys(VOICE_LINES);
    expect(lines.length).toBeGreaterThan(0);
    for (const line of lines) expect(spokenLines(), line).toContain(line);
  });

  it('finds the recording for a line, and none for a line not recorded', () => {
    expect(voiceFor('A reminder that relaxation is mandatory.')).toMatch(/relaxation-is-mandatory.*\.m4a$/);
    expect(voiceFor('Please breathe in. Further instructions will follow.')).toMatch(/please-breathe-in.*\.m4a$/);
    expect(voiceFor('Guests are reminded that clothing is mandatory in the hallways.')).toMatch(
      /clothing-mandatory.*\.m4a$/,
    );
    expect(voiceFor(ANNOUNCEMENTS.find((l) => l.includes('urinal')) ?? '')).toMatch(/remove-pants-urinal.*\.m4a$/);
    expect(voiceFor('Summer is here, and so are the crowds.')).toBeUndefined();
    // a season plays its line, and leaves the numbers after it to the banner
    expect(voiceFor(`${SEASON_LINES.winter} Until then, about ×0.4 the usual guests.`)).toMatch(
      /winter-is-here.*\.m4a$/,
    );
    expect(voiceFor(RUNAWAY_LINES[0])).toMatch(/walls-not-melting.*\.m4a$/);
    expect(voiceFor(RUNAWAY_LINES[1]), 'not recorded yet').toBeUndefined();
    expect(voiceFor(SEASON_LINES.spring)).toMatch(/spring-sprung.*\.m4a$/);
    expect(
      voiceFor(`${SEASON_LINES.summer} Until autumn, about ×1.9 the usual guests.`),
      'not recorded yet',
    ).toBeUndefined();
    expect(voiceFor(`${SEASON_LINES.winter.slice(0, -1)}, more or less.`), 'not the line as recorded').toBeUndefined();
  });

  it('has recorded every one of the filler lines, or lists it in the to-do list to be recorded', () => {
    const todo = readFileSync(path.join(import.meta.dirname, '../../docs/planning/todo.md'), 'utf8');
    for (const line of ANNOUNCEMENTS) if (!voiceFor(line)) expect(todo, line).toContain(`- [ ] ${line}`);
    expect(ANNOUNCEMENTS.filter((line) => voiceFor(line)).length).toBeGreaterThan(ANNOUNCEMENTS.length / 2);
  });

  it('says when a station is short of someone, and when a visitor writes ahead', () => {
    expect(staffWanted({ type: 'reception_desk' })).toBe('Receptionist needed at the Reception Desk.');
    expect(staffWanted({ type: 'massage_table' })).toBe('Massage Therapist needed at the Massage Suite.');
    expect(staffWanted({ type: 'bench' }), 'not a station').toBe('');
    expect(voiceFor(MISHAPS.power.warning)).toMatch(/power-out-soon.*\.m4a$/);
    expect(voiceFor(MISHAPS.power.start)).toMatch(/power-out.*\.m4a$/);
    expect(voiceFor(MISHAPS.power.start)).not.toBe(voiceFor(MISHAPS.power.warning));
    expect(voiceFor(MISHAPS.storm.warning)).toMatch(/storm-incoming.*\.m4a$/);
    expect(voiceFor(MISHAPS.storm.start)).toMatch(/storm-started.*\.m4a$/);
    expect(voiceFor(MISHAPS.storm.end)).toMatch(/storm-ended.*\.m4a$/);
    expect(voiceFor(CARETAKER_WANTED)).toMatch(/caretaker-needed.*\.m4a$/);
    expect(voiceFor(SWEAT_LODGE_OPEN)).toMatch(/sweat-shop-open.*\.m4a$/);
    expect(voiceFor(staffWanted({ type: 'instructor_mat' }))).toMatch(/qi-gong-at-qi-gong.*\.m4a$/);
    expect(voiceFor(CLASS_LINES[0] ?? '')).toMatch(/qi-gong-starting.*\.m4a$/);
    expect(voiceFor(CLASS_LINES[1] ?? '')).toMatch(/qi-gong-starting-2.*\.m4a$/);
    expect(voiceFor(CLASS_LINES[0] ?? '')).not.toBe(voiceFor(CLASS_LINES[1] ?? ''));
    expect(voiceFor(ANNOUNCEMENTS.find((l) => l.includes('void')) ?? '')).toMatch(/screaming-into-void.*\.m4a$/);
    expect(voiceFor(ANNOUNCEMENTS.find((l) => l.includes('sighing')) ?? '')).toMatch(/sighing-not-breathwork.*\.m4a$/);
    OPENING_LINES.forEach((line, i) =>
      expect(voiceFor(line)).toMatch(new RegExp(`healing-center-open-${i + 1}.*\\.m4a$`)),
    );
    expect(voiceFor(ANNOUNCEMENTS.find((l) => l.includes('Mercury')) ?? '')).toMatch(
      /mercury-not-in-retrograde.*\.m4a$/,
    );
    expect(voiceFor(ANNOUNCEMENTS.find((l) => l.includes('seekers')) ?? '')).toMatch(/welcome-seekers.*\.m4a$/);
    expect(voiceFor(VISIT_NEWS.vip)).toMatch(/vip-visiting.*\.m4a$/);
    expect(voiceFor(VISIT_NEWS.inspector)).toMatch(/health-inspector.*\.m4a$/);
    expect(voiceFor(emergencyNews('The city fun run turned out to be an unfun run.'))).toMatch(
      /emergency-fun-run.*\.m4a$/,
    );
    expect(voiceFor(emergencyNews('A flash mob forgot to warm up.')), 'not recorded yet').toBeUndefined();
    // the VIP's line was recorded saying five days: a different notice needs a new recording
    expect(VISIT_NOTICE_DAYS).toBe(5);
  });
});
