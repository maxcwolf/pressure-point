// The messages on the right: how long each stays, repeats counted, a moment more once read, the pile past the first
// few, and the ones kept up to date. When their clock stands still is in the end-to-end tests, with the interface it belongs to.
import { describe, expect, it } from 'vitest';

import type { Toast } from '../../src/ui/hud';
import {
  ageMessages,
  FADE_MS,
  GRACE_MS,
  KEPT,
  messageLife,
  pileUp,
  refreshMessage,
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

describe('a message kept up to date', () => {
  const BAD = 'Payday in 5 days: $3,000 in wages against $500 in the bank.';
  const WORSE = 'Payday in 5 days: $3,000 in wages against $200 in the bank.';
  const GOOD = 'Payday in 5 days is covered now: $3,000 in wages against $4,000 in the bank.';

  /** The payday warning, up for 3 seconds, with another message posted after it. */
  function warned(): Toast[] {
    let list = withMessage([], { id: 1, text: BAD, kind: 'bad', icon: 'ui-warning', key: 'payday' });
    list = withMessage(list, { id: 2, text: SHORT, kind: 'info' });
    return run(list, 3000);
  }

  it('posted again takes the place of the one on screen, afresh rather than counted', () => {
    const list = withMessage(warned(), { id: 3, text: WORSE, kind: 'bad', icon: 'ui-warning', key: 'payday' });
    expect(list.map((t) => [t.id, t.text, t.count, t.age])).toEqual([
      [2, SHORT, 1, 3000],
      [3, WORSE, 1, 0],
    ]);
  });

  it('takes new words in place, keeping its time', () => {
    const { kept, changed } = refreshMessage(warned(), 'payday', { text: WORSE, kind: 'bad', icon: 'ui-warning' });
    expect(changed).toBe(true);
    expect(kept.map((t) => [t.id, t.text, t.age])).toEqual([
      [1, WORSE, 3000],
      [2, SHORT, 3000],
    ]);
  });

  it('turned to good news shows afresh, with its icon', () => {
    const list = warned();
    list[0]!.leaving = true;
    const { kept } = refreshMessage(list, 'payday', { text: GOOD, kind: 'good', icon: 'ui-money' });
    expect(kept[0]).toMatchObject({ id: 1, text: GOOD, kind: 'good', icon: 'ui-money', age: 0, leaving: false });
  });

  it('is left alone while it says the same, and taken down once it no longer applies', () => {
    const list = warned();
    expect(refreshMessage(list, 'payday', { text: BAD, kind: 'bad', icon: 'ui-warning' })).toEqual({
      kept: list,
      changed: false,
    });
    const { kept, changed } = refreshMessage(list, 'payday', null);
    expect(changed).toBe(true);
    expect(kept.map((t) => t.text)).toEqual([SHORT]);
  });

  it('once dismissed or faded is not brought back', () => {
    const list = warned().filter((t) => t.key !== 'payday');
    expect(refreshMessage(list, 'payday', { text: GOOD, kind: 'good', icon: 'ui-money' })).toEqual({
      kept: list,
      changed: false,
    });
  });
});
