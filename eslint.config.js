// @ts-check
import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import jsdoc from 'eslint-plugin-jsdoc';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/** Imports no game code may use, wherever it lives. */
const notInTheGame = {
  paths: [{ name: 'electron', message: 'The game cannot use Electron. Add what it needs to electron/api.ts.' }],
  patterns: [{ group: ['node:*'], message: 'The game runs in a browser, where Node is not available.' }],
};

/** Rules for game core files at one depth: `leaves` matches an import path that climbs out of src/core. */
function coreBoundary(files, leaves) {
  return {
    files: [files],
    languageOptions: { globals: {} },
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [...notInTheGame.paths, { name: 'three', message: 'The game core does not draw anything.' }],
          patterns: [
            ...notInTheGame.patterns,
            { regex: leaves, message: 'The game core imports only from itself: no rendering, interface or app code.' },
          ],
        },
      ],
      'no-restricted-globals': ['error', 'window', 'document', 'navigator', 'localStorage', 'sessionStorage'],
    },
  };
}

export default tseslint.config(
  {
    ignores: ['dist/', 'dist-electron/', 'release/', 'node_modules/', 'test-results/', 'playwright-report/', '.yarn/'],
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

  // the game core is plain logic: no drawing, no interface, no browser. It imports only from itself.
  coreBoundary('src/core/*.ts', '^\\.\\./'),
  coreBoundary('src/core/*/*.ts', '^\\.\\./\\.\\./'),

  // the desktop shell runs in Node
  { files: ['electron/**'], languageOptions: { globals: globals.node } },

  // plain JavaScript that runs in Node: build scripts and this file
  { files: ['**/*.mjs', '**/*.js'], ...tseslint.configs.disableTypeChecked },
  { files: ['**/*.mjs', '**/*.js'], languageOptions: { globals: globals.node } },
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
