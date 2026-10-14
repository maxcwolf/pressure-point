// Emoji drawn to textures, for speech bubbles, room signs and markers.
import * as THREE from 'three';

import { must } from '../../core/util';

const bubbleCache = new Map<string, THREE.Texture>();

/** How many emoji textures have been made. Each is kept for good, so this grows only with the emoji seen so far. */
export const emojiTextures = () => bubbleCache.size;

/** A cached texture of an emoji, in a speech bubble unless plain. */
export function emojiTexture(emoji: string, plain = false): THREE.Texture {
  const key = emoji + (plain ? '|p' : '');
  let t = bubbleCache.get(key);
  if (t) return t;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = must(c.getContext('2d'), '2D canvas');
  if (!plain) {
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#2f4858';
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.arc(64, 58, 50, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(48, 100);
    ctx.lineTo(64, 126);
    ctx.lineTo(80, 100);
    ctx.fill();
    ctx.stroke();
    ctx.fillRect(46, 92, 36, 12);
  }
  ctx.font = `${plain ? 92 : 62}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(emoji, 64, plain ? 70 : 62);
  t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  bubbleCache.set(key, t);
  return t;
}
