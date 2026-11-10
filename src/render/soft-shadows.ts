// Soft shadows, drawn Full: the sun's shadow edge spread wider and smoothed, by taking twelve taps of the same shadow
// map round each point rather than the five three.js takes. It is a patch to three.js's shared shader code for
// shadows, put in once, before anything is drawn, whichever way the scene is drawn. The patched code takes its soft
// path only for a light whose shadow radius is raised past three.js's own (`SOFT_FROM`), which the sun's is only while
// the scene is drawn Full (`softRadius`), so drawn Plain the sun's shadows run three.js's own five taps, unchanged.
// Should a newer three.js change the code the patch looks for, it leaves the code alone, says so once in a dev build,
// and the sun keeps three.js's own radius, so shadows are drawn as three.js draws them.

import * as THREE from 'three';

import { fancy } from './fx';

/**
 * How many taps of the sun's shadow map each point takes when shadows are soft, and how far apart they spread, in
 * texels: more taps than the five three.js takes, so a wider spread blurs smoothly rather than into grain.
 */
export const SOFT_TAPS = 12;
export const SOFT_RADIUS = 3;
/** The shadow radius past which the patched code takes its soft path: over three.js's own, 1, under `SOFT_RADIUS`. */
const SOFT_FROM = 1.5;

/** The five taps of the shadow map three.js takes for each point in a directional light's shadow, as it writes them. */
const FIVE_TAPS =
  /shadow = \(\s*texture\( shadowMap, vec3\( shadowCoord\.xy \+ vogelDiskSample\( 0, 5, phi \)[\s\S]*?\) \* 0\.2;/;

/**
 * Three.js's code for the shadows, patched to take `SOFT_TAPS` taps for a light whose shadow radius is past
 * `SOFT_FROM`, and its own five, word for word, for any other; or null if the five taps are not where they were. Each
 * tap is still filtered by the hardware, and the disk of taps still turns from pixel to pixel, so the edge is a smooth
 * gradient.
 */
export function softShadowChunk(chunk: string): string | null {
  const five = FIVE_TAPS.exec(chunk);
  if (!five) return null;
  return chunk.replace(
    FIVE_TAPS,
    () => `if ( shadowRadius > ${SOFT_FROM.toFixed(1)} ) {
					shadow = 0.0;
					for ( int i = 0; i < ${SOFT_TAPS}; i ++ ) {
						shadow += texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( i, ${SOFT_TAPS}, phi ) * radius, shadowCoord.z ) );
					}
					shadow /= ${SOFT_TAPS}.0;
				} else {
					${five[0]}
				}`,
  );
}

/** Whether the patch is in: unknown until first tried, then whether it found the code it looks for. */
let softened: boolean | null = null;

/**
 * Patch three.js's shadow code for soft shadows, the first time this is called, for every material drawn from then on.
 * Returns whether the patch is in.
 */
export function softenShadows(): boolean {
  if (softened !== null) return softened;
  const patched = softShadowChunk(THREE.ShaderChunk.shadowmap_pars_fragment);
  softened = patched !== null;
  if (patched) THREE.ShaderChunk.shadowmap_pars_fragment = patched;
  else if (import.meta.env.DEV)
    console.warn('Soft shadows are off: three.js no longer has the shadow code they patch (soft-shadows.ts).');
  return softened;
}

/** The sun's shadow radius: soft drawn Full, if the patch is in, and three.js's own otherwise. */
export const softRadius = (): number => (fancy() && softened === true ? SOFT_RADIUS : 1);
