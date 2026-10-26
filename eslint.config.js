// @ts-check
import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import jsdoc from 'eslint-plugin-jsdoc';
import reactHooks from 'eslint-plugin-react-hooks';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import globals from 'globals';
import tseslint from 'typescript-eslint';

import themeTokens from './scripts/eslint-theme-tokens.mjs';

/** Imports no game code may use, wherever it lives. */
const notInTheGame = {
  paths: [{ name: 'electron', message: 'The game cannot use Electron. Add what it needs to electron/api.ts.' }],
  patterns: [{ group: ['node:*'], message: 'The game runs in a browser, where Node is not available.' }],
};

/** The parts of src/ other than the game core, as a relative import names them. */
const outsideCore = ['app', 'audio', 'lab', 'main', 'render', 'sounds', 'storage', 'ui'];

/**
 * A pattern for a relative import that climbs out of its folder, from any depth, into one of `parts` of src/, unless
 * it is into one of the folders in `except`.
 */
function into(parts, except = []) {
  const allowed = except.map((path) => `(?!${path}/)`).join('');
  return `^(\\.\\./)+${allowed}(${parts.join('|')})(/|$)`;
}

/**
 * Keeps `files` from importing `parts` of src/, or anything in `banned`, as well as what no game code may use. The
 * folders in `except` are let through.
 */
function layerBoundary(files, parts, message, banned = { paths: [], patterns: [] }, except = []) {
  return {
    files: [files],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [...notInTheGame.paths, ...banned.paths],
          patterns: [...notInTheGame.patterns, ...banned.patterns, { regex: into(parts, except), message }],
        },
      ],
    },
  };
}

export default tseslint.config(
  {
    ignores: [
      '.claude/',
      'dist/',
      'dist-electron/',
      'release/',
      'node_modules/',
      'test-results/',
      'playwright-report/',
      '.yarn/',
      // made by Panda from panda.config.ts
      'src/styled-system/',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    plugins: { 'simple-import-sort': simpleImportSort },
    rules: {
      eqeqeq: ['error', 'always'],
      curly: ['error', 'multi-line'],
      'no-console': ['error', { allow: ['warn', 'error'] }],
      'simple-import-sort/imports': 'error',
      'simple-import-sort/exports': 'error',
      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
      // an import of nothing but types must be `import type`, or the module is loaded at run time for no reason
      '@typescript-eslint/no-import-type-side-effects': 'error',
      // numbers and booleans read fine in a template; anything else has to be converted on purpose
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true, allowBoolean: true }],
      '@typescript-eslint/no-confusing-void-expression': ['error', { ignoreArrowShorthand: true }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },

  // every function says what it does in a sentence; the types say the rest
  {
    plugins: { jsdoc },
    rules: {
      'jsdoc/require-jsdoc': [
        'error',
        {
          require: {
            FunctionDeclaration: true,
            MethodDefinition: true,
            ArrowFunctionExpression: true,
            FunctionExpression: true,
          },
          checkConstructors: false,
          enableFixer: false,
        },
      ],
      'jsdoc/require-description': 'error',
      'jsdoc/no-types': 'error',
      'jsdoc/no-restricted-syntax': [
        'error',
        {
          contexts: [
            {
              comment: 'JsdocBlock:has(JsdocTag)',
              context: 'any',
              message: 'Describe it in a sentence, with no tags.',
            },
          ],
        },
      ],
    },
  },

  // the game runs in a browser, and in the desktop app in a sandboxed page: it can reach neither Node nor Electron
  {
    files: ['src/**'],
    languageOptions: { globals: globals.browser },
    rules: { 'no-restricted-imports': ['error', { paths: notInTheGame.paths, patterns: notInTheGame.patterns }] },
  },

  // components: hooks are called the same way on every render, and effects list what they depend on
  {
    files: ['src/ui/**'],
    plugins: { 'react-hooks': reactHooks },
    rules: { 'react-hooks/rules-of-hooks': 'error', 'react-hooks/exhaustive-deps': 'error' },
  },

  // the interface's styles stay on the theme: semantic colors and tokens, no hex values, palette colors or numbers
  {
    files: ['src/ui/**/*.{ts,tsx}'],
    ignores: ['src/ui/theme/panda/palette.ts', 'src/ui/theme/panda/semantic.ts', 'src/ui/theme/panda/tokens.ts'],
    plugins: { theme: themeTokens },
    rules: {
      'theme/tokens': [
        'error',
        {
          themeFiles: [
            'theme/panda/global.ts',
            'theme/panda/keyframes.ts',
            'theme/panda/scroll-cue.ts',
            'theme/panda/recipes.ts',
          ],
        },
      ],
    },
  },

  // the game core is plain logic: no drawing, no interface, no browser. It imports only from itself.
  layerBoundary(
    'src/core/**/*.{ts,tsx}',
    outsideCore,
    'The game core imports only from itself: no rendering, interface or app code.',
    {
      paths: [
        { name: 'three', message: 'The game core does not draw anything.' },
        { name: 'preact', message: 'The game core has no interface.' },
      ],
      patterns: [{ group: ['preact/*'], message: 'The game core has no interface.' }],
    },
  ),
  {
    files: ['src/core/**/*.{ts,tsx}'],
    languageOptions: { globals: {} },
    rules: {
      'no-restricted-globals': ['error', 'window', 'document', 'navigator', 'localStorage', 'sessionStorage'],
    },
  },

  // drawing and saving sit on top of the game core: they import it and themselves, nothing else in the game
  // the one exception is the icons' atlas, which `yarn icons` builds beside the interface's sprite sheet
  layerBoundary(
    'src/render/**/*.{ts,tsx}',
    outsideCore.filter((part) => part !== 'render'),
    'Drawing imports only from the game core and itself: no interface, app, audio or storage code.',
    undefined,
    ['ui/icons/generated'],
  ),
  layerBoundary(
    'src/storage/**/*.{ts,tsx}',
    outsideCore.filter((part) => part !== 'storage'),
    'Storage imports only from the game core and itself: no interface, app, audio or rendering code.',
  ),
  // sound sits on the game core as well: it plays the recordings, and keeps its switches through storage
  layerBoundary(
    'src/audio/**/*.{ts,tsx}',
    outsideCore.filter((part) => !['audio', 'sounds', 'storage'].includes(part)),
    'Sound imports only from the game core, storage, the recordings and itself: no interface, app or rendering code.',
  ),

  // the center's money changes only through the economy's earn, spend and recoup, so it always agrees with the books.
  // A new game and an upgraded save are set up with what they hold, and so is a sandbox game as it starts.
  {
    files: ['src/**'],
    ignores: ['src/core/sim/economy.ts', 'src/core/state/game.ts', 'src/core/state/upgrade.ts', 'src/app/boot.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        ...['AssignmentExpression', 'UpdateExpression'].map((node) => {
          const at = node === 'AssignmentExpression' ? 'left' : 'argument';
          return {
            selector: `${node}[${at}.property.name='money']:matches([${at}.object.name=/^(s|state|save)$/], [${at}.object.property.name='s'])`,
            message: "Change the center's money with earn, spend or recoup in core/sim/economy.ts, so the books agree.",
          };
        }),
      ],
    },
  },

  // the desktop shell runs in Node
  { files: ['electron/**'], languageOptions: { globals: globals.node } },

  // plain JavaScript that runs in Node: build scripts and this file
  { files: ['**/*.mjs', '**/*.js'], ...tseslint.configs.disableTypeChecked },
  { files: ['**/*.mjs', '**/*.js'], languageOptions: { globals: globals.node } },
  // drawn in a browser by scripts/make-brand.mjs
  { files: ['brand/wordmark.mjs'], languageOptions: { globals: globals.browser } },
  { files: ['scripts/**'], rules: { 'no-console': 'off' } },

  // tests reach into the running game and poke at its internals on purpose
  {
    files: ['tests/**'],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
    },
  },

  // formatting belongs to Prettier
  prettier,
);
