import { Linter } from 'eslint';
import { describe, expect, it } from 'vitest';

import themeTokens, { problem } from '../../scripts/eslint-theme-tokens.mjs';

/** The messages the rule gives for `code`, linted as a component. */
function lint(code: string, filename = 'src/ui/components/Thing.tsx'): string[] {
  const linter = new Linter();
  const config: Linter.Config[] = [
    {
      files: ['**/*.tsx', '**/*.ts'],
      languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
      plugins: { theme: themeTokens },
      rules: { 'theme/tokens': ['error', { themeFiles: ['theme/panda/global.ts'] }] },
    },
  ];
  return linter.verify(code, config, filename).map((m) => m.message);
}

describe('the theme tokens rule', () => {
  it('lets semantic colors and tokens through', () => {
    expect(problem('bg', 'bg.panel')).toBeUndefined();
    expect(problem('color', 'fg.muted')).toBeUndefined();
    expect(problem('border', '[{borderWidths.thin} solid {colors.border.strong}]')).toBeUndefined();
    expect(problem('animation', '[pop {durations.fast} {easings.out}]')).toBeUndefined();
    expect(problem('mt', '[0]')).toBeUndefined();
  });

  it('turns down color values and palette colors', () => {
    expect(problem('color', '#fff')).toMatch(/semantic color/);
    expect(problem('bg', '[rgba(0, 0, 0, 0.5)]')).toMatch(/semantic color/);
    expect(problem('bg', 'navy.900')).toMatch(/palette/);
    expect(problem('border', '[2px solid {colors.teal.500}]')).toMatch(/palette/);
  });

  it('turns down numbers and times that should be tokens', () => {
    expect(problem('mt', '[3px]')).toMatch(/token/);
    expect(problem('zIndex', '[3]')).toMatch(/token/);
    expect(problem('opacity', '[0.6]')).toMatch(/token/);
    expect(problem('animation', 'pop 0.2s ease-out')).toMatch(/duration/);
  });

  it("lets layout math, percentages, the window's units and geometry through", () => {
    expect(problem('w', '[min(780px, calc(var(--vw) - 28px))]')).toBeUndefined();
    expect(problem('p', '[0 clamp(6px, 1.4vh, 12px)]')).toBeUndefined();
    expect(problem('w', '[70%]')).toBeUndefined();
    expect(problem('minW', '[2.2em]')).toBeUndefined();
    expect(problem('gridTemplateColumns', '[28px minmax(90px, auto) 28px 1fr]')).toBeUndefined();
    expect(problem('transform', 'translateY(-1px)')).toBeUndefined();
  });

  it('checks style calls and Box props, and leaves other strings alone', () => {
    expect(lint("css({ mt: '[3px]', '&:hover': { bg: 'navy.900' } });")).toHaveLength(2);
    expect(lint('const b = <Box p="[5px]" />;')).toHaveLength(1);
    expect(lint("toast('A thing happened.', { color: '#fff' });")).toHaveLength(0);
  });

  it("checks every object in the theme's own files", () => {
    expect(lint("export const globalCss = { body: { color: '#000' } };", 'src/ui/theme/panda/global.ts')).toHaveLength(
      1,
    );
  });
});
