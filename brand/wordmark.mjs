// The README wordmark, drawn into an SVG element in a browser that has Montserrat Black loaded:
// PRESSURE and POINT either side of a badge showing a massage, INSTITUTE below in mint, and a
// meridian line with its pressure points underneath, all on a black sign with a white border.

const NS = 'http://www.w3.org/2000/svg';
const INK = '#111';
const TOP_SIZE = 112;
const BOTTOM_SIZE = 262;
const BADGE_RADIUS = 136;
const GAP = 20;
/** Each letter of INSTITUTE turned and lifted a little, as on a hand-set sign. */
const TILT = [-3, 2, -2, 3, -1, 2, -3, 1, 3];
const LIFT = [4, -6, 3, -4, 6, -3, 5, -5, 2];

/** Make an SVG element with these attributes inside a parent. */
function el(parent, tag, attrs) {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  parent.appendChild(e);
  return e;
}

/** Add a line of text. */
function text(parent, content, attrs) {
  const t = el(parent, 'text', { 'font-family': 'Montserrat', 'font-weight': 900, ...attrs });
  t.textContent = content;
  return t;
}

/** How wide some text is at a size. */
function measure(svg, content, size) {
  const t = text(svg, content, { 'font-size': size });
  const w = t.getBBox().width;
  t.remove();
  return w;
}

/** A round-ended stroke along a path. */
function pen(parent, d, width, color = INK) {
  return el(parent, 'path', {
    d,
    fill: 'none',
    stroke: color,
    'stroke-width': width,
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
  });
}

/** The massage pictogram from brand/massage.svg, fitted to stand on the origin inside the badge. */
function pictogram(parent, markup) {
  const art = new DOMParser().parseFromString(markup, 'image/svg+xml').documentElement;
  const g = el(parent, 'g', {});
  for (const path of art.querySelectorAll('path')) {
    const copy = document.importNode(path, true);
    copy.setAttribute('fill', INK);
    g.appendChild(copy);
  }
  const box = g.getBBox();
  const scale = Math.min(236 / box.width, 204 / box.height);
  g.setAttribute('transform', `scale(${scale}) translate(${-box.x - box.width / 2} ${-box.y - box.height})`);
}

/** Draw the wordmark into an empty SVG element, sizing the element to fit, with the badge's pictogram as SVG markup. */
export function drawWordmark(svg, badgeArt) {
  const capTop = TOP_SIZE * 0.7;
  const capBottom = BOTTOM_SIZE * 0.7;
  const wPressure = measure(svg, 'PRESSURE', TOP_SIZE);
  const wPoint = measure(svg, 'POINT', TOP_SIZE);
  const topW = wPressure + GAP + 2 * BADGE_RADIUS + GAP + wPoint;
  const letters = [...'INSTITUTE'].map((c) => ({ c, w: measure(svg, c, BOTTOM_SIZE) }));
  const track = -4;
  const bottomW = letters.reduce((sum, l) => sum + l.w + track, -track);
  const width = Math.max(topW, bottomW) + 220;
  const cx = width / 2;
  const topBase = 300;
  const bottomBase = topBase + 40 + capBottom;
  const height = bottomBase + 190;
  svg.setAttribute('width', String(width));
  svg.setAttribute('height', String(height));
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  const badgeX = cx - topW / 2 + wPressure + GAP + BADGE_RADIUS;
  const badgeY = topBase - 82;

  const defs = el(svg, 'defs', {});
  const blur = el(defs, 'filter', { id: 'soft', x: '-10%', y: '-10%', width: '120%', height: '130%' });
  el(blur, 'feGaussianBlur', { stdDeviation: 9 });
  const mint = el(defs, 'linearGradient', {
    id: 'mint',
    x1: 0,
    x2: 0,
    y1: bottomBase - capBottom,
    y2: bottomBase,
    gradientUnits: 'userSpaceOnUse',
  });
  el(mint, 'stop', { offset: 0, 'stop-color': '#9ad4c8' });
  el(mint, 'stop', { offset: 1, 'stop-color': '#00a68d' });
  const clip = el(defs, 'clipPath', { id: 'badge' });
  el(clip, 'rect', {
    x: badgeX - BADGE_RADIUS,
    y: badgeY - BADGE_RADIUS,
    width: 2 * BADGE_RADIUS,
    height: topBase - (badgeY - BADGE_RADIUS),
  });

  // the sign: a bar behind each line and a disc behind the badge, drawn as shadow, border, then sign
  const pad = 34;
  /** The sign's three shapes, grown outward by some amount. */
  const sign = (g, grow) => {
    el(g, 'rect', {
      x: cx - topW / 2 - pad - grow,
      y: topBase - capTop - pad - grow,
      width: topW + 2 * (pad + grow),
      height: capTop + 2 * pad + 2 * grow,
      rx: 30 + grow,
    });
    el(g, 'rect', {
      x: cx - bottomW / 2 - pad - 6 - grow,
      y: bottomBase - capBottom - pad - grow,
      width: bottomW + 2 * (pad + 6 + grow),
      height: capBottom + 2 * pad + 50 + 2 * grow,
      rx: 40 + grow,
    });
    el(g, 'circle', { cx: badgeX, cy: badgeY, r: BADGE_RADIUS + 26 + grow });
  };
  sign(el(svg, 'g', { fill: '#000', opacity: 0.32, filter: 'url(#soft)', transform: 'translate(10 16)' }), 22);
  sign(el(svg, 'g', { fill: '#fff' }), 22);
  sign(el(svg, 'g', { fill: INK }), 0);

  text(svg, 'PRESSURE', { x: cx - topW / 2, y: topBase, 'font-size': TOP_SIZE, fill: '#fff' });
  text(svg, 'POINT', { x: cx + topW / 2, y: topBase, 'font-size': TOP_SIZE, fill: '#fff', 'text-anchor': 'end' });

  // the badge: a white disc cut flat along the baseline, with the table standing on it
  const badge = el(svg, 'g', { 'clip-path': 'url(#badge)' });
  el(badge, 'circle', { cx: badgeX, cy: badgeY, r: BADGE_RADIUS, fill: '#fff' });
  pictogram(el(badge, 'g', { transform: `translate(${badgeX} ${topBase})` }), badgeArt);

  let x = cx - bottomW / 2;
  letters.forEach((l, i) => {
    const lx = x + l.w / 2;
    text(svg, l.c, {
      x: lx,
      y: bottomBase + (LIFT[i] ?? 0),
      'font-size': BOTTOM_SIZE,
      fill: 'url(#mint)',
      'text-anchor': 'middle',
      transform: `rotate(${TILT[i] ?? 0} ${lx} ${bottomBase - capBottom / 2})`,
    });
    x += l.w + track;
  });

  // a meridian underneath: a gentle wave with three pressure points on it
  const x0 = cx - bottomW / 2 - 10;
  const x1 = cx + bottomW / 2 + 10;
  const lineY = bottomBase + 34;
  let d = '';
  for (let px = x0; px <= x1; px += 6) {
    const py = lineY - 12 * Math.sin(((px - x0) / (x1 - x0)) * Math.PI * 4);
    d += `${d ? 'L' : 'M'}${px.toFixed(1)} ${py.toFixed(1)} `;
  }
  pen(svg, d, 15);
  const wave = pen(svg, d, 6, '#fff');
  const length = wave.getTotalLength();
  for (const f of [0.25, 0.5, 0.75]) {
    const p = wave.getPointAtLength(length * f);
    el(svg, 'circle', { cx: p.x, cy: p.y, r: 15, fill: INK });
    el(svg, 'circle', { cx: p.x, cy: p.y, r: 10, fill: '#fff' });
  }
}
