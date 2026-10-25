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
  },
  shadows: {
    /** The flat drop under a panel or a button, as if it stood a little off the page. */
    raised: { value: '0 5px 0 rgba(36, 56, 74, 0.32)' },
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
  fontSizes: {
    small: { value: '12.5px' },
    body: { value: '13.5px' },
  },
  fontWeights: {
    bold: { value: '600' },
  },
  borders: {
    control: { value: '2px solid {colors.navy}' },
    card: { value: '2px solid rgba(36, 56, 74, 0.3)' },
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
