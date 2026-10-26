// The looks shared across the interface, as recipes: the panel everything sits on, round buttons, worded buttons and
// rows of them, tabs, the switch, the file button and the tutorial's ring. Each keeps the class name the interface has
// always given it (`panel`, `round`, `go`, `btnrow` and so on), so a component's own styles and the tests still find
// it by that name; a variant adds a class of its own, such as `round--size_small`.
import { defineRecipe } from '@pandacss/dev';

/** The flat drop under a smaller button, nearer the page than a panel's. */
const LOW_SHADOW = '[0 3px 0 {colors.shadow}]';

/** A button with words on it: the go and danger buttons, and every button in a row of them. */
const worded = {
  pointerEvents: 'auto',
  border: 'outline',
  borderRadius: '12',
  py: '6',
  px: '16',
  fontWeight: 'bold',
  fontSize: '15',
  bg: 'control',
  boxShadow: LOW_SHADOW,
  mt: '8',
  _hover: { filter: '[brightness(1.06)]', transform: '[translateY(-1px)]' },
} as const;

/** The cream card a menu, a dialog or a panel is drawn on, with its heading. */
export const panelCard = defineRecipe({
  className: 'panel',
  description: 'The cream card a menu, a dialog or a panel is drawn on',
  base: {
    pointerEvents: 'auto',
    bg: 'bg.panel',
    border: 'outline.thick',
    borderRadius: '18',
    boxShadow: 'raised',
    py: '12',
    px: '14',
    '& h3': { fontSize: '17', fontWeight: 'bold', mb: '6' },
  },
});

/**
 * A round button, such as the bar's menus and tools, orange while its menu or tool is on. A small one is cream, as the
 * system buttons are, and greyed and struck through while what it switches is off. A welded one is a button whose word
 * is wider than the circle: it draws its own outline, the circle with a slight plate round the word, as one path behind
 * the icon and the word (ui/lib/weld.ts), in place of its border and shadow.
 */
export const roundButton = defineRecipe({
  className: 'round',
  description: 'A round button, such as the bar menus, tools and system buttons',
  base: {
    pointerEvents: 'auto',
    w: '[76px]',
    h: '[76px]',
    borderRadius: 'disc',
    border: 'outline.thick',
    bg: 'accent',
    color: 'fg.on-accent',
    boxShadow: 'raised',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0',
    transition: '[transform 0.08s]',
    '& span': { fontSize: '13', fontWeight: 'bold', textShadow: '[0 1px 0 {colors.shadow.dark}]' },
    _hover: { transform: '[translateY(-3px)]', bg: 'accent.hover' },
    _active: { transform: '[translateY(2px)]', boxShadow: '[0 2px 0 {colors.shadow}]' },
    // on stays orange under the pointer
    '&.on, &.on:hover': { bg: 'active' },
    _max1540: { w: '[66px]', h: '[66px]', '& i': { fontSize: '24' }, '& span': { fontSize: '11' } },
    _max720: { w: '[56px]', h: '[56px]', '& span': { fontSize: '11' } },
  },
  variants: {
    size: {
      normal: {},
      small: {
        w: '[44px]',
        h: '[44px]',
        fontSize: '20',
        bg: 'control',
        color: 'fg',
        '&.off': { position: 'relative', bg: 'bg.disabled' },
        '&.off::after': {
          content: "''",
          position: 'absolute',
          w: '[64%]',
          h: '[3px]',
          borderRadius: '2',
          bg: 'bad.solid',
          transform: 'rotate(-45deg)',
        },
      },
    },
    welded: {
      false: {},
      true: {
        position: 'relative',
        bg: '[none]',
        border: 'none',
        boxShadow: '[none]',
        '& > .shape': {
          position: 'absolute',
          inset: '[0]',
          w: '[100%]',
          h: '[100%]',
          maxW: 'none',
          maxH: 'none',
          zIndex: '[0]',
          overflow: 'visible',
          pointerEvents: 'none',
          filter: '[drop-shadow(0 5px 0 {colors.shadow})]',
        },
        '& > .shape .fill': { fill: 'accent', stroke: 'outline', strokeWidth: '3', strokeLinejoin: 'round' },
        '&:hover > .shape .fill': { fill: 'accent.hover' },
        '&:active > .shape': { filter: '[drop-shadow(0 2px 0 {colors.shadow})]' },
        '&.on > .shape .fill': { fill: 'active' },
        '& > .icon, & > span': { position: 'relative', zIndex: '[1]' },
      },
    },
  },
  defaultVariants: { size: 'normal', welded: false },
});

/** The button that goes ahead: green, with white words. */
export const goButton = defineRecipe({
  className: 'go',
  description: 'A green worded button that goes ahead',
  base: { ...worded, bg: 'go', color: 'fg.on-accent' },
});

/** The button to think twice about: light red, with dark red words. */
export const dangerButton = defineRecipe({
  className: 'danger',
  description: 'A light red worded button to think twice about',
  base: { ...worded, bg: 'bad.bg', color: 'bad' },
});

/**
 * A row of worded buttons, centered and wrapping, its buttons a little bigger than a lone one; a row at the left has
 * smaller buttons. A go or danger button in the row keeps its colors.
 */
export const buttonRow = defineRecipe({
  className: 'btnrow',
  description: 'A row of worded buttons',
  base: {
    display: 'flex',
    gap: '10',
    justifyContent: 'center',
    flexWrap: 'wrap',
    mt: '10',
    '& button': { ...worded, fontSize: '17', py: '8', px: '20' },
    '& button:is(.go)': { bg: 'go' },
    '& button:is(.danger)': { bg: 'bad.bg' },
    '& button.locked': { opacity: '[0.45]', cursor: 'not-allowed' },
  },
  variants: {
    align: {
      center: {},
      left: { justifyContent: 'flex-start', mt: '4', '& button': { fontSize: '14', py: '4', px: '12' } },
    },
  },
  defaultVariants: { align: 'center' },
});

/** A row of tabs, such as the Hire menu's roles and the Items menu's filters. */
export const tabStrip = defineRecipe({
  className: 'tabs',
  description: 'A row of tabs',
  base: { display: 'flex', gap: '6', flexWrap: 'wrap' },
});

/** One tab, teal while it is the one showing; a small one for a filter. */
export const tabButton = defineRecipe({
  className: 'tab',
  description: 'One tab, teal while it is the one showing',
  base: {
    border: 'outline',
    bg: 'bg.card',
    borderRadius: '10',
    py: '4',
    px: '10',
    fontSize: '14',
    fontWeight: '[500]',
    _on: { bg: 'accent', color: 'fg.on-accent' },
  },
  variants: {
    size: {
      normal: {},
      small: { fontSize: '13', py: '2', px: '10', borderWidth: 'thin' },
    },
  },
  defaultVariants: { size: 'normal' },
});

/** An on and off switch, in the settings and on Willow Lane's card: green with its knob to the right while on. */
export const toggleSwitch = defineRecipe({
  className: 'switch',
  description: 'An on and off switch',
  base: {
    pointerEvents: 'auto',
    flex: 'none',
    w: '[52px]',
    h: '[30px]',
    borderRadius: 'pill',
    border: 'outline',
    bg: 'bg.disabled',
    p: '0',
    position: 'relative',
    transition: '[background 0.15s]',
    '& span': {
      position: 'absolute',
      top: '[2px]',
      left: '[2px]',
      w: '[21px]',
      h: '[21px]',
      borderRadius: 'disc',
      bg: 'bg.card',
      border: 'outline.thin',
      opacity: '[1 !important]',
      transition: '[left 0.15s]',
    },
    _on: { bg: 'good.solid' },
    '&.on span': { left: '[24px]' },
  },
});

/** A label that opens a file picker, for importing saves and room templates. */
export const fileButton = defineRecipe({
  className: 'filebtn',
  description: 'A label that opens a file picker',
  base: {
    flex: 'none',
    cursor: 'pointer',
    border: 'outline.dashed',
    borderRadius: '10',
    py: '4',
    px: '10',
    fontSize: '13',
    fontWeight: 'bold',
    bg: 'bg.card',
    _hover: { bg: 'bg.hover' },
  },
});

/** The tutorial's ring on what its step wants: a gold outline that breathes, drawn outside, so nothing moves. */
export const guideRing = defineRecipe({
  className: 'guide',
  description: "The tutorial's ring on what its step wants",
  base: {
    outline: 'guide',
    outlineOffset: '2',
    animation: 'guide 1.4s ease-in-out infinite',
    _motionReduce: { animation: 'none' },
  },
});

export const recipes = {
  panelCard,
  roundButton,
  goButton,
  dangerButton,
  buttonRow,
  tabStrip,
  tabButton,
  toggleSwitch,
  fileButton,
  guideRing,
};
