// Keeping the game's page-wide styles to the game's own page. The model lab and the icon sheet load Panda's styles for
// the theme's tokens, but draw their own page, and must not get the game's resets, background or shared classes.
import type { defineGlobalStyles } from '@pandacss/dev';

/** What defineGlobalStyles takes: styles keyed by selector. */
type GlobalStyleObject = Parameters<typeof defineGlobalStyles>[0];

/** The game's page, as index.html marks it; inside :where(), so it adds nothing to a selector's specificity. */
const GAME = ':where(html.game)';

/** One selector, as it applies on the game's page only. */
function scoped(selector: string): string {
  if (selector === '*') return `${GAME}, ${GAME} *`;
  if (selector === 'html') return GAME;
  return `${GAME} ${selector}`;
}

/** Styles keyed by selector, each selector kept to the game's page; at-rules keep their place, with theirs inside. */
export function onGamePage(styles: GlobalStyleObject): GlobalStyleObject {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(styles)) {
    if (key.startsWith('@')) out[key] = onGamePage(value as GlobalStyleObject);
    else if (key === ':root') out[key] = value;
    else out[key.split(/,\s*/).map(scoped).join(', ')] = value;
  }
  return out as GlobalStyleObject;
}
