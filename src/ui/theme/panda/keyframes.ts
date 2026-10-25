// Every animation the interface plays, by the name an `animation` gives it.
import { defineKeyframes } from '@pandacss/dev';

export const keyframes = defineKeyframes({
  // a panel or a dialog arriving
  pop: { from: { transform: 'scale(0.94) translateY(8px)', opacity: 0 } },
  // the way out of a panel or a dialog: pop played backwards
  unpop: { to: { transform: 'scale(0.94) translateY(8px)', opacity: 0 } },
  fadeout: { to: { opacity: 0 } },
  slide: { from: { transform: 'translateX(30px)', opacity: 0 } },
  drop: { from: { transform: 'translateY(-20px)', opacity: 0 } },
  fadein: { from: { opacity: 0 } },
  // the tutorial's ring breathing out round what its step wants
  guide: { '50%': { outlineOffset: '7px', outlineColor: 'rgba(242, 193, 78, 0.55)' } },
  // the title screen's update button while it fetches
  'update-spin': { to: { rotate: '360deg' } },
  // a tool hint shaking off a refused click
  'hint-refused': { '30%': { transform: 'scale(1.12)' } },
  'hint-refused-flash': { '30%': { background: '#fbe3e1' } },
  // a scroll tab nodding at more below
  'tab-nod': { '0%, 100%': { translate: '-50% 0' }, '50%': { translate: '-50% 3px' } },
  // a tooltip arriving, above or below what it is on
  'tip-in': { from: { opacity: 0, translate: '0 4px' } },
  'tip-in-below': { from: { opacity: 0, translate: '0 -4px' } },
});
