import { describe, expect, it } from 'vitest';

import { ANNOUNCEMENTS } from '../../src/core/data';
import { VOICE_LINES, voiceFor } from '../../src/voice';

describe('the announcer', () => {
  it('has a recording for lines that are really announced, word for word', () => {
    const lines = Object.keys(VOICE_LINES);
    expect(lines.length).toBeGreaterThan(0);
    for (const line of lines) expect(ANNOUNCEMENTS, line).toContain(line);
  });

  it('finds the recording for a line, and none for a line not recorded', () => {
    expect(voiceFor('A reminder that relaxation is mandatory.')).toMatch(/relaxation-is-mandatory.*\.m4a$/);
    expect(voiceFor('Please breathe in. Further instructions will follow.')).toMatch(/please-breathe-in.*\.m4a$/);
    expect(voiceFor('Summer is here, and so are the crowds.')).toBeUndefined();
  });

  it('has recorded every one of the filler lines', () => {
    for (const line of ANNOUNCEMENTS) expect(voiceFor(line), line).toBeDefined();
  });
});
