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
  fonts: {
    body: { value: "'Fredoka', 'Arial Rounded MT Bold', 'Segoe UI', system-ui, sans-serif" },
  },
  /** The spacing scale, each step its size in pixels, in steps of 2 up to 16 and wider beyond. */
  spacing: {
    0: { value: '0' },
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
  },
  sizes: {
    control: { value: '28px' },
  },
  /** The corner radii, each its size in pixels, with a pill's ends and a disc. */
  radii: {
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
  },
  fontWeights: {
    bold: { value: '600' },
  },
  /** How thick a line is: the cartoon outline is medium, a panel's thick, a chip's fine. */
  borderWidths: {
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
  opacity: {
    muted: { value: '0.72' },
    locked: { value: '0.35' },
  },
});

export const semanticTokens = defineSemanticTokens({ colors: semanticColors });
