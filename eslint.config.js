// @ts-check
import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import globals from 'globals';
import tseslint from 'typescript-eslint';

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
      // numbers and booleans read fine in a template; anything else has to be converted on purpose
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true, allowBoolean: true }],
      '@typescript-eslint/no-confusing-void-expression': ['error', { ignoreArrowShorthand: true }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },

  // the game runs in a browser, and in the desktop app in a sandboxed page: it can reach neither Node nor Electron
  {
    files: ['src/**'],
    languageOptions: { globals: globals.browser },
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [{ name: 'electron', message: 'The game cannot use Electron. Add what it needs to electron/api.ts.' }],
          patterns: [{ group: ['node:*'], message: 'The game runs in a browser, where Node is not available.' }],
        },
      ],
    },
  },

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
