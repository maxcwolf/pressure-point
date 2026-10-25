// The README's pictures of the game by the numbers, karma, and how a center progresses, drawn as cards in the game's
// palette and Fredoka. The counts, prices and names come from the game's data, passed in by scripts/make-readme.mjs,
// so the pictures can be drawn again whenever those change; the words around them are written here.

/** The colors, as the first pictures had them: the game's teal, darkened, with its gold and cream. */
const BG = '#0f3f3c';
const CARD = '#134b47';
const EDGE = '#217d76';
const BOX_EDGE = '#1c6864';
const CHIP_EDGE = '#1a635f';
const GOLD = '#f2c14e';
const CREAM = '#fff8ea';
const MUTED = '#c0d8d3';
const FAINT = '#99bfb7';

/** The emoji each karma purchase is shown with, by item or decor id. */
const EMOJI = {
  koi_pond: '🐟',
  fireplace: '🔥',
  topiary: '🌳',
  aquarium: '🐠',
  pool_table: '🎱',
  trophy_cabinet: '🏆',
  massage_chair: '💺',
  bonsai: '🪴',
  arcade_machine: '🕹️',
  coffee_machine: '☕',
  bookcase: '📚',
  wheel_of_rebirth: '🎠',
  'floor:rainbow': '🌈',
  'wall:starry': '🌌',
  'wall:tiedye': '🌀',
  'floor:bamboo': '🎋',
};

/** Small numbers as words, as the picture's sentences have them. */
const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six'];

/** The floors and walls the karma picture shows, as a taste of them all. */
export const DECOR_SHOWN = ['floor:rainbow', 'wall:starry', 'wall:tiedye', 'floor:bamboo'];

const css = `
  * { box-sizing: border-box; }
  body { margin: 0; background: ${BG}; font-family: 'Fredoka', sans-serif; color: ${CREAM}; }
  .pic { width: 800px; padding: 13px; background: ${BG}; display: flex; gap: 13px; }
  .card { background: ${CARD}; border: 1px solid ${EDGE}; border-radius: 12px; }
  .gold { color: ${GOLD}; }
  .muted { color: ${MUTED}; }

  #numbers .card { flex: 1; height: 110px; display: flex; flex-direction: column; align-items: center; justify-content: center; }
  #numbers .big { font-size: 44px; font-weight: 700; line-height: 1; color: ${GOLD}; }
  #numbers .what { font-size: 13px; font-weight: 600; margin-top: 10px; }
  #numbers .sub { font-size: 11px; color: ${MUTED}; margin-top: 3px; }

  #karma { align-items: stretch; }
  #karma .card { padding: 16px 16px 14px; }
  #karma h2 { margin: 0 0 9px; font-size: 15px; font-weight: 700; }
  #karma .earn { width: 215px; flex: none; }
  #karma .row { display: flex; justify-content: space-between; align-items: baseline; padding: 6px 0; font-size: 11.5px;
    color: ${MUTED}; border-bottom: 1px solid #185e58; }
  #karma .row b { color: ${GOLD}; font-weight: 600; }
  #karma .note { font-size: 9.5px; color: ${FAINT}; margin-top: 10px; line-height: 1.35; }
  #karma .spend { flex: 1; }
  #karma .chips { display: flex; flex-wrap: wrap; gap: 7px 6px; }
  #karma .chip { display: inline-flex; align-items: center; gap: 4px; height: 22px; padding: 0 9px 0 8px; border-radius: 11px;
    background: ${BG}; border: 1px solid ${CHIP_EDGE}; font-size: 10.5px; }
  #karma .chip b { color: ${GOLD}; font-weight: 600; margin-left: 2px; }
  #karma .foot { font-size: 9.5px; color: ${FAINT}; margin-top: 11px; }

  #progress { flex-direction: column; gap: 10px; }
  #progress .card { display: flex; align-items: center; padding: 12px 14px 12px 14px; height: 96px; }
  #progress .side { width: 165px; flex: none; }
  #progress .icon { font-size: 19px; line-height: 1; }
  #progress h2 { margin: 7px 0 2px; font-size: 14px; font-weight: 700; }
  #progress .side p { margin: 0; font-size: 8.5px; color: ${MUTED}; line-height: 1.4; padding-right: 6px; }
  #progress .steps { flex: 1; display: flex; align-items: center; gap: 4px; }
  #progress .box { flex: 1; height: 40px; border-radius: 7px; background: ${BG}; border: 1px solid ${BOX_EDGE};
    display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; }
  #progress .box.top { border-color: ${GOLD}; color: ${GOLD}; }
  #progress .box .main { font-size: 9.5px; font-weight: 700; }
  #progress .box .stars { font-size: 11px; letter-spacing: 1px; line-height: 1; }
  #progress .box .sub { font-size: 7.5px; color: ${MUTED}; margin-top: 3px; }
  #progress .arrow { width: 0; height: 0; border-left: 6px solid ${GOLD}; border-top: 5px solid transparent;
    border-bottom: 5px solid transparent; flex: none; }
  #progress .gap { width: 14px; flex: none; }`;

/** A box in a row, its sub-line under it, the last of a row in gold. */
const box = (main, sub = '', top = false) =>
  `<div class="box${top ? ' top' : ''}">${main}${sub ? `<div class="sub">${sub}</div>` : ''}</div>`;

/** A row of boxes, with an arrow between each when they come one after another. */
const steps = (boxes, arrows) =>
  `<div class="steps">${boxes.join(arrows ? '<div class="arrow"></div>' : '<div class="gap"></div>')}</div>`;

/**
 * The page with all three pictures, each a box with the id of its file.
 * `g` holds what the game's data says: see scripts/make-readme.mjs.
 */
export function readmePage(g) {
  const numbers = [
    [g.centers, 'campaign centers', 'from high street to country resort'],
    [g.arts, 'healing arts', 'from massage to the Shaman'],
    [g.treatments, 'treatments', 'to train your staff in'],
    [g.ailments, 'ailments', 'from Text Neck to Gull Shock'],
  ]
    .map(
      ([n, what, sub]) =>
        `<div class="card"><div class="big">${n}</div><div class="what">${what}</div><div class="sub">${sub}</div></div>`,
    )
    .join('');

  const range =
    g.achievementMin === g.achievementMax ? `+${g.achievementMax}` : `+${g.achievementMin} to +${g.achievementMax}`;
  /** A purchase as a pill, with its price in gold. */
  const chip = (p) => `<span class="chip">${EMOJI[p.id] ?? ''} ${p.name}<b>${p.karma}</b></span>`;
  const karma = `
    <div class="card earn">
      <h2>✨ Earn karma</h2>
      <div class="row">Each campaign star<b>+${g.starKarma}</b></div>
      <div class="row">${g.achievements} one-off achievements<b>${range}</b></div>
      <div class="row">The whole campaign<b>${g.campaignKarma}</b></div>
      <div class="note">Called In, Century, Talk of the Town, One Big Family... and ${WORDS[g.hidden] ?? g.hidden} kept secret.</div>
    </div>
    <div class="card spend">
      <h2>🛒 Spend it, unlocked in every center for good</h2>
      <div class="chips">${[...g.shop, g.carousel, ...g.decor].map(chip).join('')}</div>
      <div class="foot">Enough for every item, but not the Carousel and every floor and wall as well. Choose.</div>
    </div>`;

  const koi = g.shop.find((p) => p.id === 'koi_pond');
  const fire = g.shop.find((p) => p.id === 'fireplace');
  /** A row's own card: its icon, name and what it means. */
  const side = (icon, title, text) =>
    `<div class="side"><div class="icon">${icon}</div><h2>${title}</h2><p>${text}</p></div>`;
  const progress = `
    <div class="card">${side('⭐', 'Stars', "Hit a center's objectives. Each star opens new rooms and treatments.")}${steps(
      [
        box('<div class="main">Opening day</div>', 'Massage'),
        box('<div class="stars">★</div>', 'Acupuncture, sound, recovery'),
        box('<div class="stars">★★</div>', 'Reiki, Shaman, Qi Gong, machines'),
        box('<div class="stars">★★★</div>', 'The hardest treatments', true),
      ],
      true,
    )}</div>
    <div class="card">${side('✨', 'Karma', 'Earned by stars and achievements, kept forever.')}${steps(
      [
        box(`<div class="main">+${g.starKarma}</div>`, 'per star'),
        box(`<div class="main">${range}</div>`, 'per achievement'),
        box(`<div class="main">${EMOJI.koi_pond} ${koi.name}</div>`, `${koi.karma} karma`),
        box(`<div class="main">${EMOJI.fireplace} ${fire.name}</div>`, `${fire.karma} karma`),
        box(`<div class="main">${g.shop.length} items</div>`, 'a carousel, floors and walls', true),
      ],
      false,
    )}</div>
    <div class="card">${side('🏛️', 'Standing', 'Grow the center. Each grade brings more guests, who expect more.')}${steps(
      g.grades.map((name, i) => box(`<div class="main">${name}</div>`, '', i === g.grades.length - 1)),
      true,
    )}</div>
    <div class="card">${side('🎓', 'Staff ranks', 'Experience earns a promotion, a course slot and a raise.')}${steps(
      g.ranks.map((name, i) => box(`<div class="main">${name}</div>`, '', i === g.ranks.length - 1)),
      true,
    )}</div>`;

  return `<link href="https://fonts.googleapis.com/css2?family=Fredoka:wght@400;600;700&display=block" rel="stylesheet">
    <style>${css}</style>
    <div class="pic" id="numbers">${numbers}</div>
    <div class="pic" id="karma">${karma}</div>
    <div class="pic" id="progress">${progress}</div>`;
}
