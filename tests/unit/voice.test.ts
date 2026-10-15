import { describe, expect, it } from 'vitest';

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
import { emergencyNews } from '../../src/core/sim/emergencies';
import { VOICE_LINES, voiceFor } from '../../src/voice';

/** Every line the speakers can say that does not change from game to game. */
function spokenLines(): string[] {
  const stations = (Object.keys(ITEMS) as ItemType[])
    .filter((t) => ITEMS[t].station)
    .map((type) => staffWanted({ type }));
  const mishaps = Object.values(MISHAPS).flatMap((m) => [m.warning, m.start, m.end]);
  const emergencies = EMERGENCY_CAUSES.map(emergencyNews);
  return [...ANNOUNCEMENTS, ...Object.values(VISIT_NEWS), ...stations, CARETAKER_WANTED, ...mishaps, ...emergencies];
}

describe('the announcer', () => {
  it('has a recording for lines that are really announced, word for word', () => {
    const lines = Object.keys(VOICE_LINES);
    expect(lines.length).toBeGreaterThan(0);
    for (const line of lines) expect(spokenLines(), line).toContain(line);
  });

  it('finds the recording for a line, and none for a line not recorded', () => {
    expect(voiceFor('A reminder that relaxation is mandatory.')).toMatch(/relaxation-is-mandatory.*\.m4a$/);
    expect(voiceFor('Please breathe in. Further instructions will follow.')).toMatch(/please-breathe-in.*\.m4a$/);
    expect(voiceFor('Summer is here, and so are the crowds.')).toBeUndefined();
  });

  it('has recorded every one of the filler lines', () => {
    for (const line of ANNOUNCEMENTS) expect(voiceFor(line), line).toBeDefined();
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
