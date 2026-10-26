// Page-wide basics: the layers of the page, the resets every element starts from, and the shared text styles. Panda
// puts these in its base layer, under every recipe and style prop.
import { defineGlobalStyles } from '@pandacss/dev';

export const globalCss = defineGlobalStyles({
  ':root': {
    // the height of the bar along the bottom, which Hud.tsx sets from the bar itself once it is drawn
    '--bar-h': '104px',
    // how big the in-game interface is drawn, from the settings (ui/display.ts), and the window's size in the pixels it
    // is drawn in: the window's own outside the interface, and divided by the size within it (see #ui below)
    '--ui-scale': '1',
    '--vw': '100vw',
    '--vh': '100vh',
    '@media (max-width: 1100px)': { '--bar-h': '164px' },
  },
  '*': { boxSizing: 'border-box' },
  'html, body': {
    margin: '0',
    height: '100%',
    overflow: 'hidden',
    background: '{colors.bg.canvas}',
    fontFamily: 'body',
    color: 'fg',
    userSelect: 'none',
    WebkitUserSelect: 'none',
  },
  '#game': { position: 'fixed', inset: '0', display: 'block', touchAction: 'none' },
  '#ui, #floaters': { position: 'fixed', inset: '0', pointerEvents: 'none' },
  '#ui > *': { position: 'absolute' },
  // the in-game interface drawn at the size chosen in the settings; a length in it that reads the window's size uses
  // var(--vw) and var(--vh), which are the window's size in the interface's own pixels
  '#ui': {
    zoom: 'var(--ui-scale)',
    '--vw': 'calc(100vw / var(--ui-scale))',
    '--vh': 'calc(100vh / var(--ui-scale))',
  },
  button: { font: 'inherit', color: 'inherit', cursor: 'pointer' },
  'h2, h3, h4, p, ul': { margin: '0' },
  s: { textDecoration: 'none', opacity: 'dim' },
  // smaller, fainter words under a heading or a setting
  '.sub': { fontSize: '13', opacity: 'muted', marginTop: '6' },
  // money or a change that is good news, and one that is bad
  '.pos': { color: 'good.strong' },
  '.neg': { color: 'bad.solid' },
  // a short highlighted amount: enough, or short
  'em.ok': { background: '{colors.good.bg} !important', color: 'good' },
  'em.warn': { background: '{colors.bad.bg} !important', color: 'bad' },
});
