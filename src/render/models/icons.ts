// The game's own icons in the scene, for speech bubbles, room signs and markers. Every icon is a corner of one texture
// atlas, built by `yarn icons` from the drawings in src/ui/icons/, so they all look the same on every computer and
// share one picture on the graphics card.
import * as THREE from 'three';

import type { SceneIconId } from '../../core/data';
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
 * A cached texture of an icon, in a white speech bubble unless plain. It is a view of the shared atlas: each icon's
 * texture keeps its own corner of it.
 */
export function iconTexture(id: SceneIconId, plain = false): THREE.Texture {
  const key = id + (plain ? '|p' : '');
  let t = cache.get(key);
  if (t) return t;
  const rect = ATLAS.icons[id][plain ? 'plain' : 'bubble'];
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
