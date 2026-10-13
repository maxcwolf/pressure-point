// Star ratings.

import './Stars.css';

/** A row of stars, with the ones not earned shown faintly. */
export function StarRow({ earned, of }: { earned: number; of: number }) {
  return (
    <>
      {'★'.repeat(earned)}
      <s>{'★'.repeat(of - earned)}</s>
    </>
  );
}

/** A rating out of five, for skill and prestige. */
export function Stars({ count, of = 5 }: { count: number; of?: number }) {
  return (
    <span class="skill">
      <StarRow earned={count} of={of} />
    </span>
  );
}
