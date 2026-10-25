// The looks shared across the interface, as recipes: the panel everything sits on, round buttons, worded buttons and
// rows of them, tabs, the switch, the file button and the tutorial's ring. Each keeps the class name the interface has
// always given it (`panel`, `round`, `go`, `btnrow` and so on), so a component's own styles and the tests still find
// it by that name; a variant adds a class of its own, such as `round--size_small`.
import { defineRecipe } from '@pandacss/dev';

/** The flat drop under a smaller button, nearer the page than a panel's. */
const LOW_SHADOW = '[0 3px 0 rgba(36, 56, 74, 0.3)]';

/** A button with words on it: the go and danger buttons, and every button in a row of them. */
const worded = {
  pointerEvents: 'auto',
  border: '[2.5px solid {colors.navy}]',
  borderRadius: '[12px]',
  p: '[6px 16px]',
  fontWeight: 'bold',
  fontSize: '[14.5px]',
  bg: 'cream',
  boxShadow: LOW_SHADOW,
  mt: 'm',
  _hover: { filter: '[brightness(1.06)]', transform: '[translateY(-1px)]' },
} as const;

/** The cream card a menu, a dialog or a panel is drawn on, with its heading. */
export const panelCard = defineRecipe({
  className: 'panel',
  description: 'The cream card a menu, a dialog or a panel is drawn on',
  base: {
    pointerEvents: 'auto',
    bg: 'cream',
    border: '[3px solid {colors.navy}]',
    borderRadius: '[18px]',
    boxShadow: 'raised',
    p: '[12px 14px]',
    '& h3': { fontSize: '[17px]', fontWeight: 'bold', mb: 's' },
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
    borderRadius: '[50%]',
    border: '[3px solid {colors.navy}]',
    bg: 'teal',
    color: 'white',
    boxShadow: 'raised',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 'none',
    transition: '[transform 0.08s]',
    '& span': { fontSize: '[12.5px]', fontWeight: 'bold', textShadow: '[0 1px 0 rgba(0, 0, 0, 0.25)]' },
    _hover: { transform: '[translateY(-3px)]', bg: '[#38bdb4]' },
    _active: { transform: '[translateY(2px)]', boxShadow: '[0 2px 0 rgba(36, 56, 74, 0.32)]' },
    // on stays orange under the pointer
    '&.on, &.on:hover': { bg: 'orange' },
    _max1540: { w: '[66px]', h: '[66px]', '& i': { fontSize: '[22px]' }, '& span': { fontSize: '[11px]' } },
    _max720: { w: '[56px]', h: '[56px]', '& span': { fontSize: '[10px]' } },
  },
  variants: {
    size: {
      normal: {},
      small: {
        w: '[44px]',
        h: '[44px]',
        fontSize: '[19px]',
        bg: 'cream',
        color: 'navy',
        '&.off': { position: 'relative', bg: '[#d7d2c5]' },
        '&.off::after': {
          content: "''",
          position: 'absolute',
          w: '[64%]',
          h: '[3px]',
          borderRadius: '[2px]',
          bg: 'red',
          transform: 'rotate(-45deg)',
        },
      },
    },
    welded: {
      false: {},
      true: {
        position: 'relative',
        bg: '[none]',
        border: '[0]',
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
          filter: '[drop-shadow(0 5px 0 rgba(36, 56, 74, 0.32))]',
        },
        '& > .shape .fill': { fill: 'teal', stroke: 'navy', strokeWidth: '3', strokeLinejoin: 'round' },
        '&:hover > .shape .fill': { fill: '[#38bdb4]' },
        '&:active > .shape': { filter: '[drop-shadow(0 2px 0 rgba(36, 56, 74, 0.32))]' },
        '&.on > .shape .fill': { fill: 'orange' },
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
  base: { ...worded, bg: 'green', color: 'white' },
});

/** The button to think twice about: light red, with dark red words. */
export const dangerButton = defineRecipe({
  className: 'danger',
  description: 'A light red worded button to think twice about',
  base: { ...worded, bg: '[#fbe3e1]', color: '[#a8322b]' },
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
    gap: '[10px]',
    justifyContent: 'center',
    flexWrap: 'wrap',
    mt: '[10px]',
    '& button': { ...worded, fontSize: '[16px]', p: '[8px 20px]' },
    '& button:is(.go)': { bg: 'green' },
    '& button:is(.danger)': { bg: '[#fbe3e1]' },
    '& button.locked': { opacity: '[0.45]', cursor: 'not-allowed' },
  },
  variants: {
    align: {
      center: {},
      left: { justifyContent: 'flex-start', mt: 'xs', '& button': { fontSize: 'body', p: '[5px 12px]' } },
    },
  },
  defaultVariants: { align: 'center' },
});

/** A row of tabs, such as the Hire menu's roles and the Items menu's filters. */
export const tabStrip = defineRecipe({
  className: 'tabs',
  description: 'A row of tabs',
  base: { display: 'flex', gap: 's', flexWrap: 'wrap' },
});

/** One tab, teal while it is the one showing; a small one for a filter. */
export const tabButton = defineRecipe({
  className: 'tab',
  description: 'One tab, teal while it is the one showing',
  base: {
    border: '[2.5px solid {colors.navy}]',
    bg: 'white',
    borderRadius: '[11px]',
    p: '[4px 11px]',
    fontSize: 'body',
    fontWeight: '[500]',
    _on: { bg: 'teal', color: 'white' },
  },
  variants: {
    size: {
      normal: {},
      small: { fontSize: 'small', p: '[3px 10px]', borderWidth: '[2px]' },
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
    borderRadius: '[999px]',
    border: '[2.5px solid {colors.navy}]',
    bg: '[#d7d2c5]',
    p: 'none',
    position: 'relative',
    transition: '[background 0.15s]',
    '& span': {
      position: 'absolute',
      top: '[2px]',
      left: '[2px]',
      w: '[21px]',
      h: '[21px]',
      borderRadius: '[50%]',
      bg: 'white',
      border: '[2px solid {colors.navy}]',
      opacity: '[1 !important]',
      transition: '[left 0.15s]',
    },
    _on: { bg: 'green' },
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
    border: '[2px dashed {colors.navy}]',
    borderRadius: '[10px]',
    p: '[4px 11px]',
    fontSize: '[13px]',
    fontWeight: 'bold',
    bg: 'white',
    _hover: { bg: '[#f0fbf9]' },
  },
});

/** The tutorial's ring on what its step wants: a gold outline that breathes, drawn outside, so nothing moves. */
export const guideRing = defineRecipe({
  className: 'guide',
  description: "The tutorial's ring on what its step wants",
  base: {
    outline: '[4px solid {colors.gold}]',
    outlineOffset: '[3px]',
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
