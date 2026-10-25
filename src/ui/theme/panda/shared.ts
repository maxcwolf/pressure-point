// The looks shared across the interface, by the class names the components already give them: the panel everything
// sits on, round buttons, rows of buttons, the go and danger colors, and the file, guide and switch controls. Kept as
// global classes, with their selectors as they were, so every screen draws as it did; recipes with variants come later.
import { defineGlobalStyles } from '@pandacss/dev';

/** The flat drop under a smaller button, nearer the page than a panel's. */
const LOW_SHADOW = '0 3px 0 rgba(36, 56, 74, 0.3)';

export const sharedCss = defineGlobalStyles({
  // the cream card a menu, a dialog or a panel is drawn on
  '.panel': {
    pointerEvents: 'auto',
    background: 'cream',
    border: '3px solid {colors.navy}',
    borderRadius: '18px',
    boxShadow: 'raised',
    padding: '12px 14px',
  },
  '.panel h3': { fontSize: '17px', fontWeight: '600', marginBottom: '6px' },

  // tabs, such as the Hire menu's roles and the Items menu's filters, the campaign's, the sandbox's starting money, the
  // difficulty presets and a thermostat's settings
  '.tabs': { display: 'flex', gap: '6px', flexWrap: 'wrap' },
  '.tab': {
    border: '2.5px solid {colors.navy}',
    background: 'white',
    borderRadius: '11px',
    padding: '4px 11px',
    fontSize: '13.5px',
    fontWeight: '500',
  },
  '.tab.on': { background: 'teal', color: 'white' },
  '.tab.small': { fontSize: '12.5px', padding: '3px 10px', borderWidth: '2px' },

  // round buttons, such as the bar's menus and tools
  '.round': {
    pointerEvents: 'auto',
    width: '76px',
    height: '76px',
    borderRadius: '50%',
    border: '3px solid {colors.navy}',
    background: 'teal',
    color: 'white',
    boxShadow: 'raised',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0',
    transition: 'transform 0.08s',
  },
  '.round span': { fontSize: '12.5px', fontWeight: '600', textShadow: '0 1px 0 rgba(0, 0, 0, 0.25)' },
  '.round:hover': { transform: 'translateY(-3px)', background: '#38bdb4' },
  '.round:active': { transform: 'translateY(2px)', boxShadow: '0 2px 0 rgba(36, 56, 74, 0.32)' },
  '.round.on': { background: 'orange' },
  // a button whose word is wider than the circle where it sits draws its own outline: the circle with a slight plate
  // round the word, as one path behind the icon and the word (ui/lib/weld.ts), in place of its border and shadow
  '.round.welded': { position: 'relative', background: 'none', border: '0', boxShadow: 'none' },
  '.round.welded > .shape': {
    position: 'absolute',
    inset: '0',
    width: '100%',
    height: '100%',
    maxWidth: 'none',
    maxHeight: 'none',
    zIndex: '0',
    overflow: 'visible',
    pointerEvents: 'none',
    filter: 'drop-shadow(0 5px 0 rgba(36, 56, 74, 0.32))',
  },
  '.round.welded > .shape .fill': {
    fill: 'teal',
    stroke: 'navy',
    strokeWidth: '3',
    strokeLinejoin: 'round',
  },
  '.round.welded:hover > .shape .fill': { fill: '#38bdb4' },
  '.round.welded:active > .shape': { filter: 'drop-shadow(0 2px 0 rgba(36, 56, 74, 0.32))' },
  '.round.welded.on > .shape .fill': { fill: 'orange' },
  '.round.welded > .icon, .round.welded > span': { position: 'relative', zIndex: '1' },
  '.round.small': { width: '44px', height: '44px', fontSize: '19px', background: 'cream', color: 'navy' },
  // switched off, but still a button: greyed and struck through rather than faded
  '.round.small.off': { position: 'relative', background: '#d7d2c5' },
  '.round.small.off::after': {
    content: "''",
    position: 'absolute',
    width: '64%',
    height: '3px',
    borderRadius: '2px',
    background: 'red',
    transform: 'rotate(-45deg)',
  },

  // a button with words: go ahead, think twice, or one of a row
  'button.go, button.danger, .btnrow button': {
    pointerEvents: 'auto',
    border: '2.5px solid {colors.navy}',
    borderRadius: '12px',
    padding: '6px 16px',
    fontWeight: '600',
    fontSize: '14.5px',
    background: 'cream',
    boxShadow: LOW_SHADOW,
    marginTop: '8px',
  },
  'button.go': { background: 'green', color: 'white' },
  'button.danger': { background: '#fbe3e1', color: '#a8322b' },
  'button.go:hover, button.danger:hover, .btnrow button:hover': {
    filter: 'brightness(1.06)',
    transform: 'translateY(-1px)',
  },
  '.btnrow': { display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap', marginTop: '10px' },
  '.btnrow button': { fontSize: '16px', padding: '8px 20px' },
  '@media (max-width: 1540px)': {
    '.round': { width: '66px', height: '66px' },
    '.round i': { fontSize: '22px' },
    '.round span': { fontSize: '11px' },
  },
  '.btnrow.left': { justifyContent: 'flex-start', marginTop: '4px' },
  '.btnrow.left button': { fontSize: '13.5px', padding: '5px 12px' },
  '.btnrow button.locked': { opacity: '0.45', cursor: 'not-allowed' },
  '@media (max-width: 720px)': {
    '.round': { width: '56px', height: '56px' },
    '.round span': { fontSize: '10px' },
  },
  '.btnrow button.danger': { background: '#fbe3e1', color: '#a8322b' },

  // a label that opens a file picker, for importing saves and room templates
  '.filebtn': {
    flex: 'none',
    cursor: 'pointer',
    border: '2px dashed {colors.navy}',
    borderRadius: '10px',
    padding: '4px 11px',
    fontSize: '13px',
    fontWeight: '600',
    background: 'white',
  },
  '.filebtn:hover': { background: '#f0fbf9' },

  // the tutorial's ring on what its step wants: a gold outline that breathes, drawn outside the button so nothing moves
  '.guide': {
    outline: '4px solid {colors.gold}',
    outlineOffset: '3px',
    animation: 'guide 1.4s ease-in-out infinite',
  },
  '@media (prefers-reduced-motion: reduce)': { '.guide': { animation: 'none' } },

  // an on and off switch, in the settings and on Willow Lane's card
  '.switch': {
    pointerEvents: 'auto',
    flex: 'none',
    width: '52px',
    height: '30px',
    borderRadius: '999px',
    border: '2.5px solid {colors.navy}',
    background: '#d7d2c5',
    padding: '0',
    position: 'relative',
    transition: 'background 0.15s',
  },
  '.switch span': {
    position: 'absolute',
    top: '2px',
    left: '2px',
    width: '21px',
    height: '21px',
    borderRadius: '50%',
    background: 'white',
    border: '2px solid {colors.navy}',
    opacity: '1 !important',
    transition: 'left 0.15s',
  },
  '.switch.on': { background: 'green' },
  '.switch.on span': { left: '24px' },
});
