// The More tab at the foot of a card that scrolls.

import './ScrollTab.css';

import { useContext } from 'preact/hooks';

import { HudContext } from '../../hooks/use-hud';

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
    <div class="scroll-foot">
      <button
        type="button"
        class="scroll-tab"
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
