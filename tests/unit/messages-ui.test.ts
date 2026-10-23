// The messages on the right: how long each stays, repeats counted, a moment more once read, and the pile past the first
// few. When their clock stands still is in the end-to-end tests, with the interface it belongs to.
import { describe, expect, it } from 'vitest';

import type { Toast } from '../../src/ui/hud';
import {
  ageMessages,
  FADE_MS,
  GRACE_MS,
  KEPT,
  messageLife,
  pileUp,
  SHOWN,
  spareMessages,
  withMessage,
} from '../../src/ui/lib/messages';

const SHORT = 'Mira joins the team.';
const WILTING = 'Your plants are wilting.';

/** The messages with these said in turn, oldest first, numbered from 1. */
function said(...texts: string[]): Toast[] {
  return texts.reduce<Toast[]>((list, text, i) => withMessage(list, { id: i + 1, text, kind: 'info' }), []);
}

/** Run the messages' clock for `ms` milliseconds, a tenth of a second at a time as the frames would. */
function run(messages: Toast[], ms: number, time: 'normal' | 'long' | 'dismissed' = 'normal'): Toast[] {
  let list = messages;
  for (let left = ms; left > 0; left -= 100) list = ageMessages(list, Math.min(100, left), time).kept;
  return list;
}

describe('how long a message stays', () => {
  it('is longer for more words, longer still for bad news, twice as long set to Long, and for ever until dismissed', () => {
    const long = 'The massage table in the Deep Tissue Suite has broken down. A Mechanic will fix it.';
    expect(messageLife(long, 'info', 'normal')).toBeGreaterThan(messageLife(SHORT, 'info', 'normal'));
    expect(messageLife(SHORT, 'bad', 'normal')).toBeGreaterThan(messageLife(SHORT, 'info', 'normal'));
    expect(messageLife(SHORT, 'info', 'long')).toBe(2 * messageLife(SHORT, 'info', 'normal'));
    expect(messageLife(SHORT, 'good', 'dismissed')).toBe(Infinity);
  });

  it('gives even the shortest message longer than the six and a half seconds every message used to get', () => {
    expect(messageLife('Built!', 'good', 'normal')).toBeGreaterThan(6500);
  });
});

describe('a message on the right', () => {
  it('fades at the end of its time and then goes', () => {
    const life = messageLife(SHORT, 'info', 'normal');
    let list = run(said(SHORT), life - FADE_MS - 100);
    expect(list[0]?.leaving).toBe(false);
    const fading = ageMessages(list, 200, 'normal');
    expect(fading).toMatchObject({ changed: true, kept: [{ leaving: true }] });
    list = run(fading.kept, FADE_MS);
    expect(list).toEqual([]);
  });

  it('says nothing has changed while it is neither fading nor going', () => {
    expect(ageMessages(said(SHORT), 100, 'normal').changed).toBe(false);
  });

  it('stays until dismissed when set to, and fades once the setting is changed back', () => {
    const list = run(said(SHORT), 600_000, 'dismissed');
    expect(list).toHaveLength(1);
    expect(ageMessages(list, 100, 'normal').kept).toEqual([]);
  });

  it('comes back from fading with a moment more once read', () => {
    const life = messageLife(SHORT, 'info', 'normal');
    const list = run(said(SHORT), life - 200);
    expect(list[0]?.leaving).toBe(true);
    spareMessages(list, 'normal');
    expect(list[0]).toMatchObject({ leaving: false, age: life - GRACE_MS });
    expect(run(list, GRACE_MS - FADE_MS - 100)[0]?.leaving).toBe(false);
    expect(run(list, FADE_MS + 200)).toEqual([]);
  });

  it('keeps its time when it has plenty left', () => {
    const list = run(said(SHORT), 1000);
    spareMessages(list, 'normal');
    expect(list[0]?.age).toBe(1000);
  });

  it('said again while it is up moves to the top, counted, with its time started over', () => {
    let list = run(said(WILTING, SHORT), 3000);
    list = withMessage(list, { id: 3, text: WILTING, kind: 'info' });
    expect(list.map((t) => [t.text, t.count, t.age])).toEqual([
      [SHORT, 1, 3000],
      [WILTING, 2, 0],
    ]);
  });

  it('said again in another tone is a message of its own', () => {
    const list = withMessage(said(WILTING), { id: 2, text: WILTING, kind: 'bad' });
    expect(list.map((t) => t.count)).toEqual([1, 1]);
  });
});

describe('messages past the first few', () => {
  it('pile up under the newest, which show in full', () => {
    const { shown, piled } = pileUp(said('1', '2', '3', '4', '5', '6', '7'));
    expect(SHOWN).toBe(4);
    expect(shown.map((t) => t.text)).toEqual(['7', '6', '5', '4']);
    expect(piled.map((t) => t.text)).toEqual(['3', '2', '1']);
  });

  it('are kept up to a limit, letting the oldest go', () => {
    const list = said(...Array.from({ length: KEPT + 3 }, (_, i) => `Message ${i + 1}`));
    expect(list).toHaveLength(KEPT);
    expect(list[0]?.text).toBe('Message 4');
  });
});
