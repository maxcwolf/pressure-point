// Types for eslint-theme-tokens.mjs, so the tests can use it.
import type { ESLint } from 'eslint';

/** What is wrong with `value` as the style property `prop`, or nothing. */
export function problem(prop: string, value: string): string | undefined;

declare const plugin: ESLint.Plugin;
export default plugin;
