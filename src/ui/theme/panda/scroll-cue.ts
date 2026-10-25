// Scroll cues: a card that holds more than it shows wears a scrollbar in the game's colors, a shadow along the top once
// it has scrolled, and a fade along the bottom, under the More tab of ScrollTab.tsx. ui/scroll-cue.ts marks such a card
// with data-more, whichever card it is, so these go by that mark.
import { defineGlobalStyles } from '@pandacss/dev';

/** The navy of a scrollbar's thumb, and of it under the pointer. */
const THUMB = '{colors.ink.50}';

export const scrollCueCss = defineGlobalStyles({
  '[data-more]': {
    // the color the content fades into: the card's own
    '--cue-bg': '{colors.cream}',
    '--cue-h': '30px',
    // the card's padding, which the fades reach over: a sticky edge stops short of it otherwise
    '--cue-pt': '12px',
    '--cue-px': '14px',
    '--cue-pb': '12px',
    // the fades reach over that padding, which would otherwise count as room to scroll sideways into
    overflowX: 'hidden',
  },
  '.dialog[data-more]': { '--cue-pt': '22px', '--cue-px': '26px', '--cue-pb': '24px' },
  '.title-panel[data-more]': {
    '--cue-bg': '#2c3a4e',
    '--cue-pt': 'calc(var(--logo-h) * 0.28)',
    '--cue-px': 'clamp(14px, 3vh, 26px)',
    '--cue-pb': 'clamp(10px, 2.2vh, 22px)',
  },
  '.save-list[data-more]': { '--cue-pt': '0px', '--cue-px': '0px', '--cue-pb': '0px' },

  // a scrollbar that is always there while there is anything to scroll: a sand channel with a navy thumb
  '[data-more]::-webkit-scrollbar': { width: '11px' },
  '[data-more]::-webkit-scrollbar-track': {
    background: 'sand',
    border: '3px solid transparent',
    borderRadius: '6px',
    backgroundClip: 'padding-box',
  },
  '[data-more]::-webkit-scrollbar-thumb': {
    background: THUMB,
    border: '3px solid transparent',
    borderRadius: '6px',
    backgroundClip: 'padding-box',
  },
  '[data-more]::-webkit-scrollbar-thumb:hover': { background: '{colors.ink.80}', backgroundClip: 'padding-box' },
  '@supports not selector(::-webkit-scrollbar)': {
    '[data-more]': { scrollbarWidth: 'thin', scrollbarColor: `${THUMB} {colors.sand}` },
  },

  // the fades ride the edges of the view as the card scrolls, over its content, taking no room of their own
  '[data-more]::before, [data-more]::after': {
    content: "''",
    display: 'block',
    position: 'sticky',
    flex: 'none',
    marginLeft: 'calc(-1 * var(--cue-px))',
    width: 'calc(100% + 2 * var(--cue-px))',
    pointerEvents: 'none',
    opacity: '0',
    transition: 'opacity 0.15s',
    zIndex: '3',
  },
  '[data-more]::before': {
    top: 'calc(-1 * var(--cue-pt))',
    height: 'calc(var(--cue-h) + var(--cue-pt))',
    marginBottom: 'calc(-1 * (var(--cue-h) + var(--cue-pt)))',
    background: 'linear-gradient({colors.ink.16} var(--cue-pt), rgba(36, 56, 74, 0))',
  },
  '[data-more]::after': {
    bottom: 'calc(-1 * var(--cue-pb))',
    height: 'calc(var(--cue-h) + var(--cue-pb))',
    marginTop: 'calc(-1 * (var(--cue-h) + var(--cue-pb)))',
    background:
      'linear-gradient(to top, var(--cue-bg) var(--cue-pb), color-mix(in srgb, var(--cue-bg) 85%, transparent) calc(var(--cue-pb) + 10px), transparent)',
  },
  "[data-more~='above']::before, [data-more~='below']::after": { opacity: '1' },
});
