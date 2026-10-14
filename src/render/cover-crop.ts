// Fitting one picture into another's shape, as CSS `object-fit: cover` does.

/** The part of a source picture to keep so it fills a target's shape: centered, trimming the long side. */
export function coverCrop(srcW: number, srcH: number, dstW: number, dstH: number) {
  const scale = Math.min(srcW / dstW, srcH / dstH);
  const sw = dstW * scale;
  const sh = dstH * scale;
  return { sx: (srcW - sw) / 2, sy: (srcH - sh) / 2, sw, sh };
}
