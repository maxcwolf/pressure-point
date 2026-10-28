// A choice waiting on Max's word in round 11 of the symptom models (see
// docs/planning/fun/options/symptoms/approvals/), picked in the address on the dev server: `?phone=lap` has someone
// with text neck hold their phone small in the lap while they sit, where otherwise they put it away. Whichever is
// chosen is built in, and this goes.

/** The address, on the dev server only: anywhere else, as in the tests, the first choice. */
const asked = new URLSearchParams(import.meta.env.DEV && typeof location !== 'undefined' ? location.search : '');

/** What a sitting guest does with their giant phone. */
export const CHOICES: { phone: 'away' | 'lap' } = {
  phone: asked.get('phone') === 'lap' ? 'lap' : 'away',
};
