// Panda CSS: the interface's theme as typed tokens, the style props drawn from them, and the page-wide styles. The
// theme itself is in src/ui/theme/panda/.
import { defineConfig } from '@pandacss/dev';

import { globalCss } from './src/ui/theme/panda/global';
import { keyframes } from './src/ui/theme/panda/keyframes';
import { sharedCss } from './src/ui/theme/panda/shared';
import { semanticTokens, tokens } from './src/ui/theme/panda/tokens';

export default defineConfig({
  include: ['./src/ui/**/*.{ts,tsx}', './src/lab/**/*.{ts,tsx}'],
  exclude: [],
  outdir: 'src/styled-system',
  jsxFramework: 'preact',
  // the utilities, conditions and patterns such as Box, without the default preset's palette and scales
  presets: ['@pandacss/preset-base'],
  // the game's own resets are in src/ui/theme/panda/global.ts; Panda's would restyle every screen
  preflight: false,
  // only the theme's own values type-check, as in Restyle; a value off the scale has to be written as `[11px]`
  strictTokens: true,
  conditions: {
    extend: {
      // the classes Button and the menus set, as `_locked` and `_on`
      locked: '&.locked',
      on: '&.on',
      // the window's widths the interface changes at, as they were written: up to and including each one
      max1540: '@media (max-width: 1540px)',
      max1430: '@media (max-width: 1430px)',
      max1100: '@media (max-width: 1100px)',
      max760: '@media (max-width: 760px)',
      max720: '@media (max-width: 720px)',
      max700: '@media (max-width: 700px)',
    },
  },
  globalCss: { extend: { ...globalCss, ...sharedCss } },
  theme: {
    extend: {
      tokens,
      semanticTokens,
      keyframes,
    },
  },
});
