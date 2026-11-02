import { describe, expect, it } from 'vitest';

import type { Toast } from '../../src/ui/hud';
import { messageLife, withMessage, wordsOf } from '../../src/ui/lib/messages';
import { storyParts } from '../../src/ui/lib/paper';

describe('the paper’s story', () => {
  const links = [
    { text: 'Hamish Crickmore', kind: 'staff', id: 4 },
    { text: 'Massage Suite', kind: 'room', id: 9 },
  ] as const;
  const story = 'The Kneadmaster 9000 in the Massage Suite caught fire. Hamish Crickmore put it out.';

  it('makes each name a link, in the order they come', () => {
    const parts = storyParts(story, links, () => true);
    expect(parts.map((p) => p.text).join('')).toBe(story);
    expect(parts.filter((p) => p.link).map((p) => p.link?.id)).toEqual([9, 4]);
  });

  it('leaves a name as words once whoever it names has gone', () => {
    const parts = storyParts(story, links, (l) => l.kind === 'room');
    expect(parts.filter((p) => p.link).map((p) => p.text)).toEqual(['Massage Suite']);
    expect(storyParts(story, [], () => true)).toEqual([{ text: story }]);
  });
});

describe('the paper’s message', () => {
  const headline = { name: 'The Willow Lane Leaflet', issue: 7, lead: 'FIRE BRIGADE ARRIVES', also: 'Also this.' };

  it('stays long enough to read its headlines too', () => {
    const plain = { text: 'Payday: $4,210 in salaries.' };
    expect(wordsOf({ ...plain, headline })).toContain('FIRE BRIGADE ARRIVES');
    expect(messageLife(wordsOf({ ...plain, headline }), 'info', 'normal')).toBeGreaterThan(
      messageLife(wordsOf(plain), 'info', 'normal'),
    );
  });

  it('is each quarter’s own, never counted in with a payday that says the same', () => {
    const payday = { id: 1, text: 'Payday: $4,210 in salaries.', kind: 'info' as const };
    const shown: Toast[] = withMessage([], payday);
    const both = withMessage(shown, { ...payday, id: 2, headline });
    expect(both).toHaveLength(2);
    expect(both.map((t) => t.count)).toEqual([1, 1]);
  });
});
