// The game's icons: every drawing keeps to the rules, what `yarn icons` built from them is up to date, the scene's
// atlas has a place for each icon it draws, and every room, role and discipline has its icon.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  type AtlasLayout,
  checkIcon,
  inScene,
  OUT_DIR,
  readIcons,
  sourceHash,
  spriteSheet,
  VARIANTS,
} from '../../scripts/icons.mjs';
import { DISCIPLINES, ICON_IDS, ROLES, ROOMS, SCENE_ICON_IDS } from '../../src/core/data';
import { atlasUv } from '../../src/render/models/icons';
import { OVERLAYS } from '../../src/ui/lib/overlays';

const icons = readIcons();
const atlas = JSON.parse(readFileSync(join(OUT_DIR, 'atlas.json'), 'utf8')) as AtlasLayout & { hash: string };

describe('the icon drawings', () => {
  for (const { id, svg } of icons) {
    it(`${id} keeps to the rules`, () => {
      expect(checkIcon(id, svg)).toEqual([]);
    });
  }

  it('are refused for what would break the sprite sheet or the palette', () => {
    const bad =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><text id="a" fill="#123456">!</text></svg>';
    expect(checkIcon('Thing', bad)).toEqual([
      'its id should be lowercase words joined by hyphens',
      'its id should start with one of bubble, marker, room, role, discipline, overlay, ui, season',
      'its <svg> should have viewBox="0 0 32 32"',
      'no text: draw letters as shapes',
      'no ids',
      '#123456 is not in the palette',
    ]);
  });
});

describe('what yarn icons builds', () => {
  it('is up to date with the drawings: run `yarn icons` if not', () => {
    expect(atlas.hash).toBe(sourceHash(icons));
    expect(readFileSync(join(OUT_DIR, 'sprite.svg'), 'utf8')).toBe(spriteSheet(icons));
    expect([...ICON_IDS]).toEqual(icons.map((i) => i.id));
    expect([...SCENE_ICON_IDS]).toEqual(icons.map((i) => i.id).filter(inScene));
  });

  it('gives every icon the scene draws its own cells inside the atlas, on its own and in a bubble', () => {
    const seen = new Set<string>();
    for (const id of SCENE_ICON_IDS) {
      for (const variant of VARIANTS) {
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
