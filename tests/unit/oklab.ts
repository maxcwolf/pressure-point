// Colors as people see them, for the tests that keep colors apart: in OKLab, after the Machado (2009) simulation of the
// commonest kinds of color blindness at full strength.

/** How each kind of vision sees linear red, green and blue: Machado, Oliveira and Fernandes (2009), severity 1. */
export const VISION = {
  typical: [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ],
  protanopia: [
    [0.152286, 1.052583, -0.204868],
    [0.114503, 0.786281, 0.099216],
    [-0.003882, -0.048116, 1.051998],
  ],
  deuteranopia: [
    [0.367322, 0.860646, -0.227968],
    [0.280085, 0.672501, 0.047413],
    [-0.01182, 0.04294, 0.968881],
  ],
  tritanopia: [
    [1.255528, -0.076749, -0.178779],
    [-0.078411, 0.930809, 0.147602],
    [0.004733, 0.691367, 0.3039],
  ],
} as const;

/** A color as one kind of vision sees it, in OKLab. */
export function seen(hex: number, matrix: readonly (readonly number[])[]) {
  const linear = [hex >> 16, (hex >> 8) & 255, hex & 255].map((c) => {
    const v = c / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  const [r, g, b] = matrix.map((row) =>
    Math.min(
      1,
      Math.max(
        0,
        row.reduce((sum, k, i) => sum + k * (linear[i] ?? 0), 0),
      ),
    ),
  ) as [number, number, number];
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

/** How far apart two colors look, in hundredths of OKLab: about 2 is a just-noticeable difference side by side. */
export const apart = (a: number, b: number, matrix: readonly (readonly number[])[] = VISION.typical) => {
  const [p, q] = [seen(a, matrix), seen(b, matrix)];
  return Math.hypot(...p.map((v, i) => v - (q[i] ?? 0))) * 100;
};
