// The colors the interface uses, named for what they are for: text, grounds, borders, the accent, the status of
// things, and the few features with colors of their own. Each picks from the palette (palette.ts); a see-through one
// mixes a palette color with clear, so the palette holds only solid colors. Components name only these.
import { defineSemanticTokens } from '@pandacss/dev';

/** A palette color laid thin over what is under it, `percent` of it showing. */
const thin = (color: string, percent: number) => ({
  value: `color-mix(in srgb, {colors.${color}} ${percent}%, transparent)`,
});
/** A palette color as it is. */
const is = (color: string) => ({ value: `{colors.${color}}` });

export const semanticColors = defineSemanticTokens.colors({
  /** Words and icons. */
  fg: {
    DEFAULT: is('navy.900'),
    muted: thin('navy.900', 50),
    /** On a dark ground. */
    inverse: is('cream.50'),
    /** On the accent, a go button or anything else filled with a strong color. */
    'on-accent': is('white'),
    /** A link, a heading picked out, a way in. */
    accent: is('teal.700'),
  },
  /** Grounds, from the page up. */
  bg: {
    /** Behind everything, where the game hasn't drawn. */
    canvas: is('grass.300'),
    /** A panel, a menu, a dialog or a toast. */
    panel: is('cream.50'),
    /** A card or a field on a panel. */
    card: is('white'),
    /** Set into a panel: a tag, a well, a track. */
    inset: is('cream.200'),
    /** A quiet patch on a panel. */
    subtle: thin('navy.900', 6),
    /** A slightly firmer patch, as under the pointer on a panel. */
    muted: thin('navy.900', 10),
    /** A card or a row under the pointer. */
    hover: is('teal.50'),
    /** The one chosen. */
    selected: is('teal.100'),
    /** Dark, for a tooltip, an announcement or a status. */
    inverse: is('navy.900'),
    /** A patch on a dark ground. */
    'inverse-subtle': thin('cream.50', 15),
    /** Over the game behind a dialog. */
    backdrop: thin('navy.900', 50),
    /** Something that can't be used. */
    disabled: is('cream.300'),
  },
  /** Lines between and round things; the cartoon outline is `outline`. */
  border: {
    DEFAULT: thin('navy.900', 20),
    strong: thin('navy.900', 35),
    bold: thin('navy.900', 50),
    faint: thin('navy.900', 10),
    /** On a dark ground. */
    inverse: thin('cream.50', 40),
  },
  /** The dark outline round buttons, panels and stars, as if drawn in ink. */
  outline: is('navy.900'),
  /** A button's face. */
  control: {
    DEFAULT: is('cream.50'),
    hover: is('cream.100'),
  },
  /** A chip's ground and edge, as an item's effects. */
  chip: {
    DEFAULT: is('cream.100'),
    border: is('cream.500'),
  },
  /** The interface's own color: round buttons, the open tab, a chosen option. */
  accent: {
    DEFAULT: is('teal.500'),
    hover: is('teal.400'),
    strong: is('teal.700'),
  },
  /** The menu, tool or speed that is on. */
  active: is('orange.500'),
  /** A toggle that is on. */
  toggle: { on: is('gold.400') },
  /** The button that goes ahead. */
  go: is('green.500'),
  /** What to look at: a price, a buy button, the one that counts. */
  highlight: {
    DEFAULT: is('gold.400'),
    bg: is('gold.50'),
  },
  star: is('gold.400'),
  /** Fine: words, a solid mark, grounds. */
  good: {
    DEFAULT: is('green.800'),
    strong: is('green.700'),
    solid: is('green.500'),
    bright: is('green.300'),
    bg: is('green.100'),
    subtle: is('green.50'),
  },
  /** Worth a look. */
  warn: {
    DEFAULT: is('gold.900'),
    solid: is('gold.400'),
    bg: is('gold.100'),
  },
  /** Trouble. */
  bad: {
    DEFAULT: is('red.700'),
    deep: is('red.800'),
    solid: is('red.500'),
    border: is('red.400'),
    bright: is('red.300'),
    light: is('red.200'),
    soft: is('red.100'),
    bg: is('red.50'),
  },
  /** Plain information, and anything cool or calm. */
  info: {
    DEFAULT: is('blue.700'),
    solid: is('blue.500'),
    light: is('blue.300'),
    bg: is('blue.50'),
  },
  /** Anything warm, and a need being met. */
  warm: {
    solid: is('orange.500'),
    bg: is('orange.50'),
  },
  /** Staff's qualifications and energy, a seat, what a star unlocks. */
  special: {
    DEFAULT: is('violet.700'),
    solid: is('violet.500'),
    bg: is('violet.100'),
    wash: thin('plum.700', 12),
  },
  meter: { track: thin('navy.900', 16) },
  /** The edge of each kind of offer or notice. */
  notice: {
    emergency: is('red.500'),
    harm: is('red.500'),
    housecall: is('blue.500'),
    outbreak: is('violet.500'),
    mishap: is('gold.600'),
    runner: is('pink.500'),
  },
  /** The colors the scene draws people's squares in (render/overlays.ts), so a key matches them. */
  scene: {
    staff: is('violet.400'),
    guest: is('orange.400'),
  },
  /** The overlays' colors, read into the scene too (render/heatmap.ts), so the floor and the key agree. */
  overlay: {
    good: is('green.500'),
    fair: is('gold.400'),
    bad: is('red.500'),
    cold: is('blue.500'),
  },
  /** The tutorial's ring and its glow as it breathes. */
  guide: {
    DEFAULT: is('gold.400'),
    glow: thin('gold.400', 55),
  },
  /** Numbers that float up from the scene. */
  floater: {
    DEFAULT: is('white'),
    good: is('green.300'),
    bad: is('red.300'),
  },
  /** A scroll bar's thumb, and the shade at a scroll area's edge. */
  scroll: {
    thumb: thin('navy.900', 50),
    'thumb-hover': thin('navy.900', 80),
    cue: thin('navy.900', 16),
    'cue-dark': is('navy.800'),
  },
  /** The colors shadows are cast in. */
  shadow: {
    DEFAULT: thin('navy.900', 30),
    soft: thin('navy.900', 20),
    dark: thin('black', 25),
    text: thin('black', 25),
    'text-strong': thin('black', 50),
  },
  /** The title screen, drawn over the scene on dark glass. */
  title: {
    bg: is('navy.700'),
    backdrop: thin('navy.800', 35),
    panel: thin('navy.800', 80),
    'panel-subtle': thin('navy.800', 70),
    fg: is('white'),
    accent: is('cyan.200'),
    button: is('cyan.500'),
    'button-hover': is('cyan.400'),
    border: is('white'),
    'border-soft': thin('white', 60),
    off: is('navy.300'),
    'off-border': is('navy.100'),
  },
});
