// The theme's values, as Panda tokens: the palette (palette.ts) and the colors' roles (semantic.ts), the font and the
// shadow everything shares, and the scales of spacing, sizes, radii and type the interface is drawn with. Each is a CSS
// variable, such as `--colors-fg` or `--spacing-8`.
import { defineSemanticTokens, defineTokens } from '@pandacss/dev';

import { palette } from './palette';
import { semanticColors } from './semantic';

export const tokens = defineTokens({
  colors: palette,
  shadows: {
    /** The flat drop under a panel or a button, as if it stood a little off the page. */
    raised: { value: '0 5px 0 {colors.shadow}' },
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
  borders: {
    control: { value: '2px solid {colors.outline}' },
    card: { value: '2px solid {colors.border.strong}' },
  },
  opacity: {
    muted: { value: '0.72' },
    locked: { value: '0.35' },
  },
});

export const semanticTokens = defineSemanticTokens({ colors: semanticColors });
