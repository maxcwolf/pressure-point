// @ts-check
import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import jsdoc from 'eslint-plugin-jsdoc';
import reactHooks from 'eslint-plugin-react-hooks';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/** Imports no game code may use, wherever it lives. */
const notInTheGame = {
  paths: [{ name: 'electron', message: 'The game cannot use Electron. Add what it needs to electron/api.ts.' }],
  patterns: [{ group: ['node:*'], message: 'The game runs in a browser, where Node is not available.' }],
};

/** The parts of src/ other than the game core, as a relative import names them. */
const outsideCore = ['app', 'audio', 'lab', 'main', 'render', 'sounds', 'storage', 'ui', 'voice'];

/** A pattern for a relative import that climbs out of its folder, from any depth, into one of `parts` of src/. */
function into(parts) {
  return `^(\\.\\./)+(${parts.join('|')})(/|$)`;
}

/** Keeps `files` from importing `parts` of src/, or anything in `banned`, as well as what no game code may use. */
function layerBoundary(files, parts, message, banned = { paths: [], patterns: [] }) {
  return {
    files: [files],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [...notInTheGame.paths, ...banned.paths],
          patterns: [...notInTheGame.patterns, ...banned.patterns, { regex: into(parts), message }],
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
  layerBoundary(
    'src/render/**/*.{ts,tsx}',
    outsideCore.filter((part) => part !== 'render'),
    'Drawing imports only from the game core and itself: no interface, app, audio or storage code.',
  ),
  layerBoundary(
    'src/storage/**/*.{ts,tsx}',
    outsideCore.filter((part) => part !== 'storage'),
    'Storage imports only from the game core and itself: no interface, app, audio or rendering code.',
  ),

  // components should not reach into the simulation's modules, only their types. A warning for now, so the places
  // that still do show up. The typescript-eslint copy of the rule keeps it apart from the errors above, which
  // would otherwise be overridden here, since a later config replaces a rule's options rather than adding to them.
  {
    files: ['src/ui/components/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'warn',
        {
          patterns: [
            {
              regex: '(^|/)core/sim/',
              allowTypeImports: true,
              message: 'Components should not call the simulation directly; import only its types here.',
            },
          ],
        },
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
