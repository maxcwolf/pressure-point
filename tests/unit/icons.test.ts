// The game's icons: every drawing keeps to the rules, and the small ones to the stricter rules for 16 pixels, what
// `yarn icons` built from them is up to date, the scene's atlas has a place for each icon it draws, and every room,
// role and discipline has its icon.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  ALARMS,
  atlasCell,
  type AtlasLayout,
  atlasLayout,
  atlasSvg,
  bleed,
  checkIcon,
  checkInk,
  checkLines,
  checkSmallIcon,
  GUTTER,
  type InkBox,
  innerOf,
  inScene,
  linesOf,
  linted,
  madeSmall,
  NEEDS,
  OUT_DIR,
  readIcons,
  readSmall,
  sized,
  sizedSmall,
  SMALL_STROKE,
  smallSheet,
  sourceHash,
  SPARED,
  SPRITE_STROKE,
  spriteSheet,
  undiscked,
  unmedalled,
  variantsOf,
  whitened,
} from '../../scripts/icons.mjs';
import { DISCIPLINES, ICON_IDS, ROLES, ROOMS, SCENE_ICON_IDS } from '../../src/core/data';
import { atlasUv } from '../../src/render/models/icons';
import {
  isSmall,
  LINE,
  lineScale,
  MAX_LINE,
  MIN_LINE,
  SMALL_SIZE,
  wholePixels,
} from '../../src/ui/components/common/Icon';
import { OVERLAYS } from '../../src/ui/lib/overlays';

const icons = readIcons();
const small = readSmall();
const ids = icons.map((i) => i.id);
const atlas = JSON.parse(readFileSync(join(OUT_DIR, 'atlas.json'), 'utf8')) as AtlasLayout & { hash: string };
const ink = JSON.parse(readFileSync(join(OUT_DIR, 'ink.json'), 'utf8')) as {
  hash: string;
  boxes: Record<string, InkBox>;
};

describe('the icon drawings', () => {
  for (const { id, svg } of icons) {
    it(`${id} keeps to the rules`, () => {
      expect(checkIcon(id, svg)).toEqual([]);
    });
  }

  for (const [id, svg] of Object.entries(small)) {
    it(`small/${id} keeps to the rules for 16 pixels`, () => {
      expect(checkSmallIcon(id, svg, ids)).toEqual([]);
    });
  }

  it('are drawn small for every speech bubble and marker, which the scene shows at 8 to 30 pixels', () => {
    for (const id of ids.filter((i) => i.startsWith('bubble-') || i.startsWith('marker-'))) {
      expect(small, id).toHaveProperty(id);
    }
  });

  it('are refused, when small, for anything too fine to survive 16 pixels', () => {
    const fine =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><g stroke="#24384a" stroke-width="2.25">' +
      '<circle cx="16" cy="16" r="1.7" fill="#24384a"/></g></svg>';
    expect(checkSmallIcon('bubble-nobody', fine, ids)).toEqual([
      'there is no icon of that name to be the small drawing of',
      'a line 2.25 wide is too thin for 16 pixels: 2.8 at least',
      'r="1.7" is too small for 16 pixels: 2 at least',
    ]);
  });

  it('have no navy hairline, measured after any scaling', () => {
    const scaled =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><g stroke="#24384a" stroke-width="2.25">' +
      '<g transform="translate(16 16) scale(0.86) translate(-16 -16)"><path d="M0 0" stroke-width="1.6"/>' +
      '<path d="M0 0" stroke="#ffffff" stroke-width="1"/></g><path d="M0 0"/></g></svg>';
    expect(linesOf(scaled)).toEqual([
      { color: '#24384a', width: 1.38 },
      { color: '#ffffff', width: 0.86 },
      { color: '#24384a', width: 2.25 },
    ]);
    expect(checkLines(scaled)).toEqual(['a navy line 1.38 wide is a hairline: 1.6 at least']);
    expect(checkIcon('ui-thing', scaled)).toContain('a navy line 1.38 wide is a hairline: 1.6 at least');
    // a bubble or marker is judged by its small drawing
    expect(linted('bubble-thing', 'line')).toBe(false);
    expect(checkIcon('bubble-thing', scaled)).toEqual([]);
    // a drawing kept as it is is spared only the lints it is named for
    for (const [id, lints] of Object.entries(SPARED)) {
      expect(ids, id).toContain(id);
      for (const lint of ['line', 'ink'] as const)
        expect(linted(id, lint), `${id} ${lint}`).toBe(!lints.includes(lint));
    }
  });

  it('have ink big enough to sit with the rest and clear of the edge, as yarn icons measured it', () => {
    expect(ink.hash).toBe(sourceHash(icons, small));
    expect(Object.keys(ink.boxes)).toEqual(ids);
    for (const [id, box] of Object.entries(ink.boxes)) if (linted(id, 'ink')) expect(checkInk(box), id).toEqual([]);
    expect(checkInk([5, 5, 26, 26])).toEqual(['its ink is 21.0 across, which looks small: 23 at least']);
    expect(checkInk([0.2, 2, 30, 30])).toEqual([
      'its ink comes 0.2 from the edge, which cuts its outline: 0.5 at least',
    ]);
  });

  it('are refused for what would break the sprite sheet or the palette', () => {
    const bad =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><text id="a" style="x" fill="#123456">!</text></svg>';
    expect(checkIcon('Thing', bad)).toEqual([
      'its id should be lowercase words joined by hyphens',
      'its id should start with one of bubble, marker, room, role, discipline, overlay, ui, season, item, technique, course, feeling, award, achievement, mishap, standing',
      'its <svg> should have viewBox="0 0 32 32"',
      'no text: draw letters as shapes',
      "no styles: the sprite sheets set the lines' width with one",
      'no ids',
      '#123456 is not in the palette',
    ]);
  });
});

describe('what yarn icons builds', () => {
  it('is up to date with the drawings: run `yarn icons` if not', () => {
    expect(atlas.hash).toBe(sourceHash(icons, small));
    expect(readFileSync(join(OUT_DIR, 'sprite.svg'), 'utf8')).toBe(spriteSheet(icons));
    expect(readFileSync(join(OUT_DIR, 'sprite-small.svg'), 'utf8')).toBe(smallSheet(icons, small));
    expect([...ICON_IDS]).toEqual(icons.map((i) => i.id));
    expect([...SCENE_ICON_IDS]).toEqual(icons.map((i) => i.id).filter(inScene));
  });

  it('draws icons in the interface with lines as wide as the size they come out at calls for', () => {
    expect(SPRITE_STROKE).toBeCloseTo(1.8 / 2.25);
    expect(LINE).toBe(SPRITE_STROKE);
    // an outline takes its width from --icon-line; a wide stroke under a colored line is never drawn heavier
    expect(sized('<g stroke-width="2.25"><path stroke-width="7.9"/></g>')).toBe(
      '<g style="stroke-width:calc(2.25 * var(--icon-line, 0.8))"><path style="stroke-width:calc(7.9 * min(var(--icon-line, 0.8), 1))"/></g>',
    );
    const sheet = spriteSheet(icons);
    expect(sheet).not.toContain('stroke-width="');
    expect(atlasSvg(icons).svg).toContain('stroke-width="2.25"');
  });

  it("weighs an icon's lines by the pixels it has, with no step from one size to the next", () => {
    // where there is room, 4/5 of drawn; on a plain screen at 16 pixels, an outline of MIN_LINE pixels
    expect(lineScale(48)).toBe(LINE);
    expect(lineScale(24 * 2)).toBe(LINE);
    expect((2.25 * lineScale(16) * 16) / 32).toBeCloseTo(MIN_LINE, 1);
    expect(lineScale(4)).toBe(MAX_LINE);
    // 20 and 22 pixels, either side of the small sheet, are drawn within a tenth of a pixel of each other
    /** How many pixels across an outline comes out on an icon this size. */
    const px = (s: number) => (2.25 * lineScale(s) * s) / 32;
    expect(Math.abs(px(22) - px(20))).toBeLessThan(0.1);
    for (let s = 8; s < 64; s += 0.5) expect(px(s + 0.5)).toBeGreaterThanOrEqual(px(s) - 0.02);
  });

  it('draws icons at 20 pixels and under from the small sheet, by the pixels they come out at', () => {
    expect(SMALL_SIZE).toBe(20);
    expect(isSmall(20)).toBe(true);
    expect(isSmall(17.55)).toBe(true);
    expect(isSmall(22)).toBe(false);
    // a 1.3em icon beside 17-pixel words is 22.09 pixels across: it is not small
    expect(isSmall(1.3 * 17)).toBe(false);
    expect(SMALL_STROKE).toBeCloseTo(2.9 / 2.25);
    const sheet = smallSheet(icons, small);
    // a bubble has its own small drawing, its lines on the same curve, as drawn at 16 pixels on a plain screen
    expect(sheet).toContain(
      `<symbol id="icon-small-bubble-happy" viewBox="0 0 32 32">${sizedSmall(innerOf(small['bubble-happy'] ?? ''))}</symbol>`,
    );
    expect(sizedSmall('<g stroke-width="3"><path stroke-width="6"/></g>')).toBe(
      '<g style="stroke-width:calc(3 * var(--icon-small-line, 1))"><path style="stroke-width:calc(6 * min(var(--icon-small-line, 1), 1))"/></g>',
    );
    // an icon without one keeps its drawing, with its cream turned white and its lines weighed by its size
    const item = icons.find((i) => i.id === 'item-study-desk');
    expect(madeSmall('item-study-desk', innerOf(item?.svg ?? ''), small)).toContain('var(--icon-line, 1.29)');
    expect(madeSmall('item-study-desk', innerOf(item?.svg ?? ''), small)).not.toContain('#fff8ea');
    expect(whitened('<a fill="#fff8ea"/><b fill="#f3e7cf"/><c fill="#2fa8a0"/>')).toBe(
      '<a fill="#ffffff"/><b fill="#ffffff"/><c fill="#2fa8a0"/>',
    );
    // an award loses its medal and its pictogram grows to fill the square
    const medal =
      '<circle cx="16" cy="16" r="13.5" fill="#f2c14e"/><g transform="translate(16 16) scale(0.86) translate(-16 -16)"><path/></g>';
    expect(unmedalled(medal)).toBe('<g transform="translate(16 16) scale(1.08) translate(-16 -16)"><path/></g>');
    expect(unmedalled('<circle r="3"/>')).toBe('<circle r="3"/>');
  });

  it('sizes an icon to whole pixels of the screen, however its size is written', () => {
    expect(wholePixels(20, 1)).toBe('round(nearest, 20px, 1px)');
    expect(wholePixels('1.3em', 1.25)).toBe('round(nearest, 1.3em, 0.8px)');
    expect(wholePixels(22, 1.5)).toBe('round(nearest, 22px, 0.6667px)');
  });

  it("draws the scene from the small drawings where there are any, but a room's sign from its one drawing", () => {
    const { svg } = atlasSvg(icons, small);
    expect(svg).toContain(innerOf(small['bubble-happy'] ?? 'missing'));
    expect(atlasSvg(icons, {}).svg).not.toContain(innerOf(small['bubble-happy'] ?? 'missing'));
    expect(svg).toContain(innerOf(small['role-healer'] ?? 'missing'));
    const room = icons.find((i) => i.id === 'room-massage');
    expect(svg).toContain(innerOf(room?.svg ?? 'missing'));
    expect(svg).not.toContain(innerOf(small['room-massage'] ?? 'missing'));
  });

  it('gives every icon the scene draws its own cells inside the atlas, on its own, in a bubble and the rest', () => {
    const seen = new Set<string>();
    for (const id of SCENE_ICON_IDS) {
      for (const variant of variantsOf(id)) {
        const r = atlas.icons[id]?.[variant];
        expect(r, `${id} ${variant}`).toBeDefined();
        if (!r) continue;
        expect(r.x + r.w).toBeLessThanOrEqual(atlas.width);
        expect(r.y + r.h).toBeLessThanOrEqual(atlas.height);
        const at = `${r.x},${r.y}`;
        expect(seen.has(at), `${id} ${variant} shares a cell`).toBe(false);
        seen.add(at);
      }
    }
    expect(Object.keys(atlas.icons).sort()).toEqual([...SCENE_ICON_IDS].sort());
  });

  it('draws alarms in red bubbles and needs in amber ones, for the bubbles they suit and no others', () => {
    for (const id of SCENE_ICON_IDS) {
      expect(!!atlas.icons[id]?.alarm, `${id} as an alarm`).toBe(ALARMS.includes(id));
      expect(!!atlas.icons[id]?.need, `${id} as a need`).toBe(NEEDS.includes(id));
    }
    const at = { x: 0, y: 0, w: 128, h: 128 };
    const sand = '<path fill="#e5564d"/><path fill="#ffffff"/>';
    // red on red would vanish, so the drawing's red turns navy on an alarm; gold turns white on a need
    expect(atlasCell('alarm', sand, at)).toContain('fill="#e5564d" stroke="#24384a"');
    expect(atlasCell('alarm', sand, at)).toContain('<path fill="#24384a"/><path fill="#ffffff"/>');
    expect(atlasCell('need', '<path fill="#f2c14e"/>', at)).toContain('<path fill="#ffffff"/>');
    // an alarm is told apart by more than its red: a white badge with a "!" at its top right
    expect(atlasCell('alarm', sand, at)).toContain('<path d="M104 13v12"');
    expect(atlasCell('need', sand, at)).not.toContain('M104 13v12');
  });

  it('puts every role, and the staff marker, on a disc in the purple of the squares staff use', () => {
    for (const id of SCENE_ICON_IDS.filter((i) => i.startsWith('role-') || i === 'marker-staff')) {
      expect(atlas.icons[id]?.square, id).toBeDefined();
    }
    expect(atlas.icons['marker-guest']?.square).toBeUndefined();
    // each role loses its own orange disc on the purple one, or its pictogram would sit on orange still
    for (const { id, svg } of icons.filter((i) => i.id.startsWith('role-'))) {
      expect(undiscked(innerOf(small[id] ?? svg)), id).not.toMatch(/r="13.5" fill="#f08a4b"/);
    }
    expect(atlasCell('square', '<path/>', { x: 0, y: 0, w: 128, h: 128 })).toContain('fill="#9b6bff"');
  });

  it('keeps a gutter round every cell, so an icon seen small does not take in its neighbour', () => {
    expect(GUTTER).toBeGreaterThanOrEqual(8);
    const cells = Object.values(atlas.icons).flatMap((v) => Object.values(v));
    for (const a of cells) {
      expect(a.x).toBeGreaterThanOrEqual(GUTTER / 2);
      expect(a.y).toBeGreaterThanOrEqual(GUTTER / 2);
      expect(a.x + a.w + GUTTER / 2).toBeLessThanOrEqual(atlas.width);
      expect(a.y + a.h + GUTTER / 2).toBeLessThanOrEqual(atlas.height);
      for (const b of cells) {
        if (a === b) continue;
        const apart = Math.max(b.x - (a.x + a.w), a.x - (b.x + b.w), b.y - (a.y + a.h), a.y - (b.y + b.h));
        expect(apart).toBeGreaterThanOrEqual(GUTTER);
      }
    }
    expect(atlasLayout(['a-b'], 128, 16, 16).icons['a-b']?.bubble).toEqual({ x: 152, y: 8, w: 128, h: 128 });
  });

  it('bleeds the color of the nearest ink into every clear texel, keeping it clear', () => {
    // a row of five texels: red ink, two clear, blue ink, one clear; a black clear texel would darken the edges
    const row = new Uint8Array([255, 0, 0, 255, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 255, 200, 0, 0, 0, 3]);
    expect([...bleed(row, 5, 1)]).toEqual([255, 0, 0, 255, 255, 0, 0, 0, 0, 0, 255, 0, 0, 0, 255, 200, 0, 0, 255, 3]);
  });

  it('places a cell where the texture looks for it, counted from the bottom left', () => {
    expect(atlasUv({ x: 0, y: 0, w: 128, h: 128 }, 1024, 512)).toEqual({ x: 0, y: 0.75, w: 0.125, h: 0.25 });
    expect(atlasUv({ x: 896, y: 384, w: 128, h: 128 }, 1024, 512)).toEqual({ x: 0.875, y: 0, w: 0.125, h: 0.25 });
  });
});

describe('every part of the game that needs an icon', () => {
  const ids: readonly string[] = ICON_IDS;
  const scene: readonly string[] = SCENE_ICON_IDS;

  it('has one: each room a sign, each role and discipline its own', () => {
    for (const room of Object.keys(ROOMS)) expect(scene, room).toContain(`room-${room}`);
    for (const role of Object.keys(ROLES)) expect(scene, role).toContain(`role-${role}`);
    for (const discipline of Object.keys(DISCIPLINES)) expect(ids, discipline).toContain(`discipline-${discipline}`);
  });

  it('has a different icon for each overlay, each of its own rather than borrowed from another family', () => {
    expect(new Set(OVERLAYS.map((o) => o.icon)).size).toBe(OVERLAYS.length);
    for (const o of OVERLAYS) expect(o.icon, o.id).toMatch(/^overlay-/);
  });
});
