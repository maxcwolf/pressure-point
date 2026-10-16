// The README's download buttons, drawn in the game's own style: a rounded button with a navy outline and a drop
// shadow, an icon in a cream disc, and two lines of Fredoka. The icons are plain drawings of a play button, a laptop
// and a desktop computer, not anyone's logo.

/** The palette, as tokens.css has it. */
const NAVY = '#24384a';
const CREAM = '#fff8ea';
const TEAL = '#2fa8a0';
const ORANGE = '#f08a4b';

/** Each icon, drawn in a 24-unit square in navy. */
const ICONS = {
  web: `<circle cx="12" cy="12" r="9.5" fill="none" stroke="${NAVY}" stroke-width="2.2"/><path d="M10 7.8v8.4l6.6-4.2z" fill="${NAVY}" stroke="${NAVY}" stroke-width="1.4" stroke-linejoin="round"/>`,
  mac: `<rect x="4.2" y="5" width="15.6" height="10.4" rx="1.6" fill="none" stroke="${NAVY}" stroke-width="2.2"/><path d="M2 18.2h20l-1.2 1.6H3.2z" fill="${NAVY}" stroke="${NAVY}" stroke-width="1.4" stroke-linejoin="round"/>`,
  windows: `<rect x="2.8" y="3.8" width="18.4" height="12.4" rx="1.6" fill="none" stroke="${NAVY}" stroke-width="2.2"/><path d="M10 16.4l-0.8 3.4h5.6l-0.8-3.4M7 20.2h10" fill="none" stroke="${NAVY}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>`,
};

/** The buttons: which file each becomes, its color, icon, and its two lines of words. */
export const BUTTONS = [
  { file: 'play-web', color: ORANGE, icon: 'web', small: 'Play free in your', big: 'Browser' },
  { file: 'download-mac', color: TEAL, icon: 'mac', small: 'Download for', big: 'Mac', note: 'Apple silicon' },
  { file: 'download-windows', color: TEAL, icon: 'windows', small: 'Download for', big: 'Windows' },
];

/** The page the buttons are drawn on, each in a box with the id of its file and room for its shadow, to be pictured on its own. */
export function buttonsPage() {
  const css = `
    body { margin: 0; padding: 12px; display: flex; align-items: flex-start; gap: 16px; font-family: 'Fredoka', sans-serif; background: transparent; }
    .btn { display: inline-flex; align-items: center; gap: 12px; width: 236px; box-sizing: border-box;
      padding: 9px 18px 9px 10px; border: 3px solid ${NAVY}; border-radius: 20px; color: #fff;
      box-shadow: 0 5px 0 rgba(36, 56, 74, 0.32); }
    .wrap { padding: 0 0 5px; }
    .disc { width: 46px; height: 46px; flex: none; border-radius: 50%; background: ${CREAM};
      border: 3px solid ${NAVY}; box-sizing: border-box; display: grid; place-items: center; }
    .disc svg { width: 28px; height: 28px; }
    .words { display: flex; flex-direction: column; line-height: 1.05; text-shadow: 0 1px 0 rgba(0, 0, 0, 0.25); }
    .small { font-size: 14px; font-weight: 500; opacity: 0.95; }
    .big { font-size: 25px; font-weight: 600; }
    .note { font-size: 12px; font-weight: 500; margin-left: 6px; opacity: 0.9; }`;
  const buttons = BUTTONS.map(
    (b) => `<div class="wrap" id="${b.file}"><div class="btn" style="background:${b.color}">
      <div class="disc"><svg viewBox="0 0 24 24">${ICONS[b.icon]}</svg></div>
      <div class="words"><span class="small">${b.small}</span>
        <span class="big">${b.big}${b.note ? `<span class="note">${b.note}</span>` : ''}</span></div>
    </div></div>`,
  ).join('');
  return `<link href="https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600&display=block" rel="stylesheet"><style>${css}</style>${buttons}`;
}
