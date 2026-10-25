// Panda CSS: the interface's theme as typed tokens, and the style props drawn from them. A spike: only the Policy
// menu uses it so far, beside the plain stylesheets everything else still uses.
import { defineConfig } from '@pandacss/dev';

/** A color the stylesheets already name in ui/theme/tokens.css, read from there so the two never disagree. */
const legacy = (name: string) => ({ value: `var(--${name})` });

export default defineConfig({
  include: ['./src/ui/**/*.tsx'],
  exclude: [],
  outdir: 'src/styled-system',
  jsxFramework: 'preact',
  // the utilities, conditions and patterns such as Box, without the default preset's palette and scales
  presets: ['@pandacss/preset-base'],
  // the game's own resets in ui/theme/global.css stay; Panda's would restyle every screen
  preflight: false,
  // only the theme's own values type-check, as in Restyle; a value off the scale has to be written as `[11px]`
  strictTokens: true,
  conditions: {
    extend: {
      // the classes Button sets, as `_locked` and `_on`
      locked: '&.locked',
      on: '&.on',
    },
  },
  theme: {
    tokens: {
      colors: {
        navy: legacy('navy'),
        cream: legacy('cream'),
        sand: legacy('sand'),
        teal: legacy('teal'),
        gold: legacy('gold'),
        white: { value: '#fff' },
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
        control: { value: '2px solid var(--navy)' },
        card: { value: '2px solid rgba(36, 56, 74, 0.3)' },
      },
      opacity: {
        muted: { value: '0.72' },
        locked: { value: '0.35' },
      },
    },
  },
});
