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
  atlasSvg,
  checkIcon,
  checkSmallIcon,
  heavier,
  innerOf,
  inScene,
  madeSmall,
  NEEDS,
  OUT_DIR,
  readIcons,
  readSmall,
  SMALL_STROKE,
  smallSheet,
  sourceHash,
  SPRITE_STROKE,
  spriteSheet,
  thinned,
  undiscked,
  unmedalled,
  variantsOf,
  whitened,
} from '../../scripts/icons.mjs';
import { DISCIPLINES, ICON_IDS, ROLES, ROOMS, SCENE_ICON_IDS } from '../../src/core/data';
import { atlasUv } from '../../src/render/models/icons';
import { isSmall, SMALL_SIZE } from '../../src/ui/components/common/Icon';
import { OVERLAYS } from '../../src/ui/lib/overlays';

const icons = readIcons();
const small = readSmall();
const ids = icons.map((i) => i.id);
const atlas = JSON.parse(readFileSync(join(OUT_DIR, 'atlas.json'), 'utf8')) as AtlasLayout & { hash: string };

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

  it('are refused for what would break the sprite sheet or the palette', () => {
    const bad =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><text id="a" fill="#123456">!</text></svg>';
    expect(checkIcon('Thing', bad)).toEqual([
      'its id should be lowercase words joined by hyphens',
      'its id should start with one of bubble, marker, room, role, discipline, overlay, ui, season, item, technique, course, feeling, award, achievement, mishap, standing',
      'its <svg> should have viewBox="0 0 32 32"',
      'no text: draw letters as shapes',
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

  it('draws icons in the interface with lines a little thinner than in the scene', () => {
    expect(SPRITE_STROKE).toBeCloseTo(1.8 / 2.25);
    expect(thinned('<g stroke-width="2.25"><path stroke-width="7.9"/></g>')).toBe(
      '<g stroke-width="1.8"><path stroke-width="6.32"/></g>',
    );
    const sheet = spriteSheet(icons);
    expect(sheet).not.toContain('stroke-width="2.25"');
    expect(atlasSvg(icons).svg).toContain('stroke-width="2.25"');
  });

  it('draws icons at 20 pixels and under from the small sheet: the small drawing, or heavier, whiter lines', () => {
    expect(SMALL_SIZE).toBe(20);
    expect(isSmall(20)).toBe(true);
    expect(isSmall(22)).toBe(false);
    expect(isSmall('1.3em')).toBe(true);
    expect(isSmall('62%')).toBe(false);
    expect(SMALL_STROKE).toBeCloseTo(2.9 / 2.25);
    const sheet = smallSheet(icons, small);
    // a bubble has its own small drawing, used as drawn
    expect(sheet).toContain(
      `<symbol id="icon-small-bubble-happy" viewBox="0 0 32 32">${innerOf(small['bubble-happy'] ?? '')}</symbol>`,
    );
    // a room has not, so its one drawing is made heavier, with its cream turned white
    const room = icons.find((i) => i.id === 'room-massage');
    expect(madeSmall('room-massage', innerOf(room?.svg ?? ''), small)).toContain('stroke-width="2.9"');
    expect(madeSmall('room-massage', innerOf(room?.svg ?? ''), small)).not.toContain('#fff8ea');
    // the wide strokes laid under a colored line as its outline are left as they are
    expect(heavier('<g stroke-width="2.25"><path stroke-width="7.9"/><path stroke-width="2.6"/></g>')).toBe(
      '<g stroke-width="2.9"><path stroke-width="7.9"/><path stroke-width="3.35"/></g>',
    );
    expect(whitened('<a fill="#fff8ea"/><b fill="#f3e7cf"/><c fill="#2fa8a0"/>')).toBe(
      '<a fill="#ffffff"/><b fill="#ffffff"/><c fill="#2fa8a0"/>',
    );
    // an award loses its medal and its pictogram grows to fill the square
    const medal =
      '<circle cx="16" cy="16" r="13.5" fill="#f2c14e"/><g transform="translate(16 16) scale(0.86) translate(-16 -16)"><path/></g>';
    expect(unmedalled(medal)).toBe('<g transform="translate(16 16) scale(1.08) translate(-16 -16)"><path/></g>');
    expect(unmedalled('<circle r="3"/>')).toBe('<circle r="3"/>');
  });

  it('draws the scene from the small drawings where there are any', () => {
    expect(atlasSvg(icons, small).svg).toContain(innerOf(small['bubble-happy'] ?? 'missing'));
    expect(atlasSvg(icons, {}).svg).not.toContain(innerOf(small['bubble-happy'] ?? 'missing'));
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

  it('has a different icon for each overlay', () => {
    expect(new Set(OVERLAYS.map((o) => o.icon)).size).toBe(OVERLAYS.length);
  });
});
