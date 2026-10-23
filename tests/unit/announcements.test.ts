import { describe, expect, it } from 'vitest';

import { Announcer, MIN_SHOW, SHOW_FOR } from '../../src/ui/lib/announcements';

describe('the announcement banner', () => {
  it('lets no joke cut short a line about something happening', () => {
    const banner = new Announcer();
    banner.offer('Emergency incoming!', false, 0);
    expect(banner.offer('Please do not tip the therapists.', true, 1)).toBeNull();
    expect(banner.tick(SHOW_FOR - 0.1).changed).toBe(false);
    expect(banner.shown?.text).toBe('Emergency incoming!');
  });

  it('keeps a line up a while before the next one in line takes its place', () => {
    const banner = new Announcer();
    const first = banner.offer('Emergency incoming!', false, 0);
    expect(banner.offer('The inspectors are here.', false, 0.6)).toBeNull();
    expect(banner.tick(MIN_SHOW - 0.1).next).toBeNull();
    const { next } = banner.tick(MIN_SHOW);
    expect(next?.text).toBe('The inspectors are here.');
    // each line is its own, so it comes in afresh
    expect(next?.id).not.toBe(first?.id);
  });

  it('takes the banner down once a line has been read', () => {
    const banner = new Announcer();
    banner.offer('Testing the speakers.', true, 0);
    expect(banner.tick(SHOW_FOR).changed).toBe(true);
    expect(banner.shown).toBeNull();
  });
});
