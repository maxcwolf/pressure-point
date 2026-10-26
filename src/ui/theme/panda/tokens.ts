// The theme's values, as Panda tokens: the palette (palette.ts) and the colors' roles (semantic.ts), the font and the
// shadow everything shares, and the scales of spacing, sizes, radii and type the interface is drawn with. Each is a CSS
// variable, such as `--colors-fg` or `--spacing-8`.
import { defineSemanticTokens, defineTokens } from '@pandacss/dev';

import { palette } from './palette';
import { semanticColors } from './semantic';

export const tokens = defineTokens({
  colors: palette,
  /** Shadows: the flat drops under things standing off the page, by height, a dark one on the title screen's glass. */
  shadows: {
    none: { value: 'none' },
    raised: {
      DEFAULT: { value: '0 5px 0 {colors.shadow}' },
      dark: { value: '0 4px 0 {colors.shadow.dark}' },
    },
    low: {
      DEFAULT: { value: '0 3px 0 {colors.shadow}' },
      dark: { value: '0 3px 0 {colors.shadow.dark}' },
    },
    pressed: {
      DEFAULT: { value: '0 2px 0 {colors.shadow}' },
      dark: { value: '0 2px 0 {colors.shadow.dark}' },
    },
    flat: { value: '0 1px 0 {colors.shadow}' },
    /** A tooltip's: a drop and a soft blur, as it floats over everything. */
    float: { value: '0 4px 0 {colors.shadow}, 0 10px 22px {colors.shadow.soft}' },
    /** A ring round the one picked. */
    ring: {
      DEFAULT: { value: '0 0 0 2px {colors.accent}' },
      strong: { value: '0 0 0 3px {colors.accent}' },
    },
    /** A hairline drawn inside the edge. */
    inset: { value: 'inset 0 0 0 1px {colors.border}' },
    /** A status's colored edge down its left side. */
    stripe: {
      good: { value: 'inset 4px 0 0 {colors.good.solid}' },
      warn: { value: 'inset 4px 0 0 {colors.warn.solid}' },
      bad: { value: 'inset 4px 0 0 {colors.bad.solid}' },
    },
    /** Under words: a round button's label, and the title screen's. */
    text: {
      label: { value: '0 1px 0 {colors.shadow.text}' },
      title: { value: '0 2px 0 {colors.shadow.text}' },
      'title-strong': { value: '0 1px 2px {colors.shadow.text-strong}' },
    },
  },
  /** How long a move takes: instant for a press, fast for a pop, slow for a bar filling, loop for one that repeats. */
  durations: {
    instant: { value: '80ms' },
    fast: { value: '150ms' },
    normal: { value: '200ms' },
    slow: { value: '300ms' },
    slower: { value: '400ms' },
    loop: { value: '1400ms' },
  },
  easings: {
    out: { value: 'ease-out' },
    in: { value: 'ease-in' },
    'in-out': { value: 'ease-in-out' },
    linear: { value: 'linear' },
  },
  fonts: {
    body: { value: "'Fredoka', 'Arial Rounded MT Bold', 'Segoe UI', system-ui, sans-serif" },
  },
  /** The spacing scale, each step its size in pixels, in steps of 2 up to 16 and wider beyond. */
  spacing: {
    0: { value: '0' },
    1: { value: '1px' },
    2: { value: '2px' },
    4: { value: '4px' },
    6: { value: '6px' },
    8: { value: '8px' },
    10: { value: '10px' },
    12: { value: '12px' },
    14: { value: '14px' },
    16: { value: '16px' },
    20: { value: '20px' },
    24: { value: '24px' },
    32: { value: '32px' },
    half: { value: '50%' },
    full: { value: '100%' },
    /** How far the panels stand in from the edge of the screen. */
    gutter: { value: '14px' },
    /** Below the system buttons along the top: the gutter, a small round button and a gap. */
    'below-bar': { value: 'calc({spacing.gutter} + {sizes.round.small} + {spacing.8})' },
  },
  /** Sizes: a scale named by pixels for icons, swatches and bars, and named sizes for the parts that set a layout. */
  sizes: {
    0: { value: '0' },
    full: { value: '100%' },
    2: { value: '2px' },
    4: { value: '4px' },
    6: { value: '6px' },
    8: { value: '8px' },
    10: { value: '10px' },
    12: { value: '12px' },
    14: { value: '14px' },
    16: { value: '16px' },
    20: { value: '20px' },
    24: { value: '24px' },
    28: { value: '28px' },
    32: { value: '32px' },
    36: { value: '36px' },
    40: { value: '40px' },
    44: { value: '44px' },
    48: { value: '48px' },
    56: { value: '56px' },
    64: { value: '64px' },
    72: { value: '72px' },
    80: { value: '80px' },
    96: { value: '96px' },
    /** The height of a small control, such as a stepper's buttons. */
    control: { value: '28px' },
    /** A round button, as the bar's menus and tools: smaller as the window narrows, and the system buttons' small one. */
    round: {
      DEFAULT: { value: '76px' },
      md: { value: '66px' },
      sm: { value: '56px' },
      small: { value: '44px' },
    },
    /** The on and off switch, and its knob. */
    switch: {
      DEFAULT: { value: '52px' },
      height: { value: '30px' },
      knob: { value: '21px' },
    },
    /** How wide the panels round the edge of the screen are. */
    panel: {
      hud: { value: '290px' },
      tooltip: { value: '290px' },
      inspector: { value: '280px' },
      objectives: { value: '248px' },
      'objectives-narrow': { value: '200px' },
      picker: { value: '270px' },
      notice: { value: '320px' },
      tutorial: { value: '400px' },
      advisor: { value: '470px' },
      toasts: { value: '170px' },
      console: { value: '210px' },
    },
    /** A cell of the stats bar, and its wider money cell. */
    stat: {
      DEFAULT: { value: '96px' },
      money: { value: '150px' },
    },
  },
  /** The corner radii, each its size in pixels, with a pill's ends and a disc. */
  radii: {
    none: { value: '0' },
    2: { value: '2px' },
    4: { value: '4px' },
    6: { value: '6px' },
    8: { value: '8px' },
    10: { value: '10px' },
    12: { value: '12px' },
    14: { value: '14px' },
    18: { value: '18px' },
    pill: { value: '999px' },
    disc: { value: '50%' },
  },
  /** The type sizes, each its size in pixels: 13 for small print, 14 for the body, 17 for a heading. */
  fontSizes: {
    11: { value: '11px' },
    12: { value: '12px' },
    13: { value: '13px' },
    14: { value: '14px' },
    15: { value: '15px' },
    17: { value: '17px' },
    20: { value: '20px' },
    24: { value: '24px' },
    /** The title's big stars. */
    display: { value: '52px' },
  },
  fontWeights: {
    regular: { value: '400' },
    medium: { value: '500' },
    bold: { value: '600' },
    heavy: { value: '700' },
  },
  lineHeights: {
    collapse: { value: '0' },
    none: { value: '1' },
    tight: { value: '1.1' },
    snug: { value: '1.3' },
    normal: { value: '1.4' },
    relaxed: { value: '1.5' },
    loose: { value: '1.9' },
  },
  letterSpacings: {
    tighter: { value: '-2px' },
    normal: { value: '0' },
    wide: { value: '0.04em' },
    wider: { value: '0.06em' },
    /** Between a row of stars. */
    stars: {
      small: { value: '1px' },
      DEFAULT: { value: '2px' },
      large: { value: '6px' },
    },
  },
  /** How thick a line is: the cartoon outline is medium, a panel's thick, a chip's fine. */
  borderWidths: {
    /** a 13px star's outline */
    trace: { value: '0.6px' },
    hairline: { value: '1px' },
    fine: { value: '1.5px' },
    thin: { value: '2px' },
    medium: { value: '2.5px' },
    thick: { value: '3px' },
    heavy: { value: '4px' },
    stripe: { value: '8px' },
  },
  /** The lines things are drawn with. */
  borders: {
    none: { value: 'none' },
    /** The dark outline round a button, a tab or a field; thick round a panel, thin or fine round something small. */
    outline: {
      DEFAULT: { value: '{borderWidths.medium} solid {colors.outline}' },
      thick: { value: '{borderWidths.thick} solid {colors.outline}' },
      thin: { value: '{borderWidths.thin} solid {colors.outline}' },
      fine: { value: '{borderWidths.fine} solid {colors.outline}' },
      dashed: { value: '{borderWidths.thin} dashed {colors.outline}' },
    },
    /** A card set on a panel. */
    card: { value: '{borderWidths.thin} solid {colors.border.strong}' },
    /** A line between parts of a panel. */
    divider: {
      DEFAULT: { value: '{borderWidths.thin} solid {colors.border}' },
      dashed: { value: '{borderWidths.thin} dashed {colors.border}' },
    },
    /** A line between rows of a table. */
    hairline: { value: '{borderWidths.hairline} solid {colors.border.faint}' },
    /** Round what has the keyboard's focus. */
    focus: { value: '{borderWidths.thin} solid {colors.accent}' },
    /** The tutorial's ring. */
    guide: { value: '{borderWidths.heavy} solid {colors.guide}' },
  },
  /** How much of a thing shows: dim is an unearned star, locked is barely there, muted a step back, soft nearly all. */
  opacity: {
    hidden: { value: '0' },
    dim: { value: '0.25' },
    locked: { value: '0.35' },
    faint: { value: '0.5' },
    quiet: { value: '0.6' },
    muted: { value: '0.72' },
    soft: { value: '0.85' },
    full: { value: '1' },
  },
  /** What sits over what, from the page up. */
  zIndex: {
    base: { value: '0' },
    above: { value: '1' },
    cue: { value: '4' },
    popover: { value: '5' },
    modal: { value: '20' },
    tooltip: { value: '100' },
  },
});

export const semanticTokens = defineSemanticTokens({ colors: semanticColors });
