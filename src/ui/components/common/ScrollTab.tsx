// The More tab at the foot of a card that scrolls.

import { useContext } from 'preact/hooks';

import { css } from '../../../styled-system/css';
import { HudContext } from '../../hooks/use-hud';

// The tab sits on the card's bottom edge, over the fade ui/scroll-cue.ts draws, and takes no room.

/** The foot of the card, stuck to its bottom edge as it scrolls, with no height of its own. */
const foot = css({
  position: 'sticky',
  bottom: '[calc(-1 * var(--cue-pb, 12px))]',
  h: '[0]',
  flex: 'none',
  zIndex: '[4]',
  pointerEvents: 'none',
});

/** The tab: a cream pill with a chevron, shown and nodding while the card has more below. */
const tab = css({
  position: 'absolute',
  bottom: '[calc(var(--cue-pb, 12px) + 4px)]',
  left: '[50%]',
  translate: '[-50% 0]',
  w: '[46px]',
  h: '[22px]',
  p: '0',
  border: 'outline',
  borderRadius: 'pill',
  background:
    "[{colors.control} url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 10'%3E%3Cpath d='M2 2l6 6 6-6' fill='none' stroke='%2324384a' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\") center / 15px 10px no-repeat]",
  boxShadow: 'low',
  cursor: 'pointer',
  opacity: '[0]',
  pointerEvents: 'none',
  transition: '[opacity 0.15s]',
  // it nods, so the eye finds it
  animation: 'tab-nod 1.4s ease-in-out infinite',
  "[data-more~='below'] > .scroll-foot > &": { opacity: '[1]', pointerEvents: 'auto' },
  _hover: { bgColor: 'bg.card' },
  _active: { translate: '[-50% 2px]', boxShadow: 'flat', animation: 'none' },
  _motionReduce: { animation: 'none' },
});

/** How much of what a card shows one press of its tab scrolls past. */
const PAGE = 0.8;

/**
 * The tab at the foot of a scrolling card, there while the card holds more below what it shows (see scroll-cue.ts, which
 * marks the card), scrolling the card on a press. Put last inside the card. Outside the HUD, as on the title screen, it
 * clicks with no sound.
 */
export function ScrollTab() {
  const hud = useContext(HudContext);
  return (
    <div class={`scroll-foot ${foot}`}>
      <button
        type="button"
        class={tab}
        tabIndex={-1}
        title="More below"
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          e.preventDefault();
          hud?.host.audio.play('blip');
          const card = e.currentTarget.closest('[data-more]');
          card?.scrollBy({ top: card.clientHeight * PAGE, behavior: 'smooth' });
        }}
      />
    </div>
  );
}
