// Finding an entry by id: the same answer a search of the list gives, however the list has changed since.
import { describe, expect, it } from 'vitest';

import { byId } from '../../src/core/lookup';

/** A list of entries with these ids. */
const list = (...ids: number[]) => ids.map((id) => ({ id, name: `#${id}` }));

describe('finding an entry by id', () => {
  it('finds an entry, and nothing for an id that is not there', () => {
    const l = list(4, 7, 9);
    expect(byId(l, 7)?.name).toBe('#7');
    expect(byId(l, 5)).toBeUndefined();
  });

  it('keeps finding entries as the list changes in place', () => {
    const l = list(1, 2, 3);
    expect(byId(l, 3)?.name).toBe('#3');
    // one taken out from the front, so everything after it moves up
    l.splice(0, 1);
    expect(byId(l, 3)?.name).toBe('#3');
    expect(byId(l, 1)).toBeUndefined();
    // one added, and one replaced where it stood
    l.push({ id: 8, name: '#8' });
    l[0] = { id: 2, name: 'new #2' };
    expect(byId(l, 8)?.name).toBe('#8');
    expect(byId(l, 2)?.name).toBe('new #2');
  });

  it('finds what a search would in a list made afresh', () => {
    const l = list(1, 2, 3);
    byId(l, 2);
    const kept = l.filter((e) => e.id !== 1);
    expect(byId(kept, 2)?.name).toBe('#2');
  });

  it('finds the first of two entries with the same id, as a search does', () => {
    const l = [...list(5), { id: 5, name: 'second' }];
    expect(byId(l, 5)?.name).toBe('#5');
  });
});
