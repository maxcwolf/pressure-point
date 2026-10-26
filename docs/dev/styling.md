# Styling the interface

How the interface is styled, where the theme lives, and how to add to it without straying off it. How the interface fits into the rest of the game is in [dev/architecture.md](architecture.md#interface-srcui).

The interface is styled with [Panda CSS](https://panda-css.com), compiled away at build time. A component's styles are `css({...})` objects in its own file, written with the theme's tokens, and the Vite plugin turns every `css()`, `css.raw`, recipe and `Box` into a literal string of class names and a stylesheet. Nothing of Panda runs in the game.

## Where things live

| Where                                  | What                                                                                                 |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `panda.config.ts`                      | Hands the theme to Panda, names the conditions, and asks for every recipe's every variant            |
| `src/ui/theme/panda.css`               | The one stylesheet the game loads, with the order of the layers                                      |
| `src/ui/theme/panda/palette.ts`        | Every color, as hues with steps from pale to deep. Never named by a component                        |
| `src/ui/theme/panda/semantic.ts`       | What each color is for: `fg`, `bg.panel`, `accent`, `good`, `bad` and the rest. What components name |
| `src/ui/theme/panda/tokens.ts`         | Everything else: spacing, sizes, radii, type, lines, shadows, opacity, motion, layers                |
| `src/ui/theme/panda/recipes.ts`        | The looks many components share: the panel, round buttons, worded buttons, tabs, the switch          |
| `src/ui/theme/panda/global.ts`         | The resets and the few page-wide classes for words                                                   |
| `src/ui/theme/panda/scroll-cue.ts`     | The scrollbar, shadow and fade on a card that holds more than it shows                               |
| `src/ui/theme/panda/keyframes.ts`      | Every animation                                                                                      |
| `src/ui/theme/panda/scope.ts`          | Keeps the page-wide styles to the game's page, so the model lab and the icon sheet draw their own    |
| `src/ui/components/menus/looks.ts`     | The looks the menus share: the menu panel, cards, ledgers, charts, tables                            |
| `src/ui/components/inspector/looks.ts` | The inspector's small buttons and duty switches                                                      |
| `scripts/eslint-theme-tokens.mjs`      | The lint rule that keeps components on the theme                                                     |
| `src/styled-system/`                   | Made by Panda on install and by the dev server. Not committed, and not edited                        |

## Colors

Colors are in two tiers. The palette (`palette.ts`) holds every color the interface is drawn in, as hues with numbered steps: `navy.900`, `teal.500`, `red.50`. The roles (`semantic.ts`) say what a color is for, and each picks from the palette: `fg` is `navy.900`, `bg.panel` is `cream.50`, `accent` is `teal.500`. Components name only the roles. The lint rule turns down a palette color or a hex value in a component, so retuning a role, or the whole theme, happens in one place.

The roles, by family:

- **Words and icons:** `fg`, with `muted`, `inverse` for a dark ground, `on-accent` for a filled button and `accent` for a link or a heading picked out.
- **Grounds, from the page up:** `bg.canvas`, `bg.panel`, `bg.card`, `bg.inset` for a tag or a well, `bg.subtle` and `bg.muted` for a quiet patch, `bg.hover` and `bg.selected`, `bg.inverse` for a tooltip, `bg.backdrop` behind a dialog, `bg.disabled`.
- **Lines:** `border`, with `strong`, `bold`, `faint` and `inverse`; and `outline`, the dark cartoon line round buttons, panels and stars.
- **Controls:** `control` is a button's cream face, `accent` the teal of round buttons and the open tab, `active` the orange of a menu or tool that is on, `go` the green button that goes ahead, `highlight` the gold of a price or the one that counts.
- **Status:** `good`, `warn`, `bad` and `info`, each with a `solid` for a mark and a `bg` for a ground, and `good`, `warn` and `bad` themselves dark enough to read as words on their own `bg`.
- **Features with colors of their own:** `special` for qualifications and a seat, `notice.*` for each kind of offer, `scene.*` and `overlay.*`, which the 3D scene reads too (`render/heatmap.ts` reads the `--colors-overlay-*` variables), `guide` for the tutorial's ring, `floater.*`, `scroll.*`, `shadow.*` and `title.*` for the title screen's dark glass.

A see-through color is a role, never a palette entry: `border` is navy at 20 percent, mixed with `thin()` in `semantic.ts`, so the palette holds only solid colors.

**Adding a color.** Ask what it is for first. Nearly every need is a role that exists: a ground under the pointer is `bg.hover`, a cost is `highlight`, a problem is `bad`. If a new role is needed, add it to `semantic.ts` under its family and pick its palette color there; add a palette step only if no existing one is close. A color used in one place is still a role, named for its job, because the lint rule allows nothing else and because that is what lets a theme retune it later.

## Tokens

Everything that is not a color is in `tokens.ts`. The scales are named by their size in pixels, so what a style says is what it draws:

| Scale       | Steps                                                        | Written as                                |
| ----------- | ------------------------------------------------------------ | ----------------------------------------- |
| `spacing`   | 0, 1, 2, 4, 6, 8, 10, 12, 14, 16, 20, 24, 32, `half`, `full` | `p: '10'`, `gap: '6'`, `mt: '-4'`         |
| `sizes`     | 2 to 96, finer up to 16 and wider beyond, then named sizes   | `w: '24'`, `h: 'round'`, `w: 'panel.hud'` |
| `radii`     | 2, 4, 6, 8, 10, 12, 14, 18, `pill`, `disc`                   | `borderRadius: '12'`                      |
| `fontSizes` | 11, 12, 13, 14, 15, 17, 20, 24, `display`                    | `fontSize: '14'`                          |

Spacing also has `gutter`, how far the panels stand in from the edge, and `below-bar`, the top of the column under the system buttons. Sizes have `control`, `round` and its smaller steps, `switch`, `stat` and `panel.*`, the widths of the panels round the edge of the screen.

The rest have names, so a style says what a value is for rather than what it measures:

- **Lines:** `border: 'outline'` is the cartoon line, `outline.thick` round a panel, `outline.thin` and `outline.fine` round something small, `outline.dashed` for a file button; `card` round a card on a panel, `divider` and `hairline` between parts and rows, `focus`, `guide`. The widths alone are `borderWidths`: `trace`, `hairline`, `fine`, `thin`, `medium`, `thick`, `heavy`, `stripe`.
- **Shadows:** `raised` under a panel or a round button, `low` under a smaller button, `pressed` while it is down, `flat`, `float` under a tooltip, `ring` round the one picked, `inset`, `stripe.*` down a status's left edge, `text.*` under words.
- **Opacity:** `hidden`, `dim` for an unearned star, `locked`, `faint`, `quiet`, `muted`, `soft`, `full`.
- **Type:** `fontWeights` `regular`, `medium`, `bold` (600) and `heavy` (700); `lineHeights` `collapse`, `none`, `tight`, `snug`, `normal`, `relaxed`, `loose`; `letterSpacings` `wide`, `wider`, `tighter` and `stars.*`.
- **Motion:** `durations` `instant`, `fast`, `normal`, `slow`, `slower`, `loop` and `easings` `out`, `in`, `in-out`, `linear`, written into an animation or transition as `'[pop {durations.normal} {easings.out}]'`.
- **Layers:** `zIndex` `base`, `above`, `cue`, `popover`, `modal`, `tooltip`.

**Adding a token, or not.** A value that two places share, or that a theme should be able to retune, is a token. A measurement of the layout is not: a panel's width worked out from the window, a column's share of a grid, a transform. Those are written in brackets, and the lint rule lets them through when they are layout math (`calc`, `min`, `max`, `clamp`), percentages, sizes in em or of the window, grid templates, transforms, filters, or a value built from tokens such as `'[{borderWidths.fine} solid {colors.special.solid}]'`. A bare number in brackets, such as `mt: '[3px]'`, is turned down: snap it to the scale, or add a step if the scale really lacks one. A value used once that must be exactly what it is, such as the `trace` width of a small star's outline, gets a named token with a comment saying what it is for.

## Writing a component's styles

A component's styles are constants at the top of its file, each a `css({...})` with a one-line comment saying what it draws, and are put on elements with `class={name}`. They are made once, when the module loads, and compile to a string, so there is nothing to memoize and nothing to keep out of render.

```ts
/** A speed button, orange while it is the speed. */
const speed = css({
  border: 'outline',
  bg: 'control',
  borderRadius: '10',
  h: '36',
  _on: { bg: 'active', color: 'fg.on-accent' },
});
```

- **Nested selectors** reach into what a style contains: `'& b': {...}`, `'& .cost': {...}`, `'&.neg b': {...}`, `'&::after': {...}`. Keep them to the element's own parts.
- **Conditions** sit beside the value they change: Panda's own (`_hover`, `_active`, `_motionReduce`), `_on` and `_locked` for the classes `Button` and the menus set, and `_max1540` down to `_max700` for the window widths the interface changes at. `_max1100: { gap: '10' }` reads better than a media block at the bottom of the file.
- **A look several styles build on** is a `css.raw({...})`, and each style passes it to `css()` with its changes: `const moneyCell = css(cell, { minW: 'stat.money' })`. Panda merges them at build time, so the change always wins, with no specificity to fight. The menus' and the inspector's shared looks are in their `looks.ts`.
- **Class names from the game's state** join with `cx()` from `ui/lib/cx.ts`: `class={cx(card, item.locked && 'locked')}`.
- **`Box`** from `styled-system/jsx` takes the same style props on the element, for a one-off wrapper: `<Box display="flex" gap="8">`. A style with a name reads better for anything more.
- **Plain class names stay.** Panda's class names are generated, so an element that a test, a script, or another component's style finds keeps a plain class name too: `class={cx('card', card)}`. Say so in a comment. Tests check them with `toContainClass('locked')`, never a pattern such as `toHaveClass(/locked/)`, which also matches `opacity_locked`.
- **The lab pages** (`src/lab/`) draw their own page with Panda's tokens, but are outside the lint rule and the game's page-wide styles.

## Recipes

A look many components share, with variants, is a recipe in `recipes.ts`: `panelCard()`, `roundButton({ size: 'small' })`, `goButton()`, `dangerButton()`, `buttonRow({ align: 'left' })`, `tabStrip()`, `tabButton({ size: 'small' })`, `toggleSwitch()`, `fileButton()`, `guideRing()`. Each keeps the plain class name the interface has always given it (`panel`, `round`, `go`, `btnrow`, `tab`, `switch`, `guide`), and a variant adds one of its own, such as `round--size_small`. `panda.config.ts` asks for every variant to be built, since some are chosen from the game's state rather than written out.

Recipes sit in a layer under every component's own style, so a component can always change what a recipe draws. Make a look a recipe when three or more components want it with the same variants; a look two files share is a `css.raw` in a `looks.ts` beside them.

## The cascade

`panda.css` orders the layers: `reset, base, tokens, recipes, utilities`. The resets and page-wide styles are in `base`, recipes in `recipes` (their variants after their base), and every `css()` in `utilities`, so a component's style beats a recipe, and both beat the page-wide styles, whatever the specificity.

Within `utilities`, each property is its own class, and the classes are written out in sorted order. That settles one thing to know about: **two nested-element rules on the same element are resolved by their class names, not by where they were written.** If a tab's style says `'& h4': { mt: '10' }` and a card inside it says `'& h4': { mt: '0' }`, both match the card's heading with the same specificity, `mt_0` is written before `mt_10`, and the tab wins. In a stylesheet the later rule would have won. The ways round it, in order:

1. **Compose.** If the card builds on the tab's look, pass the look to `css()` with the change; the override is resolved at build time.
2. **Add specificity.** Scope the inner rule to the element's own plain class: `'&.rival h4': { mt: '0' }` out-specifies `& h4`. Say why in a comment, since the extra class looks needless.
3. **Scope from the outside.** `'.insp &': {...}` in the inner style, where the outer element has a plain class, does the same from the other end.
4. **`!important`**, as a last resort, with a comment naming the rule it beats.

Page-wide styles that used to win on specificity no longer do: `#ui > *` sets `position: absolute` from the base layer, and any component style that sets `position` on a root element wins over it.

## Staying on the theme

Two things keep components on the theme. `strictTokens` is on in `panda.config.ts`, so only the theme's values type-check, and a value off the scale has to be written in brackets to compile at all. The `theme/tokens` lint rule then reads every style object and every `Box` prop and turns down a hex or rgb color, a palette color, a time that is not a duration token, and a bare number in brackets. Its tests are in `tests/unit/theme-tokens.test.ts`. The theme's own files are checked too, apart from the three that define the palette, the roles and the tokens.

## Pictures and the dev server

Every screen has a picture in `tests/visual/screenshots`, and `yarn test:visual` compares them. After a style change that is meant to be seen, run `yarn test:visual:update` and commit the pictures.

- **Small changes hide inside the tolerance.** Playwright passes a picture whose pixels moved a little, so a color a step off, or stars a tenth dimmer, does not fail the suite and is not rewritten by `--update-snapshots`. Check a color change by value, old hex against the role's palette color, not only by the pictures, and when a fix sits inside the tolerance, re-shoot the pictures with `--update-snapshots=all` so they show the game as it is.
- **Restart the dev server before taking pictures.** It does not re-make a component when a `css.raw` look the component imports from another file changes, so the page can keep class names whose styles are gone.
- **A worktree tests its own code.** The suites reuse a server already on port 5183. If another checkout's server is there, set `E2E_PORT` so the worktree starts its own.

## Porting styles from a merged branch

A branch that started before the move to Panda brings stylesheets and plain class strings with it. Merging it into main raises a delete/modify conflict on every `.css` file it touched. For each:

1. Read the rules it added or changed, and `git rm` the stylesheet.
2. Write each rule into the component as a style: a new `css()` beside the others, or a change to the one that draws that element. Map the values onto the theme: `var(--gold)` is `highlight`, `2px solid var(--navy)` is `outline.thin`, `600` is `bold`, `rgba(36, 56, 74, 0.2)` is `border`.
3. Find the class strings it added to elements (`class="btnrow left"`, `class="unlock"`) and turn them into the recipe or the file's own style (`buttonRow({ align: 'left' })`, `class={unlock}`), keeping any plain name a test finds.
4. Change a test's `toHaveClass(/word/)` to `toContainClass('word')`.
5. Run `yarn lint` and `yarn typecheck`, which catch an off-theme value and a token that does not exist, then re-shoot the pictures.
