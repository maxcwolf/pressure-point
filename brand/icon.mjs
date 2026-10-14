// The app icon: "PPI" in white on a tilted mint card with a thick white border, drawn as shapes so it
// needs no font. The card's tilt, its fade and the letters' sizes and lean follow the classic tycoon icon.

/** The card's four corners on a 256-unit square, before rounding. */
const CORNERS = [
  [19.2, 26.6],
  [234, 19.9],
  [229.3, 229.3],
  [25.7, 220.3],
];
const CORNER_RADIUS = 24;
const BORDER = 28;

/** A point some distance from one corner toward another. */
function toward(a, b, d) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const l = Math.hypot(dx, dy);
  return [a[0] + (dx / l) * d, a[1] + (dy / l) * d];
}

/** The card's outline: a quadrilateral with rounded corners. */
export function cardPath() {
  let d = '';
  CORNERS.forEach((c, i) => {
    const a = toward(c, CORNERS[(i + 3) % 4], CORNER_RADIUS);
    const b = toward(c, CORNERS[(i + 1) % 4], CORNER_RADIUS);
    d += `${i ? 'L' : 'M'}${a[0].toFixed(1)} ${a[1].toFixed(1)} Q${c[0]} ${c[1]} ${b[0].toFixed(1)} ${b[1].toFixed(1)} `;
  });
  return `${d}Z`;
}

/** The letters P, P and I, scaled about the card's center. */
export function letters(scale = 1.08) {
  const stem = 18;
  const bar = 16;
  const top = 85;
  const bot = 166;
  const pw = 51;
  const iw = 46;
  const gap = 11;
  const round = 5;
  const bowlBot = top + 50;
  const bowl = 25;
  const counter = (50 - 2 * bar) / 2;
  const x0 = 127 - (pw + gap + pw + gap + iw) / 2;
  const mid = (top + bot) / 2;

  /** One P, with its counter cut out. */
  const p = (x) => {
    const right = x + pw;
    const cx = right - bar - counter;
    const outer =
      `M${x + round} ${top} H${right - bowl} A${bowl} ${bowl} 0 0 1 ${right - bowl} ${bowlBot} H${x + stem} ` +
      `V${bot - round} Q${x + stem} ${bot} ${x + stem - round} ${bot} H${x + round} Q${x} ${bot} ${x} ${bot - round} ` +
      `V${top + round} Q${x} ${top} ${x + round} ${top} Z`;
    const hole = `M${x + stem} ${top + bar} H${cx} A${counter} ${counter} 0 0 1 ${cx} ${bowlBot - bar} H${x + stem} Z`;
    return `<path fill-rule="evenodd" d="${outer} ${hole}"/>`;
  };
  /** Lean a letter about its own center. */
  const lean = (deg, x, w, body) => `<g transform="rotate(${deg} ${x + w / 2} ${mid})">${body}</g>`;

  const xi = x0 + 2 * (pw + gap);
  const i =
    `<rect x="${xi + (iw - stem) / 2}" y="${top}" width="${stem}" height="${bot - top}" rx="${round}"/>` +
    `<rect x="${xi}" y="${top}" width="${iw}" height="${bar}" rx="${round}"/>` +
    `<rect x="${xi}" y="${bot - bar}" width="${iw}" height="${bar}" rx="${round}"/>`;
  // as in the original: the first letter leans back, the second forward, the third stands straight
  return (
    `<g fill="#fff" transform="translate(127 ${mid}) scale(${scale}) translate(-127 ${-mid})">` +
    lean(-3, x0, pw, p(x0)) +
    lean(2, x0 + pw + gap, pw, p(x0 + pw + gap)) +
    i +
    `</g>`
  );
}

/** The whole icon as SVG, at a pixel size, with an optional margin of empty space around the art. */
export function iconSvg(size = 256, margin = 0) {
  const span = 256 + 2 * margin;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-margin} ${-margin} ${span} ${span}" width="${size}" height="${size}">
<defs><linearGradient id="mint" x1="0" y1="20" x2="0" y2="230" gradientUnits="userSpaceOnUse">
<stop offset="0" stop-color="#94d3c7"/><stop offset="1" stop-color="#13a48c"/></linearGradient></defs>
<path d="${cardPath()}" fill="#fff" stroke="#fff" stroke-width="${BORDER}" stroke-linejoin="round"/>
<path d="${cardPath()}" fill="url(#mint)"/>
${letters()}
</svg>
`;
}
