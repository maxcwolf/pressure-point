import { describe, expect, it } from 'vitest';

import { parseTip } from '../../src/ui/tooltip';

describe('laying out a tooltip from a title', () => {
  it('leaves a plain title as it is', () => {
    expect(parseTip('Bank balance')).toEqual({ heading: '', body: 'Bank balance', keys: [] });
  });

  it('makes a short name before a colon the heading', () => {
    expect(parseTip('Overlays: color the floor by how things stand')).toEqual({
      heading: 'Overlays',
      body: 'Color the floor by how things stand',
      keys: [],
    });
  });

  it('draws the keys at the end as keys', () => {
    expect(parseTip('Pause (Space)')).toEqual({ heading: '', body: 'Pause', keys: ['Space'] });
    expect(parseTip('Turn the camera (Q and E)')).toEqual({ heading: '', body: 'Turn the camera', keys: ['Q', 'E'] });
  });

  it('keeps words in brackets that are not keys', () => {
    expect(parseTip('Seen to between jobs (when they are free)').keys).toEqual([]);
  });

  it('keeps a colon after a full sentence in the words', () => {
    const text = 'It worsens while they wait. The worse it gets: the less likely it is to work.';
    expect(parseTip(text)).toEqual({ heading: '', body: text, keys: [] });
  });
});
