// The theme's values, as Panda tokens: the palette, the font and the shadow everything shares, and the small scale of
// spacing, sizes, radii and type the interface is drawn with. Each is a CSS variable, such as `--colors-navy`.
import { defineSemanticTokens, defineTokens } from '@pandacss/dev';

export const tokens = defineTokens({
  colors: {
    navy: { value: '#24384a' },
    cream: { value: '#fff8ea' },
    sand: { value: '#f3e7cf' },
    teal: { value: '#2fa8a0' },
    'teal-dark': { value: '#23827c' },
    orange: { value: '#f08a4b' },
    face: { value: '#ffcc4d' },
    gold: { value: '#f2c14e' },
    red: { value: '#e5564d' },
    green: { value: '#3bb273' },
    blue: { value: '#4a9fe0' },
    white: { value: '#fff' },
    // the paler and deeper steps of the palette's colors, for a ground under the pointer, a chosen one or a quiet one
    'teal-light': { value: '#38bdb4' },
    'teal-tint': { value: '#f0fbf9' },
    'teal-wash': { value: '#e6f6f3' },
    'green-dark': { value: '#23805a' },
    'green-tint': { value: '#e3f5e9' },
    'gold-tint': { value: '#fff6dc' },
    violet: { value: '#8a6fd1' },
    'violet-tint': { value: '#e4d9f7' },
    stone: { value: '#d7d2c5' },
    /** Navy laid thin over what is under it, for a hairline, a quiet ground or a shadow: each step its alpha in percent. */
    ink: {
      6: { value: 'rgba(36, 56, 74, 0.06)' },
      10: { value: 'rgba(36, 56, 74, 0.1)' },
      16: { value: 'rgba(36, 56, 74, 0.16)' },
      20: { value: 'rgba(36, 56, 74, 0.2)' },
      25: { value: 'rgba(36, 56, 74, 0.25)' },
      30: { value: 'rgba(36, 56, 74, 0.3)' },
      35: { value: 'rgba(36, 56, 74, 0.35)' },
      50: { value: 'rgba(36, 56, 74, 0.5)' },
      80: { value: 'rgba(36, 56, 74, 0.8)' },
    },
  },
  shadows: {
    /** The flat drop under a panel or a button, as if it stood a little off the page. */
    raised: { value: '0 5px 0 {colors.ink.30}' },
  },
  fonts: {
    body: { value: "'Fredoka', 'Arial Rounded MT Bold', 'Segoe UI', system-ui, sans-serif" },
  },
  spacing: {
    none: { value: '0' },
    xxs: { value: '2px' },
    xs: { value: '4px' },
    s: { value: '6px' },
    m: { value: '8px' },
    l: { value: '12px' },
  },
  sizes: {
    control: { value: '28px' },
  },
  radii: {
    control: { value: '9px' },
    card: { value: '12px' },
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
    control: { value: '2px solid {colors.navy}' },
    card: { value: '2px solid {colors.ink.30}' },
  },
  opacity: {
    muted: { value: '0.72' },
    locked: { value: '0.35' },
  },
});

export const semanticTokens = defineSemanticTokens({
  colors: {
    // what a line or a bar says, in words dark enough to read on its light ground: fine, worth a look, or trouble
    good: { value: '#1c6b49' },
    'good-bg': { value: '#d8f1e2' },
    warn: { value: '#7a4e0c' },
    'warn-bg': { value: '#fbedc6' },
    bad: { value: '#a8322b' },
    'bad-bg': { value: '#fbe3e1' },
    // the overlays' colors, read into the scene too (render/heatmap.ts), so the floor and the key in the picker agree
    'overlay-good': { value: '{colors.green}' },
    'overlay-fair': { value: '{colors.gold}' },
    'overlay-bad': { value: '{colors.red}' },
    'overlay-cold': { value: '{colors.blue}' },
  },
});
