import { describe, expect, it } from 'vitest';

import { addFloater, ageFloaters, amountOf, FLOAT_LIFE, type Floater, MERGE_FOR } from '../../src/ui/lib/floaters';

let next = 1;
/** A new floater saying this at a spot. */
const make = (text: string, x = 5, y = 5, kind: 'good' | 'bad' = 'good'): Floater => ({
  id: next++,
  text,
  kind,
  x,
  y,
  age: 0,
  amount: amountOf(text),
  row: 0,
});

describe('floating text', () => {
  it('reads the money it says', () => {
    expect(amountOf('+$1,200')).toBe(1200);
    expect(amountOf('-$40')).toBe(-40);
    expect(amountOf('Too pricey!')).toBeNull();
  });

  it('adds money earned close by to the floater just shown, rather than piling another on it', () => {
    let list = addFloater([], make('+$120'));
    list = addFloater(list, make('+$80', 5.4, 5.2));
    expect(list).toHaveLength(1);
    expect(list[0]!.text).toBe('+$200');
  });

  it('stacks other words close by in rows, and leaves money far off or long shown alone', () => {
    let list = addFloater([], make('+$120'));
    list = addFloater(list, make('Too pricey!', 5.2, 5, 'bad'));
    list = addFloater(list, make('+$60', 12, 12));
    expect(list.map((f) => f.row)).toEqual([0, 1, 0]);
    list = ageFloaters(list, MERGE_FOR + 0.1);
    list = addFloater(list, make('+$50'));
    expect(list).toHaveLength(4);
    expect(list[3]!.row).toBe(2);
  });

  it('goes once it has run its course', () => {
    expect(ageFloaters([make('+$5')], FLOAT_LIFE)).toEqual([]);
  });
});
