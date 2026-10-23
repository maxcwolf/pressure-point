// The game's own icons in the scene, for speech bubbles, room signs and markers. Every icon is a corner of one texture
// atlas, built by `yarn icons` from the drawings in src/ui/icons/, so they all look the same on every computer and
// share one picture on the graphics card.
import * as THREE from 'three';

import type { SceneIconId } from '../../core/data';
import { must } from '../../core/util';
import ATLAS from '../../ui/icons/generated/atlas.json';
import atlasUrl from '../../ui/icons/generated/atlas.png';

/** A rectangle of the atlas, in pixels from its top left. */
export interface AtlasRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Where a rectangle of an atlas this size lies as a texture sees it: from the bottom left, as fractions of the whole. */
export function atlasUv(r: AtlasRect, width: number, height: number) {
  return { x: r.x / width, y: 1 - (r.y + r.h) / height, w: r.w / width, h: r.h / height };
}

/** The atlas's picture, shared by every icon's texture, once something has asked for it. */
let atlas: { image: HTMLImageElement; source: THREE.TextureSource<HTMLImageElement> } | null = null;
const cache = new Map<string, THREE.Texture>();

/** How many pictures the icons have put on the graphics card: one, however many icons are showing. */
export const iconTextures = () => (atlas ? 1 : 0);

/** The atlas's picture, starting it loading the first time it is asked for. */
function atlasImage() {
  if (!atlas) {
    const image = new Image();
    image.src = atlasUrl;
    atlas = { image, source: new THREE.TextureSource(image) };
  }
  return atlas;
}

/**
 * Start loading the atlas, and say when it is in. The game waits for it before it draws anything, as an icon asked
 * for sooner would be drawn as a black square until it arrived.
 */
export function loadIcons(): Promise<void> {
  return atlasImage()
    .image.decode()
    .catch(() => {
      // a picture that cannot be decoded shows no icons, which is no reason not to play
    });
}

/**
 * How the scene shows an icon: on its own, in a white speech bubble, in a red one for an alarm or an amber one for a
 * need, or as a staff marker on a use square's purple. The atlas has the last three only for the icons they suit.
 */
export type IconVariant = 'plain' | 'bubble' | 'alarm' | 'need' | 'square';

/** Every icon's cells in the atlas: on its own and in a bubble, and the other ways where it has them. */
const CELLS = ATLAS.icons as Record<SceneIconId, Partial<Record<IconVariant, AtlasRect>>>;

/** Whether the atlas shows an icon in a way, such as a bubble in red. */
export const hasVariant = (id: SceneIconId, variant: IconVariant) => !!CELLS[id][variant];

/**
 * A cached texture of an icon, in a white speech bubble unless plain (`true`) or another way. It is a view of the shared
 * atlas: each icon's texture keeps its own corner of it. An icon without the way asked for is shown in its bubble, or
 * on its own for a staff marker.
 */
export function iconTexture(id: SceneIconId, way: boolean | IconVariant = false): THREE.Texture {
  const asked: IconVariant = way === true ? 'plain' : way === false ? 'bubble' : way;
  const variant = hasVariant(id, asked) ? asked : asked === 'square' ? 'plain' : 'bubble';
  const key = `${id}|${variant}`;
  let t = cache.get(key);
  if (t) return t;
  const rect = must(CELLS[id][variant], `the ${variant} cell of ${id}`);
  const uv = atlasUv(rect, ATLAS.width, ATLAS.height);
  t = new THREE.Texture();
  // a view of the one picture: the graphics card is given it once, whatever the corner
  t.source = atlasImage().source;
  t.colorSpace = THREE.SRGBColorSpace;
  t.offset.set(uv.x, uv.y);
  t.repeat.set(uv.w, uv.h);
  t.needsUpdate = true;
  cache.set(key, t);
  return t;
}
